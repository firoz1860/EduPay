import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const listAuditSchema = paginationSchema.extend({
  entity: z.string().optional(),
  action: z.string().optional(),
  actorId: z.string().uuid().optional(),
  entityId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type ListAuditQuery = z.infer<typeof listAuditSchema>;
