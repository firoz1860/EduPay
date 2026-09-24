import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

const money2 = z
  .number()
  .nonnegative()
  .max(100_000_000)
  .refine((n) => Math.round(n * 100) === n * 100, 'at most 2 decimal places');

const feeStructureStatus = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);

const itemSchema = z.object({
  feeHeadId: z.string().uuid(),
  amount: money2,
  discountAmount: money2.default(0),
  discountLabel: z.string().max(120).nullish(),
});

export const createFeeStructureSchema = z.object({
  name: z.string().min(1).max(200),
  departmentId: z.string().uuid().nullish(),
  courseId: z.string().uuid().nullish(),
  academicYear: z.string().min(1).max(20),
  semester: z.number().int().min(1).max(12).default(1),
  status: feeStructureStatus.default('ACTIVE'),
  items: z.array(itemSchema).min(1, 'At least one fee structure item is required'),
});

export const updateFeeStructureSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    status: feeStructureStatus.optional(),
    academicYear: z.string().min(1).max(20).optional(),
    semester: z.number().int().min(1).max(12).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const listFeeStructuresSchema = paginationSchema.extend({
  academicYear: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  status: feeStructureStatus.optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;
export type ListFeeStructuresQuery = z.infer<typeof listFeeStructuresSchema>;
