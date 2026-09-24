import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import type { JwtPayload } from '../lib/jwt';

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_CREATED'
  | 'STUDENT_CREATED'
  | 'STUDENT_UPDATED'
  | 'FEE_STRUCTURE_CREATED'
  | 'FEE_UPDATED'
  | 'DISCOUNT_APPLIED'
  | 'INVOICE_CREATED'
  | 'INVOICE_ISSUED'
  | 'INVOICE_CANCELLED'
  | 'INVOICE_UPDATED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'REFUND_CREATED'
  | 'REFUND_APPROVED'
  | 'REFUND_COMPLETED'
  | 'REFUND_FAILED'
  | 'RECONCILIATION_RUN'
  | 'RECONCILIATION_RESOLVED'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_DUPLICATE'
  | 'AI_PROVIDER_CONNECTED'
  | 'AI_PROVIDER_DISCONNECTED';

export interface AuditInput {
  actor?: Pick<JwtPayload, 'sub' | 'name' | 'role'> | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  requestId?: string | null;
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Append an immutable audit log entry. Accepts an optional transaction client
 * so financial state changes and their audit trail commit atomically.
 * Audit rows are never updated or deleted (immutable by convention + no such API here).
 */
export async function recordAudit(client: Tx | typeof prisma, input: AuditInput): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actor?.sub ?? null,
      actorName: input.actor?.name ?? null,
      actorRole: input.actor?.role ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: toJson(input.oldValue),
      newValue: toJson(input.newValue),
      reason: input.reason ?? null,
      requestId: input.requestId ?? null,
    },
  });
}
