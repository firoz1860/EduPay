import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

const money2 = z
  .number()
  .nonnegative()
  .max(100_000_000)
  .refine((n) => Math.round(n * 100) === n * 100, 'at most 2 decimal places');

const itemSchema = z.object({
  feeHeadId: z.string().uuid().nullish(),
  feeHeadName: z.string().min(1).max(120),
  amount: money2,
  discountAmount: money2.default(0),
  discountLabel: z.string().max(120).nullish(),
});

export const createInvoiceSchema = z
  .object({
    studentId: z.string().uuid(),
    feeStructureId: z.string().uuid().nullish(),
    academicYear: z.string().min(1).max(20).optional(),
    semester: z.number().int().min(1).max(12).optional(),
    items: z.array(itemSchema).optional(),
    taxAmount: money2.default(0),
    dueDate: z.string().datetime().or(z.string().date()).nullish(),
    notes: z.string().max(1000).nullish(),
    issue: z.boolean().default(true),
    installmentCount: z.number().int().min(1).max(12).optional(),
  })
  .refine((v) => v.feeStructureId || (v.items && v.items.length > 0), {
    message: 'Provide either feeStructureId or at least one line item',
    path: ['items'],
  });

export const listInvoicesSchema = paginationSchema.extend({
  status: z.string().optional(),
  studentId: z.string().uuid().optional(),
  academicYear: z.string().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export const cancelSchema = z.object({ reason: z.string().max(500).optional() });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesSchema>;
