import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { hashPassword } from '../../lib/password';
import { NotFoundError } from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { Actor } from '../../lib/actor';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schema';

/** Explicit safe select — passwordHash must never leave this module. */
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export async function createUser(input: CreateUserInput, actor: Actor, requestId: string) {
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        isActive: input.isActive,
      },
      select: userSelect,
    });

    await recordAudit(tx, {
      actor,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: created.id,
      newValue: { email: created.email, role: created.role },
      requestId,
    });

    return created;
  });

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput, _actor: Actor, _requestId: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('User not found');

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      fullName: input.fullName ?? undefined,
      role: input.role ?? undefined,
      isActive: input.isActive ?? undefined,
      avatarUrl: input.avatarUrl === undefined ? undefined : input.avatarUrl,
      passwordHash,
    },
    select: userSelect,
  });

  return updated;
}

export async function getUserById(id: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function listUsers(query: ListUsersQuery) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { fullName: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);
  return { data: rows, meta: buildMeta(query.page, query.pageSize, total) };
}
