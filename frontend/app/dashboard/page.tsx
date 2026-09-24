'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useQuery } from '@tanstack/react-query';
import type { DashboardData, Payment } from '@/types';
import {
  Wallet, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface DeptCollection {
  departmentId: string;
  departmentName: string;
  collected: number;
  outstanding: number;
  invoiceCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: '#10b981',
  PENDING: '#f59e0b',
  CREATED: '#f59e0b',
  FAILED: '#f43f5e',
  REFUNDED: '#8b5cf6',
  REFUND_PENDING: '#8b5cf6',
  CANCELLED: '#94a3b8',
};

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: dashboard, isLoading: loadingDash } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/reports/dashboard')).data,
  });

  const { data: deptData } = useQuery({
    queryKey: ['reports', 'collection-by-department'],
    queryFn: async () => (await api.get<DeptCollection[]>('/reports/collection-by-department')).data,
  });

  const { data: recentPayments } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () =>
      (await api.get<Payment[]>('/payments', { pageSize: 5, sortOrder: 'desc' })).data,
  });

  if (loadingDash) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Financial overview and key metrics" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const collectionByDept = (deptData || [])
    .filter((d) => d.collected > 0 || d.outstanding > 0)
    .map((d) => ({ name: d.departmentName, collected: d.collected, outstanding: d.outstanding }));

  const paymentStatusBreakdown = (dashboard?.paymentStatusBreakdown || [])
    .filter((p) => p.count > 0)
    .map((p) => ({ name: p.status, value: p.count, color: STATUS_COLORS[p.status] ?? '#94a3b8' }));

  const stats = [
    { label: 'Total Collected', value: formatCurrency(dashboard?.collected || 0), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Settled to date', trendUp: true },
    { label: 'Outstanding', value: formatCurrency(dashboard?.outstanding || 0), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Awaiting payment', trendUp: false },
    { label: 'Overdue', value: formatCurrency(dashboard?.overdue || 0), icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', trend: 'Past due', trendUp: false },
    { label: 'Reconciliation Issues', value: String(dashboard?.reconciliationIssues || 0), icon: RefreshCw, color: 'text-violet-600', bg: 'bg-violet-50', trend: 'Needs attention', trendUp: false },
  ];

  const paymentStats = [
    { label: 'Successful', value: dashboard?.successfulPayments || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending', value: dashboard?.pendingPayments || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Failed', value: dashboard?.failedPayments || 0, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Welcome back, ${user?.fullName ?? ''}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${stat.trendUp ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {stat.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {stat.trend}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {paymentStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label} Payments</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Collection by Department</CardTitle></CardHeader>
          <CardContent>
            {collectionByDept.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No collection data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={collectionByDept}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Payment Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {paymentStatusBreakdown.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No payment data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={paymentStatusBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {paymentStatusBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(recentPayments || []).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{payment.student?.fullName || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{payment.paymentNumber} • {formatDate(payment.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(payment.amount)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    payment.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700'
                    : payment.status === 'FAILED' ? 'bg-rose-100 text-rose-700'
                    : payment.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700'}`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
            {(!recentPayments || recentPayments.length === 0) && (
              <p className="py-8 text-center text-sm text-muted-foreground">No recent payments</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
