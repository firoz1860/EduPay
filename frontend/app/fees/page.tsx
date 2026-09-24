'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import type { FeeStructure, Department, Course, FeeHead } from '@/types';
import { BookOpen, Plus, Trash2, Loader2 } from 'lucide-react';

export default function FeesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'ACCOUNTANT');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => api.get<FeeStructure[]>('/fee-structures', { pageSize: 100 }),
  });

  const structures = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Structures"
        description="Manage fee structures and fee heads"
        action={canManage ? <NewFeeStructureDialog /> : undefined}
      />

      {isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load fee structures. Please try again.
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : structures.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No fee structures found</div>
      ) : (
        <div className="space-y-4">
          {structures.map((fs) => (
            <Card key={fs.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{fs.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {fs.department?.name || 'All departments'} • {fs.course?.name || 'All courses'} • {fs.academicYear} • Sem {fs.semester}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(Number(fs.totalAmount))}</p>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{fs.status}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fee Head</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fs.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.feeHead?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.amount))}</TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {Number(item.discountAmount) > 0 ? `-${formatCurrency(Number(item.discountAmount))}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(item.amount) - Number(item.discountAmount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface ItemRow {
  feeHeadId: string;
  amount: string;
  discountAmount: string;
}

function NewFeeStructureDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('1');
  const [departmentId, setDepartmentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ feeHeadId: '', amount: '', discountAmount: '' }]);
  const [newHead, setNewHead] = useState({ name: '', code: '' });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments', { pageSize: 100 })).data,
    enabled: open,
  });
  const { data: courses } = useQuery({
    queryKey: ['courses', departmentId],
    queryFn: async () => (await api.get<Course[]>(`/departments/${departmentId}/courses`)).data,
    enabled: open && !!departmentId,
  });
  const { data: feeHeads } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: async () => (await api.get<FeeHead[]>('/fee-heads', { pageSize: 100 })).data,
    enabled: open,
  });

  const addHead = useMutation({
    mutationFn: async () => api.post<FeeHead>('/fee-heads', { name: newHead.name.trim(), code: newHead.code.trim() }),
    onSuccess: () => {
      toast.success('Fee head added');
      setNewHead({ name: '', code: '' });
      queryClient.invalidateQueries({ queryKey: ['fee-heads'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to add fee head'),
  });

  const create = useMutation({
    mutationFn: async () =>
      api.post('/fee-structures', {
        name: name.trim(),
        academicYear: academicYear.trim(),
        semester: Number(semester) || 1,
        departmentId: departmentId || undefined,
        courseId: courseId || undefined,
        items: items
          .filter((it) => it.feeHeadId && Number(it.amount) > 0)
          .map((it) => ({
            feeHeadId: it.feeHeadId,
            amount: Number(it.amount),
            discountAmount: Number(it.discountAmount) || 0,
          })),
      }),
    onSuccess: () => {
      toast.success('Fee structure created');
      setOpen(false);
      setName(''); setAcademicYear(''); setSemester('1'); setDepartmentId(''); setCourseId('');
      setItems([{ feeHeadId: '', amount: '', discountAmount: '' }]);
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to create fee structure'),
  });

  const updateItem = (i: number, k: keyof ItemRow, v: string) =>
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const preview = items.reduce((s, it) => s + (Number(it.amount) || 0) - (Number(it.discountAmount) || 0), 0);
  const validItems = items.filter((it) => it.feeHeadId && Number(it.amount) > 0);
  const valid = name.trim() && academicYear.trim() && validItems.length > 0;
  const heads = feeHeads ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New Fee Structure
      </Button>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Fee Structure</DialogTitle>
          <DialogDescription>The payable total is computed by the backend from these line items.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="B.Tech CSE — Sem 1 (2026-27)" />
          </div>
          <div className="space-y-1.5">
            <Label>Department (optional)</Label>
            <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setCourseId(''); }}>
              <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
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
            <Label>Course (optional)</Label>
            <Select value={courseId} onValueChange={setCourseId} disabled={!departmentId}>
              <SelectTrigger><SelectValue placeholder={departmentId ? 'All courses' : 'Select a department first'} /></SelectTrigger>
              <SelectContent>
                {(courses ?? []).length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No courses in this department</div>
                ) : (
                  (courses ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Academic year</Label>
            <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026-2027" />
          </div>
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Input type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(e.target.value)} />
          </div>
        </div>

        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label>Fee items</Label>
            <span className="text-sm text-muted-foreground">Payable preview: <span className="font-semibold text-foreground">{formatCurrency(preview)}</span></span>
          </div>

          {heads.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">No fee heads yet. Add one to build items:</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder="Fee head name (e.g. Tuition)" value={newHead.name} onChange={(e) => setNewHead({ ...newHead, name: e.target.value })} />
                <Input placeholder="Code (e.g. TUITION)" value={newHead.code} onChange={(e) => setNewHead({ ...newHead, code: e.target.value })} className="sm:w-40" />
                <Button variant="outline" onClick={() => addHead.mutate()} disabled={!newHead.name.trim() || !newHead.code.trim() || addHead.isPending}>
                  {addHead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                </Button>
              </div>
            </div>
          ) : (
            <>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-6 space-y-1">
                    <Select value={it.feeHeadId} onValueChange={(v) => updateItem(i, 'feeHeadId', v)}>
                      <SelectTrigger><SelectValue placeholder="Fee head" /></SelectTrigger>
                      <SelectContent>
                        {heads.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" min={0} placeholder="Amount" value={it.amount} onChange={(e) => updateItem(i, 'amount', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={0} placeholder="Discount" value={it.discountAmount} onChange={(e) => updateItem(i, 'discountAmount', e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => setItems((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r))}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setItems((r) => [...r, { feeHeadId: '', amount: '', discountAmount: '' }])}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
              </Button>
            </>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create fee structure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
