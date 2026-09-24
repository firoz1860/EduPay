import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import type { Actor } from '../../lib/actor';
import type {
  CreateCourseInput,
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from './departments.schema';

const departmentListInclude = {
  _count: { select: { students: true, courses: true } },
} satisfies Prisma.DepartmentInclude;

const departmentDetailInclude = {
  courses: { orderBy: { name: 'asc' as const } },
  _count: { select: { students: true, courses: true } },
} satisfies Prisma.DepartmentInclude;

export async function listDepartments(query: ListDepartmentsQuery) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.DepartmentWhereInput = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.department.findMany({
      where,
      include: departmentListInclude,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take,
    }),
    prisma.department.count({ where }),
  ]);
  return { data: rows, meta: buildMeta(query.page, query.pageSize, total) };
}

export async function getDepartmentById(id: string) {
  const department = await prisma.department.findUnique({ where: { id }, include: departmentDetailInclude });
  if (!department) throw new NotFoundError('Department not found');
  return department;
}

export async function createDepartment(input: CreateDepartmentInput, actor: Actor, requestId: string) {
  let created;
  try {
    created = await prisma.department.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A department with this code already exists');
    }
    throw err;
  }

  return getDepartmentById(created.id);
}

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
  actor: Actor,
  requestId: string,
) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Department not found');

  let updated;
  try {
    updated = await prisma.department.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        code: input.code ?? undefined,
        description: input.description === undefined ? undefined : input.description,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A department with this code already exists');
    }
    throw err;
  }

  return getDepartmentById(id);
}

export async function listCoursesByDepartment(departmentId: string) {
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  if (!department) throw new NotFoundError('Department not found');

  return prisma.course.findMany({ where: { departmentId }, orderBy: { name: 'asc' } });
}

export async function createCourseInDepartment(
  departmentId: string,
  input: CreateCourseInput,
  actor: Actor,
  requestId: string,
) {
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  if (!department) throw new NotFoundError('Department not found');

  let created;
  try {
    created = await prisma.course.create({
      data: {
        name: input.name,
        code: input.code,
        durationYears: input.durationYears,
        departmentId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A course with this code already exists');
    }
    throw err;
  }

  return created;
}
