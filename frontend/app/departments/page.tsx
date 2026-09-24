'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Department, Course } from '@/types';
import { Building2, Plus, BookOpen, Users, ChevronDown, ChevronRight, Loader2, GraduationCap } from 'lucide-react';

export default function DepartmentsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deptOpen, setDeptOpen] = useState(false);
  const [courseFor, setCourseFor] = useState<Department | null>(null);

  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [courseForm, setCourseForm] = useState({ name: '', code: '', durationYears: 4 });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['departments', search],
    queryFn: async () => (await api.get<Department[]>('/departments', { pageSize: 100, search: search || undefined })).data,
  });

  const createDept = useMutation({
    mutationFn: async () =>
      api.post('/departments', {
        name: deptForm.name.trim(),
        code: deptForm.code.trim(),
        description: deptForm.description.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Department created');
      setDeptOpen(false);
      setDeptForm({ name: '', code: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to create department'),
  });

  const createCourse = useMutation({
    mutationFn: async () => {
      if (!courseFor) return;
      return api.post(`/departments/${courseFor.id}/courses`, {
        name: courseForm.name.trim(),
        code: courseForm.code.trim(),
        durationYears: Number(courseForm.durationYears),
      });
    },
    onSuccess: () => {
      toast.success('Course added');
      const id = courseFor?.id;
      setCourseFor(null);
      setCourseForm({ name: '', code: '', durationYears: 4 });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      if (id) queryClient.invalidateQueries({ queryKey: ['courses', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to add course'),
  });

  const departments = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments & Courses"
        description="Manage academic departments and their courses"
        action={
          canManage ? (
            <Button onClick={() => setDeptOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Department
            </Button>
          ) : undefined
        }
      />

      <Input
        placeholder="Search departments…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="grid gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : isError ? (
        <p className="text-sm text-rose-600">{error instanceof ApiError ? error.message : 'Failed to load departments.'}</p>
      ) : departments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">No departments configured yet.</p>
            {canManage && (
              <Button size="sm" onClick={() => setDeptOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create your first department
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {departments.map((d) => (
            <DepartmentCard
              key={d.id}
              department={d}
              expanded={expanded === d.id}
              onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
              canManage={canManage}
              onAddCourse={() => setCourseFor(d)}
            />
          ))}
        </div>
      )}

      {/* Create Department */}
      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
            <DialogDescription>Add an academic department.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">Name</Label>
              <Input id="d-name" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="Computer Science" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-code">Code</Label>
              <Input id="d-code" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder="CSE" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-desc">Description (optional)</Label>
              <Input id="d-desc" value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} placeholder="School of Computing" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeptOpen(false)}>Cancel</Button>
            <Button onClick={() => createDept.mutate()} disabled={!deptForm.name.trim() || !deptForm.code.trim() || createDept.isPending}>
              {createDept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Course */}
      <Dialog open={!!courseFor} onOpenChange={(o) => !o && setCourseFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Course</DialogTitle>
            <DialogDescription>{courseFor ? `Add a course to ${courseFor.name}.` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="B.Tech CSE" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-code">Code</Label>
                <Input id="c-code" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="BT-CSE" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-years">Duration (years)</Label>
                <Input id="c-years" type="number" min={1} max={10} value={courseForm.durationYears} onChange={(e) => setCourseForm({ ...courseForm, durationYears: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCourseFor(null)}>Cancel</Button>
            <Button onClick={() => createCourse.mutate()} disabled={!courseForm.name.trim() || !courseForm.code.trim() || createCourse.isPending}>
              {createCourse.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DepartmentCard({
  department, expanded, onToggle, canManage, onAddCourse,
}: {
  department: Department;
  expanded: boolean;
  onToggle: () => void;
  canManage: boolean;
  onAddCourse: () => void;
}) {
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', department.id],
    queryFn: async () => (await api.get<Course[]>(`/departments/${department.id}/courses`)).data,
    enabled: expanded,
  });

  return (
    <Card>
      <CardContent className="p-0">
        <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{department.name}</p>
              <p className="text-xs text-muted-foreground">Code: {department.code}{department.description ? ` • ${department.description}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
              <Users className="h-3 w-3" /> {department._count?.students ?? 0}
            </span>
            <span className="hidden items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
              <BookOpen className="h-3 w-3" /> {department._count?.courses ?? 0}
            </span>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Courses</p>
              {canManage && (
                <Button variant="outline" size="sm" onClick={onAddCourse}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add course
                </Button>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (courses ?? []).length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No courses in this department yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(courses ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md border p-2.5">
                    <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.code} • {c.durationYears} yr</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
