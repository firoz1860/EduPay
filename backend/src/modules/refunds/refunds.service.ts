import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { stripe, stripeEnabled } from '../../config/stripe';
import { add, round2, sub, gt, toNumber, ZERO, gte } from '../../lib/money';
import { generateNumber } from '../../lib/sequence';
import { NotFoundError, UnprocessableError } from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import { computeOutstanding, deriveInvoiceStatus } from '../../services/invoice-math';
import { publishRefundCompleted } from '../../realtime/publish';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import { UNMATCHABLE_UUID, type Actor } from '../../lib/actor';
import type { CreateRefundInput, ListRefundsQuery } from './refunds.schema';

/** Amount already consumed by non-cancelled/non-failed refunds against a payment. */
async function refundedTotal(tx: Prisma.TransactionClient, paymentId: string): Promise<Prisma.Decimal> {
  const agg = await tx.refund.aggregate({
    where: { paymentId, status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] } },
    _sum: { amount: true },
  });
  return round2(agg._sum.amount ?? 0);
}

export async function createRefund(input: CreateRefundInput, actor: Actor, requestId: string) {
  const refund = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.status !== 'SUCCESS' && payment.status !== 'REFUND_PENDING') {
      throw new UnprocessableError(`Only successful payments can be refunded (status: ${payment.status})`);
    }

    const amount = round2(input.amount);
    const alreadyRefunded = await refundedTotal(tx, payment.id);
    const refundable = sub(payment.amount, alreadyRefunded);
    if (gt(amount, refundable)) {
      throw new UnprocessableError(
        `Refund ${toNumber(amount)} exceeds refundable balance ${toNumber(refundable)}`,
      );
    }

    const created = await tx.refund.create({
      data: {
        refundNumber: generateNumber('REF'),
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        studentId: payment.studentId,
        amount,
        reason: input.reason,
        status: 'PENDING',
        createdBy: actor.sub,
      },
    });

    // Reflect intent on the payment (SUCCESS -> REFUND_PENDING).
    if (payment.status === 'SUCCESS') {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUND_PENDING' } });
    }

    await recordAudit(tx, {
      actor,
      action: 'REFUND_CREATED',
      entity: 'Refund',
      entityId: created.id,
      newValue: { amount: toNumber(amount), paymentId: payment.id },
      reason: input.reason,
      requestId,
    });

    return created;
  });

  return getRefundById(refund.id);
}

export async function approveRefund(id: string, actor: Actor, requestId: string) {
  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundError('Refund not found');
    if (refund.status !== 'PENDING') {
      throw new UnprocessableError(`Only PENDING refunds can be approved (status: ${refund.status})`);
    }
    await tx.refund.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: actor.sub, approvedAt: new Date() },
    });
    await recordAudit(tx, {
      actor,
      action: 'REFUND_APPROVED',
      entity: 'Refund',
      entityId: id,
      oldValue: { status: 'PENDING' },
      newValue: { status: 'APPROVED' },
      requestId,
    });
  });
  return getRefundById(id);
}

/**
 * Complete an approved refund: move money atomically. Reduces invoice paid,
 * recomputes outstanding/status, writes an immutable DEBIT ledger entry, and
 * transitions the payment to REFUNDED once fully refunded.
 */
export async function completeRefund(id: string, actor: Actor, requestId: string) {
  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundError('Refund not found');
    if (refund.status !== 'APPROVED') {
      throw new UnprocessableError(`Only APPROVED refunds can be completed (status: ${refund.status})`);
    }

    const payment = await tx.payment.findUnique({ where: { id: refund.paymentId } });
    const invoice = await tx.invoice.findUnique({ where: { id: refund.invoiceId } });
    if (!payment || !invoice) throw new NotFoundError('Related payment/invoice missing');

    // Real gateway refund if configured.
    let providerRefundId: string | null = null;
    if (stripeEnabled && stripe && payment.providerPaymentId) {
      const r = await stripe.refunds.create({
        payment_intent: payment.providerPaymentId,
        amount: Math.round(toNumber(refund.amount) * 100),
      });
      providerRefundId = r.id;
    }

    // Reduce invoice paid amount + recompute.
    const newPaid = round2(sub(invoice.paidAmount, refund.amount));
    const paidClamped = newPaid.lessThan(0) ? ZERO : newPaid;
    const newOutstanding = computeOutstanding(invoice.payableAmount, paidClamped);
    const invStatus =
      invoice.status === 'CANCELLED'
        ? 'CANCELLED'
        : deriveInvoiceStatus(invoice.payableAmount, paidClamped, invoice.dueDate);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { paidAmount: paidClamped, outstandingAmount: newOutstanding, status: invStatus },
    });

    // Immutable ledger DEBIT (money out).
    await tx.ledgerEntry.create({
      data: {
        reference: generateNumber('LED'),
        type: 'REFUND',
        direction: 'DEBIT',
        amount: round2(refund.amount),
        paymentId: payment.id,
        invoiceId: invoice.id,
        refundId: refund.id,
        studentId: refund.studentId,
        description: `Refund ${refund.refundNumber} for payment ${payment.paymentNumber}`,
      },
    });

    await tx.refund.update({
      where: { id },
      data: { status: 'COMPLETED', providerRefundId },
    });

    // Fully refunded? Transition payment to REFUNDED, else keep REFUND_PENDING.
    const totalRefunded = await refundedTotal(tx, payment.id);
    if (gte(totalRefunded, payment.amount)) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    }

    await recordAudit(tx, {
      actor,
      action: 'REFUND_COMPLETED',
      entity: 'Refund',
      entityId: id,
      oldValue: { status: 'APPROVED' },
      newValue: { status: 'COMPLETED', amount: toNumber(refund.amount) },
      requestId,
    });
  });
  await publishRefundCompleted(id);
  return getRefundById(id);
}

const refundInclude = {
  payment: { select: { id: true, paymentNumber: true, amount: true, status: true } },
  student: { select: { id: true, fullName: true, rollNumber: true } },
  invoice: { select: { id: true, invoiceNumber: true } },
} satisfies Prisma.RefundInclude;

function serialize(r: Prisma.RefundGetPayload<{ include: typeof refundInclude }>) {
  return {
    ...r,
    amount: toNumber(r.amount),
    payment: r.payment ? { ...r.payment, amount: toNumber(r.payment.amount) } : null,
  };
}

export async function getRefundById(id: string) {
  const refund = await prisma.refund.findUnique({ where: { id }, include: refundInclude });
  if (!refund) throw new NotFoundError('Refund not found');
  return serialize(refund);
}

export async function listRefunds(query: ListRefundsQuery, actor: Actor) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.RefundWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.paymentId) where.paymentId = query.paymentId;
  if (actor.role === 'STUDENT') where.studentId = actor.studentId ?? UNMATCHABLE_UUID;
  else if (query.studentId) where.studentId = query.studentId;
  if (query.search) where.refundNumber = { contains: query.search, mode: 'insensitive' };

  const [rows, total] = await Promise.all([
    prisma.refund.findMany({ where, include: refundInclude, orderBy: { createdAt: query.sortOrder }, skip, take }),
    prisma.refund.count({ where }),
  ]);
  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total) };
}
