import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const studentStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED']);

export const listStudentsSchema = paginationSchema.extend({
  status: studentStatusEnum.optional(),
  departmentId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export const createStudentSchema = z.object({
  rollNumber: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(200),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().trim().max(20).nullish(),
  departmentId: z.string().uuid().nullish(),
  courseId: z.string().uuid().nullish(),
  academicYear: z.string().trim().min(1).max(20),
  semester: z.number().int().min(1).max(12).default(1),
  status: studentStatusEnum.default('ACTIVE'),
});

export const updateStudentSchema = createStudentSchema.partial();

export type ListStudentsQuery = z.infer<typeof listStudentsSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
