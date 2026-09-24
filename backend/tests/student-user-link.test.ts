import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  userFind: vi.fn(),
  studentFirst: vi.fn(),
  studentCreate: vi.fn(),
  studentFind: vi.fn(),
  deptFind: vi.fn(),
  courseFind: vi.fn(),
  invoiceAgg: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: h.userFind },
    student: { findFirst: h.studentFirst, create: h.studentCreate, findUnique: h.studentFind },
    department: { findUnique: h.deptFind },
    course: { findUnique: h.courseFind },
    invoice: { aggregate: h.invoiceAgg },
    auditLog: { create: h.auditCreate },
  },
}));

import { createStudent } from '../src/modules/students/students.service';
import { ForbiddenError, NotFoundError, ConflictError } from '../src/lib/errors';

const admin = { sub: 'a1', email: 'a@e.com', role: 'ADMIN', name: 'Admin', studentId: null } as never;
const accountant = { sub: 'ac1', email: 'ac@e.com', role: 'ACCOUNTANT', name: 'Acct', studentId: null } as never;
const baseInput = { rollNumber: 'R1', fullName: 'N', email: 'n@x.com', academicYear: '2026-2027', semester: 1, status: 'ACTIVE' } as never;
const USER = '99999999-9999-9999-9999-999999999999';

beforeEach(() => {
  vi.clearAllMocks();
  h.userFind.mockResolvedValue({ id: USER });
  h.studentFirst.mockResolvedValue(null);
  h.studentCreate.mockResolvedValue({ id: 'stu-1', rollNumber: 'R1', fullName: 'N', email: 'n@x.com', status: 'ACTIVE' });
  h.studentFind.mockResolvedValue({ id: 'stu-1', department: null, course: null });
  h.invoiceAgg.mockResolvedValue({ _count: 0, _sum: { outstandingAmount: null } });
  h.auditCreate.mockResolvedValue({});
});

describe('link a student to an existing user account (ADMIN-only)', () => {
  it('ADMIN can create a student linked to a user (persists userId)', async () => {
    await createStudent({ ...baseInput, userId: USER }, admin, 'req');
    expect(h.studentCreate).toHaveBeenCalledTimes(1);
    expect(h.studentCreate.mock.calls[0][0].data.userId).toBe(USER);
  });

  it('ACCOUNTANT cannot link a user account (403 Forbidden, nothing created)', async () => {
    await expect(createStudent({ ...baseInput, userId: USER }, accountant, 'req')).rejects.toBeInstanceOf(ForbiddenError);
    expect(h.studentCreate).not.toHaveBeenCalled();
  });

  it('rejects a userId that does not exist (404)', async () => {
    h.userFind.mockResolvedValue(null);
    await expect(createStudent({ ...baseInput, userId: USER }, admin, 'req')).rejects.toBeInstanceOf(NotFoundError);
    expect(h.studentCreate).not.toHaveBeenCalled();
  });

  it('rejects a user already linked to another student (409 Conflict)', async () => {
    h.studentFirst.mockResolvedValue({ id: 'other-student' });
    await expect(createStudent({ ...baseInput, userId: USER }, admin, 'req')).rejects.toBeInstanceOf(ConflictError);
    expect(h.studentCreate).not.toHaveBeenCalled();
  });

  it('creating without a userId still works and does not touch user lookups', async () => {
    await createStudent({ ...baseInput }, admin, 'req');
    expect(h.userFind).not.toHaveBeenCalled();
    expect(h.studentCreate.mock.calls[0][0].data.userId).toBeNull();
  });
});
