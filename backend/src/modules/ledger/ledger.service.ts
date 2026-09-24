import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { toNumber } from '../../lib/money';
import { NotFoundError } from '../../lib/errors';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { Actor } from '../../lib/actor';
import type { ListLedgerQuery } from './ledger.schema';

const ledgerInclude = {
  student: { select: { id: true, fullName: true, rollNumber: true } },
} satisfies Prisma.LedgerEntryInclude;

type LedgerRow = Prisma.LedgerEntryGetPayload<{ include: typeof ledgerInclude }>;

function serialize(entry: LedgerRow) {
  return {
    ...entry,
    amount: toNumber(entry.amount),
  };
}

export async function listLedgerEntries(query: ListLedgerQuery, actor: Actor) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.LedgerEntryWhereInput = {};

  if (query.type) where.type = query.type;
  if (query.direction) where.direction = query.direction;
  if (query.invoiceId) where.invoiceId = query.invoiceId;
  if (query.paymentId) where.paymentId = query.paymentId;

  if (actor.role === 'STUDENT') {
    where.studentId = actor.studentId ?? '__none__';
  } else if (query.studentId) {
    where.studentId = query.studentId;
  }

  const [rows, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: ledgerInclude,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total) };
}

export async function getLedgerEntryById(id: string, actor: Actor) {
  const entry = await prisma.ledgerEntry.findUnique({ where: { id }, include: ledgerInclude });
  if (!entry) throw new NotFoundError('Ledger entry not found');
  if (actor.role === 'STUDENT' && entry.studentId !== actor.studentId) {
    throw new NotFoundError('Ledger entry not found');
  }
  return serialize(entry);
}
