'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  formatCurrency,
  formatDateTime,
} from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Payment } from '@/types';
import { ArrowLeft, CheckCircle2, XCircle, Clock, CreditCard, RefreshCw } from 'lucide-react';

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

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payments', id],
    queryFn: async () => (await api.get<Payment>(`/payments/${id}`)).data,
    enabled: !!id,
  });

  const canManage = hasRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN');

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
            canManage && canAct ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setSuccessDialogOpen(true)}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600" /> Simulate Success
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFailDialogOpen(true)}>
                  <XCircle className="mr-1.5 h-4 w-4 text-rose-600" /> Simulate Failure
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)}>
                  Cancel Payment
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>

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
    </div>
  );
}
