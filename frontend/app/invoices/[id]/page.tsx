'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INSTALLMENT_STATUS_COLORS,
  INSTALLMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { StripePaymentForm } from '@/components/payments/stripe-payment-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Invoice, Payment } from '@/types';
import { ArrowLeft, Link as LinkIcon, CreditCard } from 'lucide-react';

const PAYMENT_METHODS = ['card', 'upi', 'netbanking', 'cash', 'cheque'];

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [payInstallmentId, setPayInstallmentId] = useState<string>('none');
  // Set once a real Stripe PaymentIntent is created; drives the card-entry step.
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);

  const canManage = hasRole('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => (await api.get<Invoice>(`/invoices/${id}`)).data,
    enabled: !!id,
  });

  const invalidateInvoice = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices', id] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const issueMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/issue`),
    onSuccess: () => {
      toast.success('Invoice issued successfully');
      setIssueOpen(false);
      invalidateInvoice();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/cancel`, cancelReason ? { reason: cancelReason } : {}),
    onSuccess: () => {
      toast.success('Invoice cancelled');
      setCancelOpen(false);
      setCancelReason('');
      invalidateInvoice();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const body = {
        invoiceId: id,
        installmentId: payInstallmentId === 'none' ? undefined : payInstallmentId,
        amount: Number(payAmount),
        method: payMethod,
      };
      const res = await api.post<{ payment: Payment; simulated: boolean; clientSecret: string | null }>(
        '/payments',
        body,
        { idempotencyKey: newIdempotencyKey() },
      );
      if (res.data.simulated) {
        await api.post(`/payments/${res.data.payment.id}/simulate`, { outcome: 'success' }, {
          idempotencyKey: newIdempotencyKey(),
        });
      }
      return res.data;
    },
    onSuccess: (data) => {
      // Simulated gateway (no Stripe key configured): settlement already ran above.
      if (data.simulated) {
        toast.success('Payment recorded successfully');
        closePayDialog();
        invalidateInvoice();
        return;
      }
      // Real Stripe: advance to the card-entry step using the returned clientSecret.
      if (data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
      } else {
        toast.error('Unable to start Stripe checkout. Please try again.');
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
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

  if (!invoice) {
    return <div className="py-12 text-center text-muted-foreground">Invoice not found</div>;
  }

  const paymentProgress = Number(invoice.payableAmount) > 0
    ? (Number(invoice.paidAmount) / Number(invoice.payableAmount)) * 100
    : 0;

  const canIssue = canManage && invoice.status === 'DRAFT';
  const canCancel = canManage && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED';
  const canPay =
    (canManage || hasRole('STUDENT')) &&
    Number(invoice.outstandingAmount) > 0 &&
    invoice.status !== 'DRAFT' &&
    invoice.status !== 'CANCELLED';

  const closePayDialog = () => {
    setPayOpen(false);
    setPayAmount('');
    setPayInstallmentId('none');
    setStripeClientSecret(null);
  };

  const openPayDialog = () => {
    setPayAmount(String(Number(invoice.outstandingAmount)));
    setPayInstallmentId('none');
    setStripeClientSecret(null);
    setPayOpen(true);
  };

  const handleStripeSuccess = () => {
    toast.success('Payment submitted. It will be confirmed shortly.');
    closePayDialog();
    invalidateInvoice();
  };

  const handlePay = () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    payMutation.mutate();
  };

  const payableInstallments = (invoice.installments ?? []).filter((i) => Number(i.outstandingAmount) > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={invoice.invoiceNumber}
          description={`${invoice.student?.fullName || 'Unknown'} • ${invoice.academicYear} • Sem ${invoice.semester}`}
          action={
            <div className="flex gap-2">
              {canIssue && (
                <Button variant="outline" onClick={() => setIssueOpen(true)}>
                  Issue
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setCancelOpen(true)}>
                  Cancel
                </Button>
              )}
              {canPay && (
                <Button onClick={openPayDialog}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Make Payment
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payment Summary</CardTitle>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_COLORS[invoice.status]}`}>
                {INVOICE_STATUS_LABELS[invoice.status]}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Progress</span>
                <span className="font-medium">{paymentProgress.toFixed(0)}%</span>
              </div>
              <Progress value={paymentProgress} className="h-2" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(Number(invoice.totalAmount))}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Discount</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">-{formatCurrency(Number(invoice.discountAmount))}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Payable</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(Number(invoice.payableAmount))}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Outstanding</p>
                <p className="mt-1 text-lg font-bold text-amber-700">{formatCurrency(Number(invoice.outstandingAmount))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Due Date:</span>
              <span className="font-medium">{formatDate(invoice.dueDate)}</span>
            </div>
            {invoice.notes && (
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{invoice.notes}</div>
            )}
          </CardContent>
        </Card>

        {/* Student */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/students/${invoice.student?.id || ''}`}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              {invoice.student?.fullName}
              <LinkIcon className="h-3 w-3" />
            </Link>
            <p className="text-sm text-muted-foreground">{invoice.student?.rollNumber}</p>
            <p className="text-sm text-muted-foreground">{invoice.student?.email}</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Head</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>Discount Label</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.feeHeadName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(item.amount))}</TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {Number(item.discountAmount) > 0 ? `-${formatCurrency(Number(item.discountAmount))}` : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.discountLabel || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(item.amount) - Number(item.discountAmount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Installments */}
      {invoice.installments && invoice.installments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Installments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoice.installments.map((inst) => {
                const instProgress = Number(inst.amount) > 0 ? (Number(inst.paidAmount) / Number(inst.amount)) * 100 : 0;
                return (
                  <div key={inst.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{inst.label}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(inst.dueDate)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>
                        {INSTALLMENT_STATUS_LABELS[inst.status]}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <Progress value={instProgress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(Number(inst.paidAmount))} / {formatCurrency(Number(inst.amount))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoice.payments.map((pay) => (
                <Link
                  key={pay.id}
                  href={`/payments/${pay.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{pay.paymentNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(pay.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatCurrency(Number(pay.amount))}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_COLORS[pay.status]}`}>
                      {PAYMENT_STATUS_LABELS[pay.status]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issue confirmation */}
      <AlertDialog open={issueOpen} onOpenChange={setIssueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Issuing invoice {invoice.invoiceNumber} will make it payable and visible to the student. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={issueMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                issueMutation.mutate();
              }}
              disabled={issueMutation.isPending}
            >
              {issueMutation.isPending ? 'Issuing...' : 'Issue Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel invoice {invoice.invoiceNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this invoice being cancelled?"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={(e) => {
                e.preventDefault();
                cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Make Payment dialog */}
      <Dialog open={payOpen} onOpenChange={(open) => (open ? setPayOpen(true) : closePayDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a Payment</DialogTitle>
            <DialogDescription>
              {stripeClientSecret
                ? `Enter your card details to complete the payment via Stripe.`
                : `Record a payment against invoice ${invoice.invoiceNumber}.`}
            </DialogDescription>
          </DialogHeader>
          {stripeClientSecret ? (
            <StripePaymentForm
              clientSecret={stripeClientSecret}
              onSuccess={handleStripeSuccess}
              onCancel={closePayDialog}
            />
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Outstanding: {formatCurrency(Number(invoice.outstandingAmount))}
                  </p>
                </div>
                {payableInstallments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Installment (optional)</Label>
                    <Select value={payInstallmentId} onValueChange={setPayInstallmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Apply to whole invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Apply to whole invoice</SelectItem>
                        {payableInstallments.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            {inst.label} &middot; {formatCurrency(Number(inst.outstandingAmount))} due
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m} className="capitalize">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closePayDialog} disabled={payMutation.isPending}>
                  Cancel
                </Button>
                <Button onClick={handlePay} disabled={payMutation.isPending}>
                  {payMutation.isPending ? 'Processing...' : 'Pay Now'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
