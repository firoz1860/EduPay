import { Prisma } from '@prisma/client';
import type { Tx } from '../../config/prisma';
import { add, round2 } from '../../lib/money';
import { generateNumber } from '../../lib/sequence';
import {
  deriveInvoiceStatus,
  deriveInstallmentStatus,
  computeOutstanding,
} from '../../services/invoice-math';
import { assertTransition, type PaymentStatus } from '../../services/payment-state';
import { recordAudit } from '../../services/audit.service';
import type { JwtPayload } from '../../lib/jwt';

interface GatewayInfo {
  providerPaymentId?: string | null;
  transactionReference?: string | null;
  amount?: Prisma.Decimal.Value | null;
  method?: string | null;
  gatewayEventId?: string | null;
  gatewayStatus?: string | null;
}

interface SettleCtx {
  actor?: Pick<JwtPayload, 'sub' | 'name' | 'role'> | null;
  requestId?: string | null;
}

/**
 * Atomically settle a payment as SUCCESS. MUST be called inside a Prisma
 * transaction so payment, invoice, installment, ledger, reconciliation and
 * audit either all commit or all roll back.
 *
 * Idempotent: if the payment is already SUCCESS the money is not applied twice.
 */
export async function settlePaymentSuccess(
  tx: Tx,
  paymentId: string,
  gateway: GatewayInfo,
  ctx: SettleCtx = {},
): Promise<void> {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error(`Payment ${paymentId} not found during settlement`);

  if (payment.status === 'SUCCESS') {
    // Already applied — ensure a reconciliation record exists, then no-op.
    await upsertReconciliation(tx, payment.id);
    return;
  }

  assertTransition(payment.status as PaymentStatus, 'SUCCESS');

  const previousStatus = payment.status;

  const updatedPayment = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      providerPaymentId: gateway.providerPaymentId ?? payment.providerPaymentId,
      transactionReference:
        gateway.transactionReference ?? payment.transactionReference ?? generateNumber('TXN'),
      paymentMethod: gateway.method ?? payment.paymentMethod,
    },
  });

  // Record a successful attempt.
  const attemptCount = await tx.paymentAttempt.count({ where: { paymentId: payment.id } });
  await tx.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: attemptCount + 1,
      amount: payment.amount,
      provider: payment.provider,
      providerAttemptId: gateway.providerPaymentId ?? null,
      status: 'SUCCESS',
      providerResponse: (gateway.gatewayStatus
        ? { status: gateway.gatewayStatus }
        : Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });

  // Update invoice money atomically.
  const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
  if (!invoice) throw new Error('Invoice not found during settlement');

  const newPaid = add(invoice.paidAmount, payment.amount);
  const newOutstanding = computeOutstanding(invoice.payableAmount, newPaid);
  const nextStatus =
    invoice.status === 'CANCELLED'
      ? 'CANCELLED'
      : deriveInvoiceStatus(invoice.payableAmount, newPaid, invoice.dueDate);

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { paidAmount: newPaid, outstandingAmount: newOutstanding, status: nextStatus },
  });

  // Update installment if applicable.
  if (payment.installmentId) {
    const inst = await tx.installment.findUnique({ where: { id: payment.installmentId } });
    if (inst) {
      const instPaid = add(inst.paidAmount, payment.amount);
      const instOutstanding = computeOutstanding(inst.amount, instPaid);
      await tx.installment.update({
        where: { id: inst.id },
        data: {
          paidAmount: instPaid,
          outstandingAmount: instOutstanding,
          status: deriveInstallmentStatus(inst.amount, instPaid, inst.dueDate),
        },
      });
    }
  }

  // Immutable ledger entry (money in).
  await tx.ledgerEntry.create({
    data: {
      reference: generateNumber('LED'),
      type: 'PAYMENT',
      direction: 'CREDIT',
      amount: round2(payment.amount),
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      studentId: payment.studentId,
      description: `Payment ${payment.paymentNumber} settled for invoice ${invoice.invoiceNumber}`,
    },
  });

  await upsertReconciliation(tx, payment.id);

  await recordAudit(tx, {
    actor: ctx.actor,
    action: 'PAYMENT_SUCCESS',
    entity: 'Payment',
    entityId: payment.id,
    oldValue: { status: previousStatus },
    newValue: { status: 'SUCCESS', amount: payment.amount.toString() },
    reason: gateway.gatewayEventId ? `Gateway event ${gateway.gatewayEventId}` : 'Settled',
    requestId: ctx.requestId,
  });

  void updatedPayment;
}

/** Atomically mark a payment FAILED and record the attempt + audit. */
export async function settlePaymentFailure(
  tx: Tx,
  paymentId: string,
  failureReason: string,
  ctx: SettleCtx = {},
): Promise<void> {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (payment.status === 'FAILED') return;
  assertTransition(payment.status as PaymentStatus, 'FAILED');

  await tx.payment.update({
    where: { id: payment.id },
    data: { status: 'FAILED', failureReason },
  });

  const attemptCount = await tx.paymentAttempt.count({ where: { paymentId: payment.id } });
  await tx.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: attemptCount + 1,
      amount: payment.amount,
      provider: payment.provider,
      status: 'FAILED',
      failureReason,
    },
  });

  await recordAudit(tx, {
    actor: ctx.actor,
    action: 'PAYMENT_FAILED',
    entity: 'Payment',
    entityId: payment.id,
    newValue: { status: 'FAILED', failureReason },
    requestId: ctx.requestId,
  });
}

/**
 * Create or refresh the reconciliation record for a payment by comparing the
 * internal record against the recorded gateway event. Keeps recon data current.
 */
export async function upsertReconciliation(tx: Tx, paymentId: string): Promise<void> {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;

  const gatewayEvent = await tx.gatewayEvent.findFirst({
    where: { paymentId: payment.id },
    orderBy: { createdAt: 'desc' },
  });

  const existing = await tx.reconciliationRecord.findFirst({ where: { paymentId: payment.id } });

  const data = {
    paymentId: payment.id,
    internalPaymentNumber: payment.paymentNumber,
    internalAmount: payment.amount,
    internalStatus: payment.status,
    gatewayPaymentId: gatewayEvent ? payment.providerPaymentId : payment.providerPaymentId,
    gatewayAmount: payment.status === 'SUCCESS' ? payment.amount : gatewayEvent ? payment.amount : null,
    gatewayStatus: gatewayEvent?.eventType?.includes('failed')
      ? 'FAILED'
      : payment.status === 'SUCCESS'
        ? 'SUCCESS'
        : null,
    gatewayEventId: gatewayEvent?.gatewayEventId ?? null,
    status: payment.status === 'SUCCESS' ? 'MATCHED' : 'PENDING_REVIEW',
  };

  if (existing) {
    // Do not overwrite a manually resolved record.
    if (existing.status === 'RESOLVED') return;
    await tx.reconciliationRecord.update({ where: { id: existing.id }, data });
  } else {
    await tx.reconciliationRecord.create({ data });
  }
}
