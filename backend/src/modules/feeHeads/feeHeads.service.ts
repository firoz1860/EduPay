import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { CreateFeeHeadInput, ListFeeHeadsQuery, UpdateFeeHeadInput } from './feeHeads.schema';

export async function listFeeHeads(query: ListFeeHeadsQuery) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.FeeHeadWhereInput = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.feeHead.findMany({ where, orderBy: { createdAt: query.sortOrder }, skip, take }),
    prisma.feeHead.count({ where }),
  ]);
  return { data: rows, meta: buildMeta(query.page, query.pageSize, total) };
}

export async function getFeeHeadById(id: string) {
  const feeHead = await prisma.feeHead.findUnique({ where: { id } });
  if (!feeHead) throw new NotFoundError('Fee head not found');
  return feeHead;
}

export async function createFeeHead(input: CreateFeeHeadInput) {
  try {
    return await prisma.feeHead.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description ?? null,
        isOptional: input.isOptional,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A fee head with this code already exists');
    }
    throw err;
  }
}

export async function updateFeeHead(id: string, input: UpdateFeeHeadInput) {
  const existing = await prisma.feeHead.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Fee head not found');

  try {
    return await prisma.feeHead.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        code: input.code ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        isOptional: input.isOptional ?? undefined,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A fee head with this code already exists');
    }
    throw err;
  }
}
