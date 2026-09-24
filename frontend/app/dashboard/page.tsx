'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useEffect, useState } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DashboardData {
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  reconciliationIssues: number;
  collectionByDept: { name: string; collected: number; outstanding: number }[];
  paymentStatusBreakdown: { name: string; value: number; color: string }[];
  recentPayments: {
    payment_number: string;
    amount: number;
    status: string;
    created_at: string;
    student: { full_name: string; roll_number: string } | null;
  }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      const [
        { data: payments },
        { data: invoices },
        { data: recon },
        { data: depts },
        { data: recentPays },
      ] = await Promise.all([
        supabase.from('payments').select('amount, status'),
        supabase.from('invoices').select('payable_amount, paid_amount, outstanding_amount, status, due_date'),
        supabase.from('reconciliation_records').select('status').neq('status', 'MATCHED').neq('status', 'RESOLVED'),
        supabase.from('departments').select('id, name'),
        supabase
          .from('payments')
          .select('payment_number, amount, status, created_at, student:students(full_name, roll_number)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const totalCollected = (payments || [])
        .filter((p) => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const totalOutstanding = (invoices || [])
        .reduce((sum, i) => sum + Number(i.outstanding_amount), 0);

      const totalOverdue = (invoices || [])
        .filter((i) => i.status === 'OVERDUE')
        .reduce((sum, i) => sum + Number(i.outstanding_amount), 0);

      const successfulPayments = (payments || []).filter((p) => p.status === 'SUCCESS').length;
      const failedPayments = (payments || []).filter((p) => p.status === 'FAILED').length;
      const pendingPayments = (payments || []).filter((p) => p.status === 'PENDING' || p.status === 'CREATED').length;

      // Collection by department
      const { data: invoicesWithDept } = await supabase
        .from('invoices')
        .select('paid_amount, outstanding_amount, student:students(department:departments(name))');

      const deptMap = new Map<string, { collected: number; outstanding: number }>();
      (invoicesWithDept || []).forEach((inv) => {
        const deptName = (inv.student as unknown as Record<string, unknown>)?.department as unknown as Record<string, unknown> | undefined;
        const name = (deptName?.name as string) || 'Unknown';
        if (!deptMap.has(name)) deptMap.set(name, { collected: 0, outstanding: 0 });
        const entry = deptMap.get(name)!;
        entry.collected += Number(inv.paid_amount);
        entry.outstanding += Number(inv.outstanding_amount);
      });

      const collectionByDept = Array.from(deptMap.entries()).map(([name, v]) => ({
        name,
        collected: v.collected,
        outstanding: v.outstanding,
      }));

      const paymentStatusBreakdown = [
        { name: 'Success', value: successfulPayments, color: '#10b981' },
        { name: 'Pending', value: pendingPayments, color: '#f59e0b' },
        { name: 'Failed', value: failedPayments, color: '#f43f5e' },
        { name: 'Refunded', value: (payments || []).filter((p) => p.status === 'REFUNDED').length, color: '#8b5cf6' },
      ].filter((p) => p.value > 0);

      setData({
        totalCollected,
        totalOutstanding,
        totalOverdue,
        successfulPayments,
        failedPayments,
        pendingPayments,
        reconciliationIssues: (recon || []).length,
        collectionByDept,
        paymentStatusBreakdown,
        recentPayments: (recentPays || []).map((p) => ({
          payment_number: p.payment_number,
          amount: Number(p.amount),
          status: p.status,
          created_at: p.created_at,
          student: p.student as unknown as { full_name: string; roll_number: string } | null,
        })),
      });
      setLoading(false);
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Financial overview and key metrics" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Collected',
      value: formatCurrency(data?.totalCollected || 0),
      icon: Wallet,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: '+12.5%',
      trendUp: true,
    },
    {
      label: 'Outstanding',
      value: formatCurrency(data?.totalOutstanding || 0),
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      trend: '+3.2%',
      trendUp: false,
    },
    {
      label: 'Overdue',
      value: formatCurrency(data?.totalOverdue || 0),
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      trend: '+1.8%',
      trendUp: false,
    },
    {
      label: 'Reconciliation Issues',
      value: String(data?.reconciliationIssues || 0),
      icon: RefreshCw,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      trend: 'Needs attention',
      trendUp: false,
    },
  ];

  const paymentStats = [
    { label: 'Successful', value: data?.successfulPayments || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending', value: data?.pendingPayments || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Failed', value: data?.failedPayments || 0, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Welcome back, ${user?.full_name}`} />

      {/* Key Metrics */}
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

      {/* Payment Stats */}
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

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.collectionByDept || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data?.paymentStatusBreakdown || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {(data?.paymentStatusBreakdown || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.recentPayments || []).map((payment) => (
              <div
                key={payment.payment_number}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{payment.student?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.payment_number} • {formatDate(payment.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(payment.amount)}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      payment.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-700'
                        : payment.status === 'FAILED'
                        ? 'bg-rose-100 text-rose-700'
                        : payment.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
            {(!data?.recentPayments || data.recentPayments.length === 0) && (
              <p className="py-8 text-center text-sm text-muted-foreground">No recent payments</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
