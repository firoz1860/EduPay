'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATE_FLOW,
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/lib/constants';
import { ArrowLeft, CheckCircle2, XCircle, Clock, CreditCard, RefreshCw } from 'lucide-react';

interface PaymentDetail {
  id: string;
  payment_number: string;
  amount: number;
  currency: string;
  provider: string;
  provider_payment_id: string | null;
  transaction_reference: string | null;
  status: string;
  failure_reason: string | null;
  payment_method: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  student: { full_name: string; roll_number: string; email: string } | null;
  invoice: { invoice_number: string } | null;
  installment: { label: string } | null;
}

interface PaymentAttempt {
  id: string;
  attempt_number: number;
  amount: number;
  provider: string;
  provider_attempt_id: string | null;
  status: string;
  failure_reason: string | null;
  created_at: string;
}

interface GatewayEvent {
  id: string;
  gateway_event_id: string;
  event_type: string | null;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const id = params.id as string;
      const [
        { data: payData },
        { data: attemptData },
        { data: eventData },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select(`
            *,
            student:students(full_name, roll_number, email),
            invoice:invoices(invoice_number),
            installment:installments(label)
          `)
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('payment_attempts')
          .select('*')
          .eq('payment_id', id)
          .order('attempt_number', { ascending: true }),
        supabase
          .from('gateway_events')
          .select('*')
          .eq('payment_id', id)
          .order('created_at', { ascending: true }),
      ]);

      setPayment(payData as unknown as PaymentDetail | null);
      setAttempts((attemptData || []) as PaymentAttempt[]);
      setEvents((eventData || []) as GatewayEvent[]);
      setLoading(false);
    }
    fetchData();
  }, [params.id]);

  if (loading) {
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

  const currentStateIdx = PAYMENT_STATE_FLOW.indexOf(payment.status as typeof PAYMENT_STATE_FLOW[number]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/payments')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={payment.payment_number}
          description={`${payment.student?.full_name || 'Unknown'} • ${payment.invoice?.invoice_number || '-'}`}
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
                        ? PAYMENT_STATUS_COLORS[state as keyof typeof PAYMENT_STATUS_COLORS] + ' ring-2 ring-primary ring-offset-2'
                        : isPast
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-muted/30 text-muted-foreground/40'
                    }`}
                  >
                    {state === 'SUCCESS' && <CheckCircle2 className="h-3 w-3" />}
                    {state === 'FAILED' && <XCircle className="h-3 w-3" />}
                    {state === 'PENDING' && <Clock className="h-3 w-3" />}
                    {state === 'REFUND_PENDING' && <RefreshCw className="h-3 w-3" />}
                    {PAYMENT_STATUS_LABELS[state as keyof typeof PAYMENT_STATUS_LABELS]}
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
              <span className="capitalize">{payment.payment_method || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Provider Payment ID</span>
              <span className="font-mono text-xs">{payment.provider_payment_id || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction Reference</span>
              <span className="font-mono text-xs">{payment.transaction_reference || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDateTime(payment.created_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Updated</span>
              <span>{formatDateTime(payment.updated_at)}</span>
            </div>
            {payment.failure_reason && (
              <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
                <span className="font-medium">Failure Reason: </span>
                {payment.failure_reason}
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
                {payment.student?.full_name || 'Unknown'}
              </Link>
              <p className="text-xs text-muted-foreground">{payment.student?.roll_number} • {payment.student?.email}</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">Invoice</p>
              <p className="text-sm font-medium">{payment.invoice?.invoice_number || '-'}</p>
            </div>
            {payment.installment && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">Installment</p>
                <p className="text-sm font-medium">{payment.installment.label}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Attempts */}
      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attempts.map((att) => (
                <div key={att.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Attempt {att.attempt_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(att.created_at)}</p>
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

      {/* Gateway Events */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gateway Events (Webhook)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-mono text-sm font-medium">{evt.gateway_event_id}</p>
                    <p className="text-xs text-muted-foreground">{evt.event_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatDate(evt.created_at)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      evt.processed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {evt.processed ? 'Processed' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
