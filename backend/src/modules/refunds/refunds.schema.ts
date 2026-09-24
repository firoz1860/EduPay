import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

const money2 = z
  .number()
  .positive()
  .max(100_000_000)
  .refine((n) => Math.round(n * 100) === n * 100, 'at most 2 decimal places');

export const createRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: money2,
  reason: z.string().min(1).max(500),
});

export const listRefundsSchema = paginationSchema.extend({
  status: z.string().optional(),
  paymentId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
export const decisionSchema = z.object({ notes: z.string().max(500).optional() });

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type ListRefundsQuery = z.infer<typeof listRefundsSchema>;
