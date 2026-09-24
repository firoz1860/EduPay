import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const listDepartmentsSchema = paginationSchema;

export const idParamSchema = z.object({ id: z.string().uuid() });

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(30),
  description: z.string().trim().max(1000).nullish(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createCourseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(30),
  durationYears: z.number().int().min(1).max(10).default(3),
});

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
