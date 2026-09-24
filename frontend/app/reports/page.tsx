'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import type { DashboardData, InvoiceStatus } from '@/types';
import { Wallet, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface DeptCollection {
  departmentId: string;
  departmentName: string;
  collected: number;
  outstanding: number;
  invoiceCount: number;
}

interface FeeHeadCollection {
  feeHeadName: string;
  charged: number;
  discount: number;
  netCharged: number;
  lineCount: number;
}

interface PaymentStatusRow {
  status: string;
  count: number;
  amount: number;
}

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  student: { fullName: string; rollNumber: string } | null;
  academicYear: string;
  status: InvoiceStatus;
  payableAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string | null;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  SUCCESS: '#10b981',
  PENDING: '#f59e0b',
  CREATED: '#f59e0b',
  FAILED: '#f43f5e',
  REFUNDED: '#8b5cf6',
  REFUND_PENDING: '#8b5cf6',
  CANCELLED: '#94a3b8',
};

export default function ReportsPage() {
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/reports/dashboard')).data,
  });

  const { data: deptData, isLoading: loadingDept } = useQuery({
    queryKey: ['reports', 'collection-by-department'],
    queryFn: async () => (await api.get<DeptCollection[]>('/reports/collection-by-department')).data,
  });

  const { data: feeHeadData, isLoading: loadingFeeHead } = useQuery({
    queryKey: ['reports', 'collection-by-fee-head'],
    queryFn: async () => (await api.get<FeeHeadCollection[]>('/reports/collection-by-fee-head')).data,
  });

  const { data: paymentStatusData, isLoading: loadingPaymentStatus } = useQuery({
    queryKey: ['reports', 'payment-status'],
    queryFn: async () => (await api.get<PaymentStatusRow[]>('/reports/payment-status')).data,
  });

  const { data: outstandingData, isLoading: loadingOutstanding } = useQuery({
    queryKey: ['reports', 'outstanding'],
    queryFn: async () => (await api.get<OutstandingInvoice[]>('/reports/outstanding')).data,
  });

  const loading = loadingDashboard || loadingDept || loadingFeeHead || loadingPaymentStatus || loadingOutstanding;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Financial analytics and insights" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const collectionByDept = (deptData || [])
    .filter((d) => d.collected > 0 || d.outstanding > 0)
    .map((d) => ({ name: d.departmentName, collected: d.collected, outstanding: d.outstanding }));

  const collectionByFeeHead = (feeHeadData || []).map((f) => ({
    name: f.feeHeadName,
    charged: f.charged,
    discount: f.discount,
    netCharged: f.netCharged,
  }));

  const paymentStatusChart = (paymentStatusData || [])
    .filter((p) => p.count > 0)
    .map((p) => ({ name: p.status, value: p.count, color: PAYMENT_STATUS_COLORS[p.status] ?? '#94a3b8' }));

  const kpis = [
    { label: 'Total Fees', value: formatCurrency(dashboard?.totalFees || 0), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Collected', value: formatCurrency(dashboard?.collected || 0), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Outstanding', value: formatCurrency(dashboard?.outstanding || 0), icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Reconciliation Issues', value: String(dashboard?.reconciliationIssues || 0), icon: RefreshCw, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Financial analytics and insights" />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {collectionByDept.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No collection data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={collectionByDept}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection by Fee Head</CardTitle>
          </CardHeader>
          <CardContent>
            {collectionByFeeHead.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No fee head data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={collectionByFeeHead} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="netCharged" name="Net Charged" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentStatusChart.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No payment data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={paymentStatusChart} cx="50%" cy="50%" outerRadius={100} dataKey="value">
                    {paymentStatusChart.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee Head Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {(feeHeadData || []).length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No fee head data yet</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fee Head</TableHead>
                      <TableHead className="text-right">Charged</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(feeHeadData || []).map((f) => (
                      <TableRow key={f.feeHeadName}>
                        <TableCell className="text-sm font-medium">{f.feeHeadName}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(f.charged)}</TableCell>
                        <TableCell className="text-right text-sm text-amber-600">{formatCurrency(f.discount)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatCurrency(f.netCharged)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{f.lineCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Outstanding Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {(outstandingData || []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No outstanding invoices</p>
          ) : (
            <>
              <div className="hidden md:block">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(outstandingData || []).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          <p className="font-medium">{inv.student?.fullName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{inv.student?.rollNumber}</p>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.payableAmount)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(inv.paidAmount)}</TableCell>
                        <TableCell className="text-right font-semibold text-amber-600">{formatCurrency(inv.outstandingAmount)}</TableCell>
                        <TableCell>{formatDate(inv.dueDate)}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {(outstandingData || []).map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-medium">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{inv.student?.fullName}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-xs">
                        <span className="font-semibold text-amber-600">{formatCurrency(inv.outstandingAmount)}</span>
                        <span className="text-muted-foreground">Due: {formatDate(inv.dueDate)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
