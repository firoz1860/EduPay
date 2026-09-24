import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

/** Amounts are provided in major currency units (e.g. rupees) with up to 2 dp. */
const amount = z
  .number({ invalid_type_error: 'amount must be a number' })
  .positive('amount must be positive')
  .max(100_000_000, 'amount is unreasonably large')
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: 'amount may have at most 2 decimal places',
  });

export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  installmentId: z.string().uuid().nullish(),
  amount,
  method: z.string().min(1).max(40).default('card'),
  allowOverpayment: z.boolean().default(false),
});

/** Dev/demo settlement of a simulated payment (used when real Stripe is not configured). */
export const simulateSchema = z.object({
  outcome: z.enum(['success', 'fail']).default('success'),
  failureReason: z.string().max(200).optional(),
});

export const listPaymentsSchema = paginationSchema.extend({
  status: z.string().optional(),
  invoiceId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type SimulateInput = z.infer<typeof simulateSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsSchema>;
