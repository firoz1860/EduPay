'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATE_FLOW,
  REFUND_STATUS_COLORS,
  REFUND_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
} from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Payment, Refund } from '@/types';
import { ArrowLeft, CheckCircle2, XCircle, Clock, CreditCard, RefreshCw, Undo2 } from 'lucide-react';

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const id = params.id as string;

  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [failDialogOpen, setFailDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<Refund | null>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [completeTarget, setCompleteTarget] = useState<Refund | null>(null);

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payments', id],
    queryFn: async () => (await api.get<Payment>(`/payments/${id}`)).data,
    enabled: !!id,
  });

  const canManage = hasRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN');
  const canApproveComplete = hasRole('FINANCE_MANAGER', 'ADMIN');

  // Refunds recorded against this payment (drives the refundable balance + actions).
  const { data: refundsRes } = useQuery({
    queryKey: ['refunds', 'payment', id],
    queryFn: async () => api.get<Refund[]>('/refunds', { paymentId: id, pageSize: 100 }),
    enabled: !!id,
  });
  const paymentRefunds = refundsRes?.data ?? [];

  // After any refund action, refresh everything a refund can touch.
  const invalidateAfterRefund = () => {
    for (const key of ['payments', 'invoices', 'refunds', 'reports', 'reconciliation']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const simulateMutation = useMutation({
    mutationFn: (vars: { outcome: 'success' | 'fail'; failureReason?: string }) =>
      api.post<Payment>(`/payments/${id}/simulate`, vars, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: (_res, vars) => {
      toast.success(vars.outcome === 'success' ? 'Payment marked as successful' : 'Payment marked as failed');
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setSuccessDialogOpen(false);
      setFailDialogOpen(false);
      setFailureReason('');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to simulate payment outcome');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post<Payment>(`/payments/${id}/cancel`),
    onSuccess: () => {
      toast.success('Payment cancelled');
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setCancelDialogOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to cancel payment');
    },
  });

  const createRefundMutation = useMutation({
    mutationFn: () =>
      api.post<Refund>(
        '/refunds',
        { paymentId: id, amount: Number(refundAmount), reason: refundReason.trim() },
        { idempotencyKey: newIdempotencyKey() },
      ),
    onSuccess: () => {
      toast.success('Refund created');
      invalidateAfterRefund();
      setRefundOpen(false);
      setRefundAmount('');
      setRefundReason('');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create refund');
    },
  });

  const approveRefundMutation = useMutation({
    mutationFn: (vars: { id: string; notes: string }) =>
      api.post<Refund>(`/refunds/${vars.id}/approve`, { notes: vars.notes.trim() || undefined }),
    onSuccess: () => {
      toast.success('Refund approved');
      invalidateAfterRefund();
      setApproveTarget(null);
      setApproveNotes('');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to approve refund');
    },
  });

  const completeRefundMutation = useMutation({
    mutationFn: (refundId: string) =>
      api.post<Refund>(`/refunds/${refundId}/complete`, undefined, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => {
      toast.success('Refund completed');
      invalidateAfterRefund();
      setCompleteTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to complete refund');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!payment) {
    return <div className="py-12 text-center text-muted-foreground">Payment not found</div>;
  }

  const currentStateIdx = PAYMENT_STATE_FLOW.indexOf(payment.status);
  const canAct = payment.status === 'CREATED' || payment.status === 'PENDING';
  
  const isSimulated = payment.provider !== 'STRIPE';

  // Refundable = payment amount minus refunds not cancelled/failed (mirrors backend;
  // backend validation remains authoritative).
  const refundedSoFar = paymentRefunds
    .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'COMPLETED')
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const remainingRefundable = Math.max(0, Number(payment.amount) - refundedSoFar);
  const canRefund =
    canManage &&
    (payment.status === 'SUCCESS' || payment.status === 'REFUND_PENDING') &&
    remainingRefundable > 0;
  const refundAmountNum = Number(refundAmount);
  const refundValid =
    refundAmountNum > 0 && refundAmountNum <= remainingRefundable && refundReason.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/payments')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={payment.paymentNumber}
          description={`${payment.student?.fullName || 'Unknown'} • ${payment.invoice?.invoiceNumber || '-'}`}
          action={
            (canManage && canAct) || canRefund ? (
              <div className="flex flex-wrap gap-2">
                {canManage && canAct && (
                  <>
                    {isSimulated && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setSuccessDialogOpen(true)}>
                          <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600" /> Simulate Success
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setFailDialogOpen(true)}>
                          <XCircle className="mr-1.5 h-4 w-4 text-rose-600" /> Simulate Failure
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)}>
                      Cancel Payment
                    </Button>
                  </>
                )}
                {canRefund && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRefundAmount(String(remainingRefundable));
                      setRefundReason('');
                      setRefundOpen(true);
                    }}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" /> Refund
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      {canManage && canAct && !isSimulated && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This payment is processed by Stripe, so manual simulation is disabled — settlement is
          completed through the real Stripe checkout and webhook. A pending payment can still be cancelled.
        </div>
      )}

      {/* Payment State Machine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment State Machine</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {PAYMENT_STATE_FLOW.map((state, idx) => {
              const isCurrent = state === payment.status;
              const isPast = idx < currentStateIdx;
              return (
                <div key={state} className="flex items-center">
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      isCurrent
                        ? PAYMENT_STATUS_COLORS[state] + ' ring-2 ring-primary ring-offset-2'
                        : isPast
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-muted/30 text-muted-foreground/40'
                    }`}
                  >
                    {state === 'SUCCESS' && <CheckCircle2 className="h-3 w-3" />}
                    {state === 'FAILED' && <XCircle className="h-3 w-3" />}
                    {state === 'PENDING' && <Clock className="h-3 w-3" />}
                    {state === 'REFUND_PENDING' && <RefreshCw className="h-3 w-3" />}
                    {PAYMENT_STATUS_LABELS[state]}
                  </div>
                  {idx < PAYMENT_STATE_FLOW.length - 1 && (
                    <div className={`mx-1 h-px w-4 ${isPast ? 'bg-foreground/30' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{formatCurrency(Number(payment.amount))} {payment.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Provider</span>
              <span>{payment.provider}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="capitalize">{payment.paymentMethod || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Provider Payment ID</span>
              <span className="font-mono text-xs">{payment.providerPaymentId || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction Reference</span>
              <span className="font-mono text-xs">{payment.transactionReference || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDateTime(payment.createdAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Updated</span>
              <span>{formatDateTime(payment.updatedAt)}</span>
            </div>
            {payment.failureReason && (
              <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
                <span className="font-medium">Failure Reason: </span>
                {payment.failureReason}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student & Invoice */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Student</p>
              <Link href={`/students/${payment.student?.id || ''}`} className="text-sm font-medium text-primary hover:underline">
                {payment.student?.fullName || 'Unknown'}
              </Link>
              <p className="text-xs text-muted-foreground">{payment.student?.rollNumber} • {payment.student?.email}</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">Invoice</p>
              <Link href={`/invoices/${payment.invoiceId}`} className="text-sm font-medium text-primary hover:underline">
                {payment.invoice?.invoiceNumber || '-'}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Attempts */}
      {payment.attempts && payment.attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payment.attempts.map((att) => (
                <div key={att.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Attempt {att.attemptNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(att.createdAt)}</p>
                      {att.failureReason && (
                        <p className="text-xs text-rose-600">{att.failureReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatCurrency(Number(att.amount))}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      att.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' :
                      att.status === 'FAILED' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {att.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refunds against this payment */}
      {paymentRefunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paymentRefunds.map((ref) => (
                <div
                  key={ref.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{ref.refundNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(ref.createdAt)}
                      {ref.reason ? ` • ${ref.reason}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-rose-600">
                      -{formatCurrency(Number(ref.amount))}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REFUND_STATUS_COLORS[ref.status]}`}>
                      {REFUND_STATUS_LABELS[ref.status]}
                    </span>
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulate Success Confirm */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simulate successful payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark payment {payment.paymentNumber} as SUCCESS. This action is recorded and cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={simulateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={simulateMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                simulateMutation.mutate({ outcome: 'success' });
              }}
            >
              {simulateMutation.isPending ? 'Processing...' : 'Confirm Success'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Simulate Failure Confirm */}
      <AlertDialog open={failDialogOpen} onOpenChange={(open) => { setFailDialogOpen(open); if (!open) setFailureReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simulate failed payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark payment {payment.paymentNumber} as FAILED. Optionally provide a failure reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Failure reason (optional)"
            value={failureReason}
            onChange={(e) => setFailureReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={simulateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={simulateMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                simulateMutation.mutate({ outcome: 'fail', failureReason: failureReason.trim() || undefined });
              }}
            >
              {simulateMutation.isPending ? 'Processing...' : 'Confirm Failure'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirm */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel payment {payment.paymentNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Keep Payment</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                cancelMutation.mutate();
              }}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Refund Dialog */}
      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          setRefundOpen(open);
          if (!open) {
            setRefundAmount('');
            setRefundReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Payment</DialogTitle>
            <DialogDescription>
              Create a refund against {payment.paymentNumber}. It will require approval and completion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                max={remainingRefundable}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Refundable: {formatCurrency(remainingRefundable)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Reason for refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={createRefundMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => createRefundMutation.mutate()} disabled={!refundValid || createRefundMutation.isPending}>
              {createRefundMutation.isPending ? 'Submitting...' : 'Create Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Refund Confirm */}
      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(open) => { if (!open) { setApproveTarget(null); setApproveNotes(''); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve refund?</AlertDialogTitle>
            <AlertDialogDescription>
              Approve refund {approveTarget?.refundNumber} for{' '}
              {approveTarget ? formatCurrency(Number(approveTarget.amount)) : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Approval notes (optional)"
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveRefundMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveRefundMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (approveTarget) approveRefundMutation.mutate({ id: approveTarget.id, notes: approveNotes });
              }}
            >
              {approveRefundMutation.isPending ? 'Approving...' : 'Confirm Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Refund Confirm */}
      <AlertDialog open={!!completeTarget} onOpenChange={(open) => { if (!open) setCompleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete refund?</AlertDialogTitle>
            <AlertDialogDescription>
              This will settle refund {completeTarget?.refundNumber} for{' '}
              {completeTarget ? formatCurrency(Number(completeTarget.amount)) : ''} and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeRefundMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={completeRefundMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (completeTarget) completeRefundMutation.mutate(completeTarget.id);
              }}
            >
              {completeRefundMutation.isPending ? 'Completing...' : 'Confirm Complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
