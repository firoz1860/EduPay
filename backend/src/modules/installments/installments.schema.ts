import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const listInstallmentsSchema = paginationSchema.extend({
  invoiceId: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type ListInstallmentsQuery = z.infer<typeof listInstallmentsSchema>;
