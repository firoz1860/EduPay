import { prisma } from '../config/prisma';
import { toNumber } from '../lib/money';
import { notify } from '../modules/notifications/notifications.service';
import { logger } from '../lib/logger';

/**
 * High-level domain event publishers. Each is self-contained (loads what it
 * needs) and MUST be called AFTER the financial transaction commits, so we never
 * notify about rolled-back changes. Failures here never break the request.
 */

const STAFF = ['ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN'];
const ALL_STAFF = ['ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR'];
const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

async function safe(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn({ err }, 'Failed to publish realtime event');
  }
}

/** Payment reached a terminal state (SUCCESS or FAILED). */
export async function publishPaymentSettled(paymentId: string): Promise<void> {
  await safe(async () => {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: { select: { userId: true, fullName: true } } },
    });
    if (!payment) return;
    const amount = toNumber(payment.amount);
    const studentUserId = payment.student?.userId ?? null;
    const name = payment.student?.fullName ?? 'A student';

    if (payment.status === 'SUCCESS') {
      await notify({
        userIds: [studentUserId],
        roles: STAFF,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment received',
        message: `${name}'s payment ${payment.paymentNumber} of ${INR(amount)} succeeded.`,
        entityType: 'Payment',
        entityId: payment.id,
        invalidate: ['payments', 'invoices', 'dashboard', 'ledger', 'reconciliation', 'notifications'],
        invalidateRoles: ALL_STAFF,
      });
    } else if (payment.status === 'FAILED') {
      await notify({
        userIds: [studentUserId],
        roles: STAFF,
        type: 'PAYMENT_FAILED',
        title: 'Payment failed',
        message: `${name}'s payment ${payment.paymentNumber} of ${INR(amount)} failed${payment.failureReason ? ` (${payment.failureReason})` : ''}.`,
        entityType: 'Payment',
        entityId: payment.id,
        invalidate: ['payments', 'dashboard', 'notifications'],
        invalidateRoles: ALL_STAFF,
      });
    }
  });
}

export async function publishPaymentCreated(paymentId: string): Promise<void> {
  await safe(async () => {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: { select: { userId: true, fullName: true } } },
    });
    if (!payment) return;
    await notify({
      roles: STAFF,
      type: 'PAYMENT_CREATED',
      title: 'Payment initiated',
      message: `${payment.student?.fullName ?? 'A student'} started payment ${payment.paymentNumber} of ${INR(toNumber(payment.amount))}.`,
      entityType: 'Payment',
      entityId: payment.id,
      invalidate: ['payments', 'dashboard', 'notifications'],
      invalidateRoles: ALL_STAFF,
    });
  });
}

export async function publishRefundCompleted(refundId: string): Promise<void> {
  await safe(async () => {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: { student: { select: { userId: true, fullName: true } } },
    });
    if (!refund) return;
    await notify({
      userIds: [refund.student?.userId ?? null],
      roles: STAFF,
      type: 'REFUND_COMPLETED',
      title: 'Refund completed',
      message: `Refund ${refund.refundNumber} of ${INR(toNumber(refund.amount))} to ${refund.student?.fullName ?? 'a student'} was completed.`,
      entityType: 'Refund',
      entityId: refund.id,
      invalidate: ['refunds', 'payments', 'invoices', 'dashboard', 'ledger', 'notifications'],
      invalidateRoles: ALL_STAFF,
    });
  });
}

export async function publishReconciliationRun(created: number, summary: Record<string, number>): Promise<void> {
  await safe(async () => {
    const issues = Object.entries(summary)
      .filter(([s]) => s !== 'MATCHED' && s !== 'RESOLVED')
      .reduce((a, [, n]) => a + n, 0);
    await notify({
      roles: STAFF,
      type: 'RECONCILIATION_RUN',
      title: 'Reconciliation run complete',
      message: `Reconciliation processed ${created} new record(s). ${issues} issue(s) need review.`,
      entityType: 'ReconciliationRecord',
      invalidate: ['reconciliation', 'dashboard', 'notifications'],
      invalidateRoles: ALL_STAFF,
    });
  });
}

export async function publishReconciliationResolved(reconId: string): Promise<void> {
  await safe(async () => {
    await notify({
      roles: STAFF,
      type: 'RECONCILIATION_RESOLVED',
      title: 'Reconciliation resolved',
      message: 'A reconciliation discrepancy was resolved.',
      entityType: 'ReconciliationRecord',
      entityId: reconId,
      invalidate: ['reconciliation', 'dashboard', 'notifications'],
      invalidateRoles: ALL_STAFF,
    });
  });
}

export async function publishInvoiceCreated(invoiceId: string): Promise<void> {
  await safe(async () => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { student: { select: { userId: true, fullName: true } } },
    });
    if (!invoice) return;
    await notify({
      userIds: [invoice.student?.userId ?? null],
      roles: STAFF,
      type: 'INVOICE_CREATED',
      title: 'Invoice issued',
      message: `Invoice ${invoice.invoiceNumber} of ${INR(toNumber(invoice.payableAmount))} was issued to ${invoice.student?.fullName ?? 'a student'}.`,
      entityType: 'Invoice',
      entityId: invoice.id,
      invalidate: ['invoices', 'dashboard', 'notifications'],
      invalidateRoles: ALL_STAFF,
    });
  });
}
