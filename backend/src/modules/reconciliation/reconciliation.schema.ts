import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const listReconSchema = paginationSchema.extend({
  status: z.string().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export const resolveSchema = z.object({
  resolutionNotes: z.string().min(1).max(1000),
  markAs: z.enum(['RESOLVED']).default('RESOLVED'),
});

export type ListReconQuery = z.infer<typeof listReconSchema>;
export type ResolveInput = z.infer<typeof resolveSchema>;
