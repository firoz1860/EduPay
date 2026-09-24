import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { toNumber } from '../../lib/money';
import { NotFoundError, UnprocessableError } from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import { classifyReconciliation, type ReconSide } from '../../services/reconciliation-classifier';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { Actor } from '../../lib/actor';
import type { ListReconQuery, ResolveInput } from './reconciliation.schema';

/**
 * Runs a reconciliation sweep:
 *  - creates records for payments that don't yet have one (comparing the internal
 *    record to the recorded gateway event via the deterministic classifier),
 *  - flags DUPLICATE gateway references,
 *  - leaves existing records (including seeded discrepancies and RESOLVED ones) intact.
 * Returns a summary count by status. Every run writes an audit entry.
 */
export async function runReconciliation(actor: Actor, requestId: string) {
  const payments = await prisma.payment.findMany({
    include: { gatewayEvents: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const existing = await prisma.reconciliationRecord.findMany({ select: { paymentId: true, status: true } });
  const haveRecord = new Map(existing.map((r) => [r.paymentId, r.status]));

  // Detect duplicate gateway references.
  const providerCounts = new Map<string, number>();
  for (const p of payments) {
    if (p.providerPaymentId) {
      providerCounts.set(p.providerPaymentId, (providerCounts.get(p.providerPaymentId) ?? 0) + 1);
    }
  }

  let createdCount = 0;
  for (const p of payments) {
    if (haveRecord.has(p.id)) continue; // don't clobber existing/seeded/resolved records

    const isDuplicate = !!p.providerPaymentId && (providerCounts.get(p.providerPaymentId) ?? 0) > 1;

    const internal: ReconSide = {
      reference: p.paymentNumber,
      amount: p.amount,
      status: p.status,
    };

    const event = p.gatewayEvents[0];
    // Build the gateway side: from the event when present, else mirror a settled payment.
    let gateway: ReconSide | null = null;
    if (event) {
      const failed = event.eventType?.includes('fail');
      gateway = {
        reference: p.providerPaymentId,
        amount: p.amount,
        status: failed ? 'FAILED' : 'SUCCESS',
      };
    } else if (p.status === 'SUCCESS') {
      gateway = { reference: p.providerPaymentId, amount: p.amount, status: 'SUCCESS' };
    }

    const result = classifyReconciliation(internal, gateway, { duplicate: isDuplicate });

    await prisma.reconciliationRecord.create({
      data: {
        paymentId: p.id,
        internalPaymentNumber: p.paymentNumber,
        internalAmount: p.amount,
        internalStatus: p.status,
        gatewayPaymentId: p.providerPaymentId,
        gatewayAmount: gateway?.amount != null ? new Prisma.Decimal(gateway.amount) : null,
        gatewayStatus: gateway?.status ?? null,
        gatewayEventId: event?.gatewayEventId ?? null,
        status: result.status,
        discrepancyType: result.discrepancyType,
        notes: result.notes,
      },
    });
    createdCount += 1;
  }

  const summary = await summarize();

  await recordAudit(prisma, {
    actor,
    action: 'RECONCILIATION_RUN',
    entity: 'ReconciliationRecord',
    newValue: { created: createdCount, summary },
    requestId,
  });

  return { created: createdCount, summary };
}

async function summarize(): Promise<Record<string, number>> {
  const grouped = await prisma.reconciliationRecord.groupBy({ by: ['status'], _count: { _all: true } });
  const out: Record<string, number> = {};
  for (const g of grouped) out[g.status] = g._count._all;
  return out;
}

export async function resolveReconciliation(id: string, input: ResolveInput, actor: Actor, requestId: string) {
  await prisma.$transaction(async (tx) => {
    const record = await tx.reconciliationRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundError('Reconciliation record not found');
    if (record.status === 'RESOLVED') {
      throw new UnprocessableError('Record is already resolved');
    }
    await tx.reconciliationRecord.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedBy: actor.sub,
        resolvedAt: new Date(),
        resolutionNotes: input.resolutionNotes,
      },
    });
    await recordAudit(tx, {
      actor,
      action: 'RECONCILIATION_RESOLVED',
      entity: 'ReconciliationRecord',
      entityId: id,
      oldValue: { status: record.status },
      newValue: { status: 'RESOLVED' },
      reason: input.resolutionNotes,
      requestId,
    });
  });
  return getReconciliationById(id);
}

const reconInclude = {
  payment: { select: { id: true, paymentNumber: true, status: true, student: { select: { fullName: true, rollNumber: true } } } },
  resolver: { select: { id: true, fullName: true } },
} satisfies Prisma.ReconciliationRecordInclude;

function serialize(r: Prisma.ReconciliationRecordGetPayload<{ include: typeof reconInclude }>) {
  return {
    ...r,
    internalAmount: r.internalAmount != null ? toNumber(r.internalAmount) : null,
    gatewayAmount: r.gatewayAmount != null ? toNumber(r.gatewayAmount) : null,
  };
}

export async function getReconciliationById(id: string) {
  const record = await prisma.reconciliationRecord.findUnique({ where: { id }, include: reconInclude });
  if (!record) throw new NotFoundError('Reconciliation record not found');
  return serialize(record);
}

export async function listReconciliation(query: ListReconQuery) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.ReconciliationRecordWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { internalPaymentNumber: { contains: query.search, mode: 'insensitive' } },
      { gatewayPaymentId: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  const [rows, total, summary] = await Promise.all([
    prisma.reconciliationRecord.findMany({ where, include: reconInclude, orderBy: { createdAt: query.sortOrder }, skip, take }),
    prisma.reconciliationRecord.count({ where }),
    summarize(),
  ]);
  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total), summary };
}
