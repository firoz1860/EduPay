'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
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
import { ArrowLeft, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  academic_year: string;
  semester: number;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  due_date: string | null;
  status: string;
  notes: string | null;
  student: { full_name: string; roll_number: string; email: string } | null;
  items: { id: string; fee_head_name: string; amount: number; discount_amount: number; discount_label: string | null }[];
  installments: { id: string; installment_number: number; label: string; amount: number; paid_amount: number; outstanding_amount: number; due_date: string | null; status: string }[];
  payments: { id: string; payment_number: string; amount: number; status: string; created_at: string }[];
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const id = params.id as string;
      const { data } = await supabase
        .from('invoices')
        .select(`
          *,
          student:students(full_name, roll_number, email),
          items:invoice_items(id, fee_head_name, amount, discount_amount, discount_label),
          installments:installments(id, installment_number, label, amount, paid_amount, outstanding_amount, due_date, status),
          payments:payments(id, payment_number, amount, status, created_at)
        `)
        .eq('id', id)
        .maybeSingle();

      setInvoice(data as unknown as InvoiceDetail | null);
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

  if (!invoice) {
    return <div className="py-12 text-center text-muted-foreground">Invoice not found</div>;
  }

  const paymentProgress = Number(invoice.payable_amount) > 0
    ? (Number(invoice.paid_amount) / Number(invoice.payable_amount)) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={invoice.invoice_number}
          description={`${invoice.student?.full_name || 'Unknown'} • ${invoice.academic_year} • Sem ${invoice.semester}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payment Summary</CardTitle>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS]}`}>
                {INVOICE_STATUS_LABELS[invoice.status as keyof typeof INVOICE_STATUS_LABELS]}
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
                <p className="mt-1 text-lg font-bold">{formatCurrency(Number(invoice.total_amount))}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Discount</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">-{formatCurrency(Number(invoice.discount_amount))}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Payable</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(Number(invoice.payable_amount))}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Outstanding</p>
                <p className="mt-1 text-lg font-bold text-amber-700">{formatCurrency(Number(invoice.outstanding_amount))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Due Date:</span>
              <span className="font-medium">{formatDate(invoice.due_date)}</span>
            </div>
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
              {invoice.student?.full_name}
              <LinkIcon className="h-3 w-3" />
            </Link>
            <p className="text-sm text-muted-foreground">{invoice.student?.roll_number}</p>
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
              {invoice.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.fee_head_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(item.amount))}</TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {Number(item.discount_amount) > 0 ? `-${formatCurrency(Number(item.discount_amount))}` : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.discount_label || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(item.amount) - Number(item.discount_amount))}
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
                const instProgress = Number(inst.amount) > 0 ? (Number(inst.paid_amount) / Number(inst.amount)) * 100 : 0;
                return (
                  <div key={inst.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{inst.label}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(inst.due_date)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INSTALLMENT_STATUS_COLORS[inst.status as keyof typeof INSTALLMENT_STATUS_COLORS]}`}>
                        {INSTALLMENT_STATUS_LABELS[inst.status as keyof typeof INSTALLMENT_STATUS_LABELS]}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <Progress value={instProgress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(Number(inst.paid_amount))} / {formatCurrency(Number(inst.amount))}
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
                    <p className="text-sm font-medium">{pay.payment_number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(pay.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatCurrency(Number(pay.amount))}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_COLORS[pay.status as keyof typeof PAYMENT_STATUS_COLORS]}`}>
                      {PAYMENT_STATUS_LABELS[pay.status as keyof typeof PAYMENT_STATUS_LABELS]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
