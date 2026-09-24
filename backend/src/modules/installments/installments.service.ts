import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { toNumber } from '../../lib/money';
import { NotFoundError } from '../../lib/errors';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { Actor } from '../../lib/actor';
import type { ListInstallmentsQuery } from './installments.schema';

const installmentInclude = {
  invoice: { select: { id: true, invoiceNumber: true, studentId: true } },
} satisfies Prisma.InstallmentInclude;

type InstallmentRow = Prisma.InstallmentGetPayload<{ include: typeof installmentInclude }>;

function serialize(installment: InstallmentRow) {
  return {
    ...installment,
    amount: toNumber(installment.amount),
    paidAmount: toNumber(installment.paidAmount),
    outstandingAmount: toNumber(installment.outstandingAmount),
  };
}

export async function listInstallments(query: ListInstallmentsQuery, actor: Actor) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.InstallmentWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.invoiceId) where.invoiceId = query.invoiceId;

  if (actor.role === 'STUDENT') {
    where.invoice = { studentId: actor.studentId ?? '__none__' };
  }

  const [rows, total] = await Promise.all([
    prisma.installment.findMany({
      where,
      include: installmentInclude,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take,
    }),
    prisma.installment.count({ where }),
  ]);

  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total) };
}

export async function getInstallmentById(id: string, actor: Actor) {
  const installment = await prisma.installment.findUnique({ where: { id }, include: installmentInclude });
  if (!installment) throw new NotFoundError('Installment not found');
  if (actor.role === 'STUDENT' && installment.invoice.studentId !== actor.studentId) {
    throw new NotFoundError('Installment not found');
  }
  return serialize(installment);
}
