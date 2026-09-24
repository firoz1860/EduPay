import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { NotFoundError } from '../../lib/errors';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { ListAuditQuery } from './audit.schema';

export async function listAuditLogs(query: ListAuditQuery) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.AuditLogWhereInput = {};

  if (query.entity) where.entity = query.entity;
  if (query.action) where.action = query.action;
  if (query.actorId) where.actorId = query.actorId;
  if (query.entityId) where.entityId = query.entityId;
  if (query.search) {
    where.OR = [
      { action: { contains: query.search, mode: 'insensitive' } },
      { entity: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: query.sortOrder }, skip, take }),
    prisma.auditLog.count({ where }),
  ]);

  return { data: rows, meta: buildMeta(query.page, query.pageSize, total) };
}

export async function getAuditLogById(id: string) {
  const entry = await prisma.auditLog.findUnique({ where: { id } });
  if (!entry) throw new NotFoundError('Audit log not found');
  return entry;
}
