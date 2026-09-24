'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { STUDENT_STATUS_COLORS, STUDENT_STATUS_LABELS } from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import type { Student, StudentStatus, Department, Course } from '@/types';
import { Search, ChevronRight, ChevronLeft, Plus, Loader2 } from 'lucide-react';

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'ACCOUNTANT');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StudentStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['students', { search, status, page }],
    queryFn: () =>
      api.get<Student[]>('/students', {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  const students = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student records"
        action={canManage ? <NewStudentDialog /> : undefined}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll number, or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as StudentStatus | 'ALL');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load students. Please try again.
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !isError ? (
        <>
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-sm">{student.rollNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{student.department?.name || '-'}</TableCell>
                    <TableCell>{student.course?.name || '-'}</TableCell>
                    <TableCell>Sem {student.semester}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STUDENT_STATUS_COLORS[student.status]}`}>
                        {STUDENT_STATUS_LABELS[student.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/students/${student.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {students.map((student) => (
              <Link key={student.id} href={`/students/${student.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{student.rollNumber}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STUDENT_STATUS_COLORS[student.status]}`}>
                        {STUDENT_STATUS_LABELS[student.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span>{student.department?.name || '-'}</span>
                      <span>Sem {student.semester}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {students.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No students found</div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} • {meta.total} students
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

const emptyStudent = {
  rollNumber: '', fullName: '', email: '', phone: '',
  departmentId: '', courseId: '', academicYear: '', semester: '1', status: 'ACTIVE', userId: '',
};

interface LinkableUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

function NewStudentDialog() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyStudent });

  // Departments loaded dynamically from the API (never hardcoded).
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments', { pageSize: 100 })).data,
    enabled: open,
  });

  // Eligible user accounts to link (ADMIN only; /users is an admin-only endpoint).
  const { data: linkableUsers } = useQuery({
    queryKey: ['users', 'linkable'],
    queryFn: async () => (await api.get<LinkableUser[]>('/users', { pageSize: 100 })).data,
    enabled: open && isAdmin,
  });

  // Courses for the chosen department, loaded on demand.
  const { data: courses } = useQuery({
    queryKey: ['courses', form.departmentId],
    queryFn: async () => (await api.get<Course[]>(`/departments/${form.departmentId}/courses`)).data,
    enabled: open && !!form.departmentId,
  });

  const create = useMutation({
    mutationFn: async () =>
      api.post('/students', {
        rollNumber: form.rollNumber.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        departmentId: form.departmentId || undefined,
        courseId: form.courseId || undefined,
        academicYear: form.academicYear.trim(),
        semester: Number(form.semester) || 1,
        status: form.status,
        userId: form.userId || undefined,
      }),
    onSuccess: () => {
      toast.success('Student created');
      setForm({ ...emptyStudent });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to create student'),
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.rollNumber.trim() && form.fullName.trim() && form.email.trim() && form.academicYear.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New Student
      </Button>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Student</DialogTitle>
          <DialogDescription>Create a student record. It is stored via the backend API.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Roll number</Label>
            <Input value={form.rollNumber} onChange={(e) => set('rollNumber', e.target.value)} placeholder="CSE2026001" />
          </div>
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@school.edu" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (optional)</Label>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91…" />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={form.departmentId} onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v, courseId: '' }))}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {(departments ?? []).length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No departments — create one first</div>
                ) : (
                  (departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={form.courseId} onValueChange={(v) => set('courseId', v)} disabled={!form.departmentId}>
              <SelectTrigger><SelectValue placeholder={form.departmentId ? 'Select course' : 'Select a department first'} /></SelectTrigger>
              <SelectContent>
                {(courses ?? []).length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No courses in this department</div>
                ) : (
                  (courses ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Link to user account (optional)</Label>
              <Select value={form.userId || 'none'} onValueChange={(v) => set('userId', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">Not linked</SelectItem>
                  {(linkableUsers ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.email} — {u.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Links this student to an existing login so that user sees their own invoices and payments.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Academic year</Label>
            <Input value={form.academicYear} onChange={(e) => set('academicYear', e.target.value)} placeholder="2026-2027" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Input type="number" min={1} max={12} value={form.semester} onChange={(e) => set('semester', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
