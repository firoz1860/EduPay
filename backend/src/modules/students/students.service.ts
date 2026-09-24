import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { toNumber } from '../../lib/money';
import { NotFoundError, ForbiddenError, ConflictError } from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import { UNMATCHABLE_UUID, type Actor } from '../../lib/actor';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './students.schema';

function assertSelfOrStaff(actor: Actor, studentId: string): void {
  if (actor.role === 'STUDENT' && actor.studentId !== studentId) {
    throw new ForbiddenError('You can only access your own student record');
  }
}

async function assertDepartmentExists(departmentId: string | null | undefined): Promise<void> {
  if (!departmentId) return;
  const exists = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Department not found');
}

async function assertCourseExists(courseId: string | null | undefined): Promise<void> {
  if (!courseId) return;
  const exists = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Course not found');
}

const studentInclude = {
  department: { select: { id: true, name: true, code: true } },
  course: { select: { id: true, name: true, code: true } },
} satisfies Prisma.StudentInclude;

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

function serialize(student: StudentRow) {
  return { ...student };
}

export async function listStudents(query: ListStudentsQuery, actor: Actor) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.StudentWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.courseId) where.courseId = query.courseId;
  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { rollNumber: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  // Students only ever see their own record.
  if (actor.role === 'STUDENT') where.id = actor.studentId ?? UNMATCHABLE_UUID;

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take,
    }),
    prisma.student.count({ where }),
  ]);
  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total) };
}

export async function getStudentById(id: string, actor: Actor) {
  assertSelfOrStaff(actor, id);

  const student = await prisma.student.findUnique({ where: { id }, include: studentInclude });
  if (!student) throw new NotFoundError('Student not found');

  const invoiceAgg = await prisma.invoice.aggregate({
    where: { studentId: id },
    _count: true,
    _sum: { outstandingAmount: true },
  });

  return {
    ...serialize(student),
    invoiceSummary: {
      count: invoiceAgg._count,
      outstandingTotal: toNumber(invoiceAgg._sum.outstandingAmount),
    },
  };
}

export async function createStudent(input: CreateStudentInput, actor: Actor, requestId: string) {
  await Promise.all([assertDepartmentExists(input.departmentId), assertCourseExists(input.courseId)]);

  let created;
  try {
    created = await prisma.student.create({
      data: {
        rollNumber: input.rollNumber,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        departmentId: input.departmentId ?? null,
        courseId: input.courseId ?? null,
        academicYear: input.academicYear,
        semester: input.semester,
        status: input.status,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A student with this roll number or email already exists');
    }
    throw err;
  }

  await recordAudit(prisma, {
    actor,
    action: 'STUDENT_CREATED',
    entity: 'Student',
    entityId: created.id,
    newValue: {
      rollNumber: created.rollNumber,
      fullName: created.fullName,
      email: created.email,
      status: created.status,
    },
    requestId,
  });

  return getStudentById(created.id, actor);
}

export async function updateStudent(
  id: string,
  input: UpdateStudentInput,
  actor: Actor,
  requestId: string,
) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Student not found');

  await Promise.all([assertDepartmentExists(input.departmentId), assertCourseExists(input.courseId)]);

  const data: Prisma.StudentUpdateInput = {};
  if (input.rollNumber !== undefined) data.rollNumber = input.rollNumber;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.departmentId !== undefined) {
    data.department = input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true };
  }
  if (input.courseId !== undefined) {
    data.course = input.courseId ? { connect: { id: input.courseId } } : { disconnect: true };
  }
  if (input.academicYear !== undefined) data.academicYear = input.academicYear;
  if (input.semester !== undefined) data.semester = input.semester;
  if (input.status !== undefined) data.status = input.status;

  let updated;
  try {
    updated = await prisma.student.update({ where: { id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A student with this roll number or email already exists');
    }
    throw err;
  }

  await recordAudit(prisma, {
    actor,
    action: 'STUDENT_UPDATED',
    entity: 'Student',
    entityId: id,
    oldValue: {
      rollNumber: existing.rollNumber,
      fullName: existing.fullName,
      email: existing.email,
      phone: existing.phone,
      departmentId: existing.departmentId,
      courseId: existing.courseId,
      academicYear: existing.academicYear,
      semester: existing.semester,
      status: existing.status,
    },
    newValue: {
      rollNumber: updated.rollNumber,
      fullName: updated.fullName,
      email: updated.email,
      phone: updated.phone,
      departmentId: updated.departmentId,
      courseId: updated.courseId,
      academicYear: updated.academicYear,
      semester: updated.semester,
      status: updated.status,
    },
    requestId,
  });

  return getStudentById(id, actor);
}
