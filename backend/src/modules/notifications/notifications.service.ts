import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { NotFoundError } from '../../lib/errors';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import { emitToUsers, emitToRoles } from '../../realtime/socket';
import type { Actor } from '../../lib/actor';

export interface NotifyInput {
  /** Explicit recipient user ids (nulls/undefined are ignored). */
  userIds?: (string | null | undefined)[];
  /** Roles that should receive a personal notification. */
  roles?: string[];
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string | null;
  /** TanStack Query keys to invalidate on the client for live refresh. */
  invalidate?: string[];
  /** Roles that should get the live-refresh signal without a stored notification. */
  invalidateRoles?: string[];
}

function serialize(n: {
  id: string; type: string; title: string; message: string;
  entityType: string | null; entityId: string | null; read: boolean; createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    entityType: n.entityType,
    entityId: n.entityId,
    read: n.read,
    createdAt: n.createdAt,
  };
}

/**
 * Persist a notification for each recipient and push it over the socket, plus a
 * live-refresh ("invalidate") signal so open dashboards/tables update instantly.
 * Never part of a financial transaction — safe to call after commit.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const roleUserIds = input.roles?.length
    ? (
        await prisma.user.findMany({
          where: { role: { in: input.roles }, isActive: true },
          select: { id: true },
        })
      ).map((u) => u.id)
    : [];

  const recipients = Array.from(
    new Set([...(input.userIds ?? []), ...roleUserIds].filter((x): x is string => !!x)),
  );

  for (const userId of recipients) {
    const n = await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
    emitToUsers([userId], 'notification', serialize(n));
  }

  if (input.invalidate?.length) {
    const payload = { keys: input.invalidate };
    emitToUsers(recipients, 'invalidate', payload);
    const invRoles = input.invalidateRoles ?? input.roles ?? [];
    if (invRoles.length) emitToRoles(invRoles, 'invalidate', payload);
  }
}

const listSelect = {
  id: true, type: true, title: true, message: true,
  entityType: true, entityId: true, read: true, createdAt: true,
} satisfies Prisma.NotificationSelect;

export async function listNotifications(actor: Actor, page: number, pageSize: number, unreadOnly: boolean) {
  const { skip, take } = toSkipTake(page, pageSize);
  const where: Prisma.NotificationWhereInput = { userId: actor.sub };
  if (unreadOnly) where.read = false;

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, select: listSelect, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: actor.sub, read: false } }),
  ]);

  return { data: rows.map(serialize), meta: buildMeta(page, pageSize, total), unreadCount };
}

export async function unreadCount(actor: Actor): Promise<number> {
  return prisma.notification.count({ where: { userId: actor.sub, read: false } });
}

export async function markRead(actor: Actor, id: string) {
  const existing = await prisma.notification.findFirst({ where: { id, userId: actor.sub } });
  if (!existing) throw new NotFoundError('Notification not found');
  const updated = await prisma.notification.update({ where: { id }, data: { read: true }, select: listSelect });
  return serialize(updated);
}

export async function markAllRead(actor: Actor): Promise<{ updated: number }> {
  const res = await prisma.notification.updateMany({
    where: { userId: actor.sub, read: false },
    data: { read: true },
  });
  return { updated: res.count };
}
