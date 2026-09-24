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
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { Search, ChevronRight } from 'lucide-react';

interface InvoiceWithStudent {
  id: string;
  invoice_number: string;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: string;
  due_date: string | null;
  student: { full_name: string; roll_number: string } | null;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    async function fetchInvoices() {
      const { data } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, payable_amount, paid_amount, outstanding_amount, status, due_date,
          student:students(full_name, roll_number)
        `)
        .order('created_at', { ascending: false });
      setInvoices((data || []) as unknown as InvoiceWithStudent[]);
      setLoading(false);
    }
    fetchInvoices();
  }, []);

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (inv.student?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.student?.roll_number || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" description="View and manage invoices" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const statusOptions = ['ALL', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="View and manage invoices" />

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
              {status === 'ALL' ? 'All' : INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS]}
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
            {filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                <TableCell>
                  <p className="font-medium">{inv.student?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{inv.student?.roll_number}</p>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(Number(inv.payable_amount))}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatCurrency(Number(inv.paid_amount))}</TableCell>
                <TableCell className="text-right text-amber-600">{formatCurrency(Number(inv.outstanding_amount))}</TableCell>
                <TableCell>{formatDate(inv.due_date)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status as keyof typeof INVOICE_STATUS_COLORS]}`}>
                    {INVOICE_STATUS_LABELS[inv.status as keyof typeof INVOICE_STATUS_LABELS]}
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
        {filtered.map((inv) => (
          <Link key={inv.id} href={`/invoices/${inv.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.student?.full_name}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status as keyof typeof INVOICE_STATUS_COLORS]}`}>
                    {INVOICE_STATUS_LABELS[inv.status as keyof typeof INVOICE_STATUS_LABELS]}
                  </span>
                </div>
                <div className="mt-3 flex justify-between text-xs">
                  <span className="text-muted-foreground">Payable: {formatCurrency(Number(inv.payable_amount))}</span>
                  <span className="text-emerald-600">Paid: {formatCurrency(Number(inv.paid_amount))}</span>
                  <span className="text-amber-600">Due: {formatCurrency(Number(inv.outstanding_amount))}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No invoices found</div>
      )}
    </div>
  );
}
