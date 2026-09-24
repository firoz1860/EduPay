'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import {
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Payment } from '@/types';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';

const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

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
    queryKey: ['payments', page, debouncedSearch, statusFilter],
    queryFn: async () =>
      api.get<Payment[]>('/payments', {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const payments = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) {
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
              <TableHead>Method</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((pay) => (
              <TableRow
                key={pay.id}
                className="cursor-pointer"
                onClick={() => router.push(`/payments/${pay.id}`)}
              >
                <TableCell className="font-mono text-sm">{pay.paymentNumber}</TableCell>
                <TableCell>
                  <p className="font-medium">{pay.student?.fullName || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{pay.student?.rollNumber}</p>
                </TableCell>
                <TableCell className="font-mono text-sm">{pay.invoice?.invoiceNumber || '-'}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(Number(pay.amount))}</TableCell>
                <TableCell className="text-sm capitalize">{pay.paymentMethod || '-'}</TableCell>
                <TableCell className="text-sm">{formatDate(pay.createdAt)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_COLORS[pay.status]}`}>
                    {PAYMENT_STATUS_LABELS[pay.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={`/payments/${pay.id}`} onClick={(e) => e.stopPropagation()}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-3 md:hidden">
        {payments.map((pay) => (
          <Link key={pay.id} href={`/payments/${pay.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{pay.paymentNumber}</p>
                    <p className="text-xs text-muted-foreground">{pay.student?.fullName}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_COLORS[pay.status]}`}>
                    {PAYMENT_STATUS_LABELS[pay.status]}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="font-semibold">{formatCurrency(Number(pay.amount))}</span>
                  <span className="text-muted-foreground">{formatDate(pay.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {payments.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No payments found</div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} &middot; {meta.total} payments
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
    </div>
  );
}
