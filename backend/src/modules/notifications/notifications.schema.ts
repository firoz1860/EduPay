import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const listNotificationsSchema = paginationSchema.extend({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
