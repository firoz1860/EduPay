'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  REFUND_STATUS_COLORS,
  REFUND_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';

interface RefundWithRelations {
  id: string;
  refund_number: string;
  amount: number;
  reason: string | null;
  status: string;
  provider_refund_id: string | null;
  approved_at: string | null;
  created_at: string;
  student: { full_name: string; roll_number: string } | null;
  payment: { payment_number: string } | null;
  invoice: { invoice_number: string } | null;
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<RefundWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRefunds() {
      const { data } = await supabase
        .from('refunds')
        .select(`
          id, refund_number, amount, reason, status, provider_refund_id, approved_at, created_at,
          student:students(full_name, roll_number),
          payment:payments(payment_number),
          invoice:invoices(invoice_number)
        `)
        .order('created_at', { ascending: false });
      setRefunds((data || []) as RefundWithRelations[]);
      setLoading(false);
    }
    fetchRefunds();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Refunds" description="View and manage refund records" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totalRefunded = refunds
    .filter((r) => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Refunds" description="View and manage refund records" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Refunded</p>
            <p className="mt-1 text-xl font-bold">{formatCurrency(totalRefunded)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Approval</p>
            <p className="mt-1 text-xl font-bold">{refunds.filter((r) => r.status === 'PENDING').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-xl font-bold">{refunds.filter((r) => r.status === 'COMPLETED').length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Refund</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.map((ref) => (
              <TableRow key={ref.id}>
                <TableCell className="font-mono text-sm">{ref.refund_number}</TableCell>
                <TableCell>
                  <p className="font-medium">{ref.student?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{ref.student?.roll_number}</p>
                </TableCell>
                <TableCell className="font-mono text-sm">{ref.payment?.payment_number || '-'}</TableCell>
                <TableCell className="font-mono text-sm">{ref.invoice?.invoice_number || '-'}</TableCell>
                <TableCell className="text-right font-semibold text-rose-600">-{formatCurrency(Number(ref.amount))}</TableCell>
                <TableCell className="text-sm">{ref.reason || '-'}</TableCell>
                <TableCell className="text-sm">{formatDate(ref.created_at)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REFUND_STATUS_COLORS[ref.status as keyof typeof REFUND_STATUS_COLORS]}`}>
                    {REFUND_STATUS_LABELS[ref.status as keyof typeof REFUND_STATUS_LABELS]}
                  </span>
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
                  <p className="font-mono text-sm font-medium">{ref.refund_number}</p>
                  <p className="text-xs text-muted-foreground">{ref.student?.full_name}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REFUND_STATUS_COLORS[ref.status as keyof typeof REFUND_STATUS_COLORS]}`}>
                  {REFUND_STATUS_LABELS[ref.status as keyof typeof REFUND_STATUS_LABELS]}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="font-semibold text-rose-600">-{formatCurrency(Number(ref.amount))}</span>
                <span className="text-muted-foreground">{ref.reason}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {refunds.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No refunds found</div>
      )}
    </div>
  );
}
