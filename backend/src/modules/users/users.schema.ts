import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const userRoleSchema = z.enum([
  'STUDENT',
  'ACCOUNTANT',
  'FINANCE_MANAGER',
  'ADMIN',
  'AUDITOR',
]);

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(1).max(200),
  role: userRoleSchema,
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    avatarUrl: z.string().url().max(500).nullish(),
    password: z.string().min(8).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const listUsersSchema = paginationSchema.extend({
  role: userRoleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
