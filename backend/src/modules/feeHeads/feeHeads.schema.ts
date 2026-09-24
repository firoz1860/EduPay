import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const listFeeHeadsSchema = paginationSchema;

export const idParamSchema = z.object({ id: z.string().uuid() });

export const createFeeHeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(30),
  description: z.string().trim().max(1000).nullish(),
  isOptional: z.boolean().default(false),
});

export const updateFeeHeadSchema = createFeeHeadSchema.partial();

export type ListFeeHeadsQuery = z.infer<typeof listFeeHeadsSchema>;
export type CreateFeeHeadInput = z.infer<typeof createFeeHeadSchema>;
export type UpdateFeeHeadInput = z.infer<typeof updateFeeHeadSchema>;
