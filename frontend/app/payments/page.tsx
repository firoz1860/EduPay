'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import {
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { Search, ChevronRight } from 'lucide-react';

interface PaymentWithStudent {
  id: string;
  payment_number: string;
  amount: number;
  status: string;
  provider: string;
  payment_method: string | null;
  created_at: string;
  student: { full_name: string; roll_number: string } | null;
  invoice: { invoice_number: string } | null;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    async function fetchPayments() {
      const { data } = await supabase
        .from('payments')
        .select(`
          id, payment_number, amount, status, provider, payment_method, created_at,
          student:students(full_name, roll_number),
          invoice:invoices(invoice_number)
        `)
        .order('created_at', { ascending: false });
      setPayments((data || []) as PaymentWithStudent[]);
      setLoading(false);
    }
    fetchPayments();
  }, []);

  const filtered = payments.filter((p) => {
    const matchesSearch =
      p.payment_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.student?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.invoice?.invoice_number || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" description="Track and manage all payments" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const statusOptions = ['ALL', 'CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Track and manage all payments" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payment, student, or invoice..."
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
              {status === 'ALL' ? 'All' : PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS]}
            </button>
          ))}
        </div>
      </div>

      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((pay) => (
              <TableRow key={pay.id}>
                <TableCell className="font-mono text-sm">{pay.payment_number}</TableCell>
                <TableCell>
                  <p className="font-medium">{pay.student?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{pay.student?.roll_number}</p>
                </TableCell>
                <TableCell className="font-mono text-sm">{pay.invoice?.invoice_number || '-'}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(Number(pay.amount))}</TableCell>
                <TableCell className="text-sm">{pay.provider}</TableCell>
                <TableCell className="text-sm">{formatDate(pay.created_at)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_COLORS[pay.status as keyof typeof PAYMENT_STATUS_COLORS]}`}>
                    {PAYMENT_STATUS_LABELS[pay.status as keyof typeof PAYMENT_STATUS_LABELS]}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={`/payments/${pay.id}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-3 md:hidden">
        {filtered.map((pay) => (
          <Link key={pay.id} href={`/payments/${pay.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{pay.payment_number}</p>
                    <p className="text-xs text-muted-foreground">{pay.student?.full_name}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_COLORS[pay.status as keyof typeof PAYMENT_STATUS_COLORS]}`}>
                    {PAYMENT_STATUS_LABELS[pay.status as keyof typeof PAYMENT_STATUS_LABELS]}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="font-semibold">{formatCurrency(Number(pay.amount))}</span>
                  <span className="text-muted-foreground">{formatDate(pay.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No payments found</div>
      )}
    </div>
  );
}
