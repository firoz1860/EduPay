import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const listLedgerSchema = paginationSchema.extend({
  type: z.string().optional(),
  direction: z.string().optional(),
  studentId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type ListLedgerQuery = z.infer<typeof listLedgerSchema>;
