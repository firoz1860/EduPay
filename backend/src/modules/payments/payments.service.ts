import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { stripe, stripeEnabled } from '../../config/stripe';
import { env } from '../../config/env';
import { money, round2, gt, toNumber } from '../../lib/money';
import { generateNumber } from '../../lib/sequence';
import {
  NotFoundError,
  UnprocessableError,
  ForbiddenError,
  ConflictError,
} from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import { assertTransition, type PaymentStatus } from '../../services/payment-state';
import type { JwtPayload } from '../../lib/jwt';
import { UNMATCHABLE_UUID } from '../../lib/actor';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import { settlePaymentSuccess, settlePaymentFailure } from './payments.settlement';
import { publishPaymentCreated, publishPaymentSettled } from '../../realtime/publish';
import type { CreatePaymentInput, ListPaymentsQuery, SimulateInput } from './payments.schema';

type Actor = Pick<JwtPayload, 'sub' | 'name' | 'role' | 'studentId'>;

function isStudent(actor: Actor): boolean {
  return actor.role === 'STUDENT';
}

/** Students may only act on their own payments/invoices. */
function assertOwnership(actor: Actor, studentId: string): void {
  if (isStudent(actor) && actor.studentId !== studentId) {
    throw new ForbiddenError('You can only access your own records');
  }
}

export async function createPayment(input: CreatePaymentInput, actor: Actor, requestId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { student: true },
  });
  if (!invoice) throw new NotFoundError('Invoice not found');

  assertOwnership(actor, invoice.studentId);

  if (invoice.status === 'CANCELLED') {
    throw new UnprocessableError('Cannot pay a cancelled invoice');
  }
  if (invoice.status === 'PAID') {
    throw new UnprocessableError('Invoice is already fully paid');
  }

  const amount = round2(input.amount);
  if (amount.lessThanOrEqualTo(0)) throw new UnprocessableError('Amount must be positive');

  // Determine the outstanding ceiling (installment-scoped or invoice-scoped).
  let installment = null;
  let outstandingCeiling = invoice.outstandingAmount;
  if (input.installmentId) {
    installment = await prisma.installment.findFirst({
      where: { id: input.installmentId, invoiceId: invoice.id },
    });
    if (!installment) throw new NotFoundError('Installment not found for this invoice');
    outstandingCeiling = installment.outstandingAmount;
  }

  if (!input.allowOverpayment && gt(amount, outstandingCeiling)) {
    throw new UnprocessableError(
      `Amount ${toNumber(amount)} exceeds outstanding ${toNumber(outstandingCeiling)}. ` +
        `Set allowOverpayment to override.`,
    );
  }

  const paymentNumber = generateNumber('PAY');

  // Create payment + first attempt + audit atomically.
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        paymentNumber,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        installmentId: installment?.id ?? null,
        amount,
        currency: 'INR',
        provider: stripeEnabled ? 'STRIPE' : 'SIMULATED',
        status: 'PENDING',
        paymentMethod: input.method,
        createdBy: actor.sub,
        metadata: { allowOverpayment: input.allowOverpayment } as Prisma.InputJsonValue,
      },
    });

    await tx.paymentAttempt.create({
      data: {
        paymentId: created.id,
        attemptNumber: 1,
        amount,
        provider: created.provider,
        status: 'CREATED',
      },
    });

    await recordAudit(tx, {
      actor,
      action: 'PAYMENT_CREATED',
      entity: 'Payment',
      entityId: created.id,
      newValue: { amount: toNumber(amount), invoiceId: invoice.id, status: 'PENDING' },
      requestId,
    });

    return created;
  });

  // Create the provider intent (real Stripe) or signal simulated mode.
  let clientSecret: string | null = null;
  let providerPaymentId: string | null = null;

  if (stripeEnabled && stripe) {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(toNumber(amount) * 100), // paise
      currency: 'inr',
      metadata: { paymentId: payment.id, invoiceId: invoice.id, paymentNumber },
      description: `EduPay ${paymentNumber} for invoice ${invoice.invoiceNumber}`,
      automatic_payment_methods: { enabled: true },
    });
    clientSecret = intent.client_secret;
    providerPaymentId = intent.id;
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId },
    });
  }

  await publishPaymentCreated(payment.id);

  return {
    payment: await getPaymentById(payment.id, actor),
    provider: payment.provider,
    simulated: !stripeEnabled,
    clientSecret,
    providerPaymentId,
  };
}

/**
 * Simulated settlement endpoint — drives the payment lifecycle when real Stripe
 * is not configured, so the full flow is demonstrable without secrets. Emits the
 * same atomic settlement path a real webhook would.
 */
export async function simulateSettlement(
  paymentId: string,
  input: SimulateInput,
  actor: Actor,
  requestId: string,
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError('Payment not found');
  assertOwnership(actor, payment.studentId);

  if (stripeEnabled) {
    throw new ConflictError('Stripe is configured; use the real payment flow / webhook');
  }

  const eventId = `sim_${payment.id}_${input.outcome}`;

  await prisma.$transaction(async (tx) => {
    // Record a gateway event for idempotency + reconciliation, mirroring webhooks.
    const existing = await tx.gatewayEvent.findUnique({ where: { gatewayEventId: eventId } });
    if (existing?.processed) {
      return; // already simulated this outcome — idempotent no-op
    }
    if (!existing) {
      await tx.gatewayEvent.create({
        data: {
          gatewayEventId: eventId,
          provider: 'SIMULATED',
          eventType: input.outcome === 'success' ? 'payment.succeeded' : 'payment.failed',
          eventData: { simulated: true, outcome: input.outcome } as Prisma.InputJsonValue,
          paymentId: payment.id,
          processed: false,
        },
      });
    }

    if (input.outcome === 'success') {
      await settlePaymentSuccess(
        tx,
        payment.id,
        {
          providerPaymentId: `sim_pi_${payment.id.slice(0, 8)}`,
          amount: payment.amount,
          method: payment.paymentMethod,
          gatewayEventId: eventId,
          gatewayStatus: 'SUCCESS',
        },
        { actor, requestId },
      );
    } else {
      await settlePaymentFailure(
        tx,
        payment.id,
        input.failureReason ?? 'Simulated failure',
        { actor, requestId },
      );
    }

    await tx.gatewayEvent.update({
      where: { gatewayEventId: eventId },
      data: { processed: true, processedAt: new Date() },
    });
  });

  await publishPaymentSettled(payment.id);

  return getPaymentById(payment.id, actor);
}

export async function cancelPayment(paymentId: string, actor: Actor, requestId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError('Payment not found');
  assertOwnership(actor, payment.studentId);
  assertTransition(payment.status as PaymentStatus, 'CANCELLED');

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
    await recordAudit(tx, {
      actor,
      action: 'PAYMENT_CANCELLED',
      entity: 'Payment',
      entityId: payment.id,
      oldValue: { status: payment.status },
      newValue: { status: 'CANCELLED' },
      requestId,
    });
  });

  return getPaymentById(payment.id, actor);
}

const paymentInclude = {
  student: { select: { id: true, fullName: true, rollNumber: true, email: true } },
  invoice: { select: { id: true, invoiceNumber: true, payableAmount: true, outstandingAmount: true, status: true } },
  installment: { select: { id: true, label: true, installmentNumber: true } },
  attempts: { orderBy: { attemptNumber: 'asc' as const } },
} satisfies Prisma.PaymentInclude;

export async function getPaymentById(id: string, actor: Actor) {
  const payment = await prisma.payment.findUnique({ where: { id }, include: paymentInclude });
  if (!payment) throw new NotFoundError('Payment not found');
  assertOwnership(actor, payment.studentId);
  return serialize(payment);
}

export async function listPayments(query: ListPaymentsQuery, actor: Actor) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);

  const where: Prisma.PaymentWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.invoiceId) where.invoiceId = query.invoiceId;
  if (isStudent(actor)) {
    where.studentId = actor.studentId ?? UNMATCHABLE_UUID;
  } else if (query.studentId) {
    where.studentId = query.studentId;
  }
  if (query.search) {
    where.OR = [
      { paymentNumber: { contains: query.search, mode: 'insensitive' } },
      { transactionReference: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
  ]);

  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total) };
}

/** Serialize Decimals to numbers for JSON. */
function serialize(p: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>) {
  return {
    ...p,
    amount: toNumber(p.amount),
    invoice: p.invoice
      ? {
          ...p.invoice,
          payableAmount: toNumber(p.invoice.payableAmount),
          outstandingAmount: toNumber(p.invoice.outstandingAmount),
        }
      : null,
    attempts: p.attempts.map((a) => ({ ...a, amount: toNumber(a.amount) })),
  };
}

export { money };
