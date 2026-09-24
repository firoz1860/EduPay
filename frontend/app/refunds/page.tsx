'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, newIdempotencyKey, ApiError } from '@/lib/api';
import {
  REFUND_STATUS_COLORS,
  REFUND_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Payment, Refund } from '@/types';
import { Search, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const PAGE_SIZE = 20;

export default function RefundsPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const [newRefundOpen, setNewRefundOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const [approveTarget, setApproveTarget] = useState<Refund | null>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [completeTarget, setCompleteTarget] = useState<Refund | null>(null);

  const canCreate = hasRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN');
  const canApproveComplete = hasRole('FINANCE_MANAGER', 'ADMIN');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['refunds', page, debouncedSearch, statusFilter],
    queryFn: async () =>
      api.get<Refund[]>('/refunds', {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const refunds = data?.data ?? [];
  const meta = data?.meta;

  const { data: eligiblePayments, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', 'eligible-for-refund'],
    queryFn: async () => (await api.get<Payment[]>('/payments', { status: 'SUCCESS', pageSize: 100 })).data,
    enabled: newRefundOpen,
  });

  const selectedPayment = eligiblePayments?.find((p) => p.id === selectedPaymentId) ?? null;

  function resetRefundForm() {
    setSelectedPaymentId('');
    setAmount('');
    setReason('');
  }

  const createRefundMutation = useMutation({
    mutationFn: () =>
      api.post<Refund>(
        '/refunds',
        { paymentId: selectedPaymentId, amount: Number(amount), reason: reason.trim() },
        { idempotencyKey: newIdempotencyKey() },
      ),
    onSuccess: () => {
      toast.success('Refund created');
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setNewRefundOpen(false);
      resetRefundForm();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create refund');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (vars: { id: string; notes: string }) =>
      api.post<Refund>(`/refunds/${vars.id}/approve`, { notes: vars.notes.trim() || undefined }),
    onSuccess: () => {
      toast.success('Refund approved');
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setApproveTarget(null);
      setApproveNotes('');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to approve refund');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post<Refund>(`/refunds/${id}/complete`, undefined, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => {
      toast.success('Refund completed');
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setCompleteTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to complete refund');
    },
  });

  const amountValid =
    selectedPayment != null &&
    Number(amount) > 0 &&
    Number(amount) <= Number(selectedPayment.amount) &&
    reason.trim().length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Refunds" description="View and manage refund records" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const statusOptions = ['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        description="View and manage refund records"
        action={
          canCreate ? (
            <Button size="sm" onClick={() => setNewRefundOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New Refund
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search refund, student, or payment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {status === 'ALL' ? 'All' : REFUND_STATUS_LABELS[status as keyof typeof REFUND_STATUS_LABELS]}
            </button>
          ))}
        </div>
      </div>

      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Refund</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.map((ref) => (
              <TableRow key={ref.id}>
                <TableCell className="font-mono text-sm">{ref.refundNumber}</TableCell>
                <TableCell>
                  <p className="font-medium">{ref.student?.fullName || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{ref.student?.rollNumber}</p>
                </TableCell>
                <TableCell className="font-mono text-sm">{ref.payment?.paymentNumber || '-'}</TableCell>
                <TableCell className="text-right font-semibold text-rose-600">-{formatCurrency(Number(ref.amount))}</TableCell>
                <TableCell className="text-sm">{ref.reason || '-'}</TableCell>
                <TableCell className="text-sm">{formatDate(ref.createdAt)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REFUND_STATUS_COLORS[ref.status]}`}>
                    {REFUND_STATUS_LABELS[ref.status]}
                  </span>
                </TableCell>
                <TableCell>
                  {canApproveComplete && ref.status === 'PENDING' && (
                    <Button variant="outline" size="sm" onClick={() => { setApproveTarget(ref); setApproveNotes(''); }}>
                      Approve
                    </Button>
                  )}
                  {canApproveComplete && ref.status === 'APPROVED' && (
                    <Button variant="outline" size="sm" onClick={() => setCompleteTarget(ref)}>
                      Complete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-3 md:hidden">
        {refunds.map((ref) => (
          <Card key={ref.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium">{ref.refundNumber}</p>
                  <p className="text-xs text-muted-foreground">{ref.student?.fullName}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REFUND_STATUS_COLORS[ref.status]}`}>
                  {REFUND_STATUS_LABELS[ref.status]}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="font-semibold text-rose-600">-{formatCurrency(Number(ref.amount))}</span>
                <span className="text-muted-foreground">{ref.reason}</span>
              </div>
              {canApproveComplete && (ref.status === 'PENDING' || ref.status === 'APPROVED') && (
                <div className="mt-3">
                  {ref.status === 'PENDING' && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { setApproveTarget(ref); setApproveNotes(''); }}>
                      Approve
                    </Button>
                  )}
                  {ref.status === 'APPROVED' && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setCompleteTarget(ref)}>
                      Complete
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {refunds.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No refunds found</div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} &middot; {meta.total} refunds
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Refund Dialog */}
      <Dialog open={newRefundOpen} onOpenChange={(open) => { setNewRefundOpen(open); if (!open) resetRefundForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Refund</DialogTitle>
            <DialogDescription>
              Select a successful payment and enter the refund amount and reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment</Label>
              <Select value={selectedPaymentId} onValueChange={(v) => { setSelectedPaymentId(v); setAmount(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPayments ? 'Loading payments...' : 'Select a successful payment'} />
                </SelectTrigger>
                <SelectContent>
                  {(eligiblePayments || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.paymentNumber} &middot; {p.student?.fullName || 'Unknown'} &middot; {formatCurrency(Number(p.amount))}
                    </SelectItem>
                  ))}
                  {!loadingPayments && (eligiblePayments || []).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No successful payments available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                max={selectedPayment ? Number(selectedPayment.amount) : undefined}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!selectedPaymentId}
              />
              {selectedPayment && (
                <p className="text-xs text-muted-foreground">
                  Maximum refundable: {formatCurrency(Number(selectedPayment.amount))}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Reason for refund..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRefundOpen(false)}>Cancel</Button>
            <Button
              disabled={!amountValid || createRefundMutation.isPending}
              onClick={() => createRefundMutation.mutate()}
            >
              {createRefundMutation.isPending ? 'Submitting...' : 'Create Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirm */}
      <AlertDialog open={!!approveTarget} onOpenChange={(open) => { if (!open) { setApproveTarget(null); setApproveNotes(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve refund?</AlertDialogTitle>
            <AlertDialogDescription>
              Approve refund {approveTarget?.refundNumber} for {approveTarget ? formatCurrency(Number(approveTarget.amount)) : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Approval notes (optional)"
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (approveTarget) approveMutation.mutate({ id: approveTarget.id, notes: approveNotes });
              }}
            >
              {approveMutation.isPending ? 'Approving...' : 'Confirm Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirm */}
      <AlertDialog open={!!completeTarget} onOpenChange={(open) => { if (!open) setCompleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete refund?</AlertDialogTitle>
            <AlertDialogDescription>
              This will settle refund {completeTarget?.refundNumber} for {completeTarget ? formatCurrency(Number(completeTarget.amount)) : ''} and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={completeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (completeTarget) completeMutation.mutate(completeTarget.id);
              }}
            >
              {completeMutation.isPending ? 'Completing...' : 'Confirm Complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
