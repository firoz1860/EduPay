import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { round2, sub, add, toNumber } from '../../lib/money';
import { NotFoundError } from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { Actor } from '../../lib/actor';
import type {
  CreateFeeStructureInput,
  ListFeeStructuresQuery,
  UpdateFeeStructureInput,
} from './feeStructures.schema';

const feeStructureInclude = {
  items: {
    include: { feeHead: { select: { id: true, name: true, code: true } } },
    orderBy: { sortOrder: 'asc' as const },
  },
  department: { select: { id: true, name: true } },
  course: { select: { id: true, name: true } },
} satisfies Prisma.FeeStructureInclude;

type FeeStructureRow = Prisma.FeeStructureGetPayload<{ include: typeof feeStructureInclude }>;

function serialize(structure: FeeStructureRow) {
  return {
    ...structure,
    totalAmount: toNumber(structure.totalAmount),
    items: structure.items.map((it) => ({
      ...it,
      amount: toNumber(it.amount),
      discountAmount: toNumber(it.discountAmount),
    })),
  };
}

export async function createFeeStructure(
  input: CreateFeeStructureInput,
  actor: Actor,
  requestId: string,
) {
  const items = input.items.map((it, idx) => ({
    feeHeadId: it.feeHeadId,
    amount: round2(it.amount),
    discountAmount: round2(it.discountAmount ?? 0),
    discountLabel: it.discountLabel ?? null,
    sortOrder: idx,
  }));

  const totalAmount = add(...items.map((it) => sub(it.amount, it.discountAmount)));

  const structure = await prisma.$transaction(async (tx) => {
    const created = await tx.feeStructure.create({
      data: {
        name: input.name,
        departmentId: input.departmentId ?? null,
        courseId: input.courseId ?? null,
        academicYear: input.academicYear,
        semester: input.semester,
        status: input.status,
        totalAmount,
        createdBy: actor.sub,
        items: {
          create: items.map((it) => ({
            feeHeadId: it.feeHeadId,
            amount: it.amount,
            discountAmount: it.discountAmount,
            discountLabel: it.discountLabel,
            sortOrder: it.sortOrder,
          })),
        },
      },
    });

    await recordAudit(tx, {
      actor,
      action: 'FEE_STRUCTURE_CREATED',
      entity: 'FeeStructure',
      entityId: created.id,
      newValue: {
        name: created.name,
        totalAmount: toNumber(totalAmount),
      },
      requestId,
    });

    return created;
  });

  return getFeeStructureById(structure.id);
}

export async function updateFeeStructure(
  id: string,
  input: UpdateFeeStructureInput,
  actor: Actor,
  requestId: string,
) {
  const existing = await prisma.feeStructure.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Fee structure not found');

  await prisma.$transaction(async (tx) => {
    await tx.feeStructure.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        status: input.status ?? undefined,
        academicYear: input.academicYear ?? undefined,
        semester: input.semester ?? undefined,
      },
    });

    await recordAudit(tx, {
      actor,
      action: 'FEE_UPDATED',
      entity: 'FeeStructure',
      entityId: id,
      oldValue: {
        name: existing.name,
        status: existing.status,
        academicYear: existing.academicYear,
        semester: existing.semester,
      },
      newValue: input,
      requestId,
    });
  });

  return getFeeStructureById(id);
}

export async function getFeeStructureById(id: string) {
  const structure = await prisma.feeStructure.findUnique({
    where: { id },
    include: feeStructureInclude,
  });
  if (!structure) throw new NotFoundError('Fee structure not found');
  return serialize(structure);
}

export async function listFeeStructures(query: ListFeeStructuresQuery) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.FeeStructureWhereInput = {};
  if (query.academicYear) where.academicYear = query.academicYear;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.courseId) where.courseId = query.courseId;
  if (query.status) where.status = query.status;
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }

  const [rows, total] = await Promise.all([
    prisma.feeStructure.findMany({
      where,
      include: feeStructureInclude,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take,
    }),
    prisma.feeStructure.count({ where }),
  ]);
  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total) };
}
