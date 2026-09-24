'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Invoice, InvoiceStatus, Student, FeeStructure } from '@/types';
import { Search, ChevronRight, Plus } from 'lucide-react';

const PAGE_SIZE = 10;
const STATUS_OPTIONS: (InvoiceStatus | 'ALL')[] = [
  'ALL',
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
];

interface CreateInvoiceForm {
  studentId: string;
  feeStructureId: string;
  installmentCount: string;
  dueDate: string;
}

const EMPTY_FORM: CreateInvoiceForm = {
  studentId: '',
  feeStructureId: '',
  installmentCount: '',
  dueDate: '',
};

export default function InvoicesPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateInvoiceForm>(EMPTY_FORM);

  const canCreate = hasRole('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { data: invoicesResp, isLoading } = useQuery({
    queryKey: ['invoices', page, debouncedSearch, statusFilter],
    queryFn: () =>
      api.get<Invoice[]>('/invoices', {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const invoices = invoicesResp?.data ?? [];
  const meta = invoicesResp?.meta;

  const { data: students } = useQuery({
    queryKey: ['students', 'picker'],
    queryFn: async () => (await api.get<Student[]>('/students', { pageSize: 100 })).data,
    enabled: createOpen,
  });

  const { data: feeStructures } = useQuery({
    queryKey: ['fee-structures', 'picker'],
    queryFn: async () => (await api.get<FeeStructure[]>('/fee-structures', { pageSize: 100 })).data,
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Invoice>('/invoices', {
        studentId: form.studentId,
        feeStructureId: form.feeStructureId,
        installmentCount: form.installmentCount ? Number(form.installmentCount) : undefined,
        dueDate: form.dueDate ? `${form.dueDate}T00:00:00.000Z` : undefined,
      }),
    onSuccess: () => {
      toast.success('Invoice created successfully');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  const handleCreate = () => {
    if (!form.studentId || !form.feeStructureId) {
      toast.error('Please select a student and a fee structure');
      return;
    }
    createMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" description="View and manage invoices" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="View and manage invoices"
        action={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice or student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {status === 'ALL' ? 'All' : INVOICE_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Payable</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                <TableCell>
                  <p className="font-medium">{inv.student?.fullName || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{inv.student?.rollNumber}</p>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(Number(inv.payableAmount))}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatCurrency(Number(inv.paidAmount))}</TableCell>
                <TableCell className="text-right text-amber-600">{formatCurrency(Number(inv.outstandingAmount))}</TableCell>
                <TableCell>{formatDate(inv.dueDate)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={`/invoices/${inv.id}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-3 md:hidden">
        {invoices.map((inv) => (
          <Link key={inv.id} href={`/invoices/${inv.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{inv.student?.fullName}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </div>
                <div className="mt-3 flex justify-between text-xs">
                  <span className="text-muted-foreground">Payable: {formatCurrency(Number(inv.payableAmount))}</span>
                  <span className="text-emerald-600">Paid: {formatCurrency(Number(inv.paidAmount))}</span>
                  <span className="text-amber-600">Due: {formatCurrency(Number(inv.outstandingAmount))}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {invoices.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No invoices found</div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} &middot; {meta.total} invoices
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setForm(EMPTY_FORM); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Pick a student and a fee structure to generate a new invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={form.studentId} onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {(students ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName} ({s.rollNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fee Structure</Label>
              <Select value={form.feeStructureId} onValueChange={(v) => setForm((f) => ({ ...f, feeStructureId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a fee structure" />
                </SelectTrigger>
                <SelectContent>
                  {(feeStructures ?? []).map((fs) => (
                    <SelectItem key={fs.id} value={fs.id}>
                      {fs.name} &middot; {fs.academicYear} Sem {fs.semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Installments (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={form.installmentCount}
                  onChange={(e) => setForm((f) => ({ ...f, installmentCount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date (optional)</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
