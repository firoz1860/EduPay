'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface ReportData {
  collectionByDept: { name: string; collected: number; outstanding: number }[];
  collectionByFeeHead: { name: string; amount: number }[];
  paymentStatus: { name: string; value: number; color: string }[];
  invoiceStatus: { name: string; value: number; color: string }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      const [
        { data: invoices },
        { data: payments },
      ] = await Promise.all([
        supabase.from('invoices').select('payable_amount, paid_amount, outstanding_amount, status, student:students(department:departments(name))'),
        supabase.from('payments').select('amount, status'),
      ]);

      // Collection by department
      const deptMap = new Map<string, { collected: number; outstanding: number }>();
      (invoices || []).forEach((inv) => {
        const student = inv.student as unknown as Record<string, unknown> | null;
        const dept = student?.department as unknown as Record<string, unknown> | null;
        const name = (dept?.name as string) || 'Unknown';
        if (!deptMap.has(name)) deptMap.set(name, { collected: 0, outstanding: 0 });
        const entry = deptMap.get(name)!;
        entry.collected += Number(inv.paid_amount);
        entry.outstanding += Number(inv.outstanding_amount);
      });
      const collectionByDept = Array.from(deptMap.entries()).map(([name, v]) => ({ name, ...v }));

      // Collection by fee head
      const { data: invoiceItems } = await supabase
        .from('invoice_items')
        .select('fee_head_name, amount, discount_amount');
      const headMap = new Map<string, number>();
      (invoiceItems || []).forEach((item) => {
        const net = Number(item.amount) - Number(item.discount_amount);
        headMap.set(item.fee_head_name, (headMap.get(item.fee_head_name) || 0) + net);
      });
      const collectionByFeeHead = Array.from(headMap.entries()).map(([name, amount]) => ({ name, amount }));

      // Payment status
      const paymentStatus = [
        { name: 'Success', value: (payments || []).filter((p) => p.status === 'SUCCESS').length, color: '#10b981' },
        { name: 'Pending', value: (payments || []).filter((p) => p.status === 'PENDING' || p.status === 'CREATED').length, color: '#f59e0b' },
        { name: 'Failed', value: (payments || []).filter((p) => p.status === 'FAILED').length, color: '#f43f5e' },
        { name: 'Refunded', value: (payments || []).filter((p) => p.status === 'REFUNDED').length, color: '#8b5cf6' },
      ].filter((p) => p.value > 0);

      // Invoice status
      const invoiceStatus = [
        { name: 'Paid', value: (invoices || []).filter((i) => i.status === 'PAID').length, color: '#10b981' },
        { name: 'Partially Paid', value: (invoices || []).filter((i) => i.status === 'PARTIALLY_PAID').length, color: '#f59e0b' },
        { name: 'Issued', value: (invoices || []).filter((i) => i.status === 'ISSUED').length, color: '#3b82f6' },
        { name: 'Overdue', value: (invoices || []).filter((i) => i.status === 'OVERDUE').length, color: '#f43f5e' },
        { name: 'Draft', value: (invoices || []).filter((i) => i.status === 'DRAFT').length, color: '#94a3b8' },
      ].filter((p) => p.value > 0);

      setData({ collectionByDept, collectionByFeeHead, paymentStatus, invoiceStatus });
      setLoading(false);
    }
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Financial analytics and insights" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Financial analytics and insights" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.collectionByDept || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection by Fee Head</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.collectionByFeeHead || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="amount" name="Amount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data?.paymentStatus || []} cx="50%" cy="50%" outerRadius={100} dataKey="value">
                  {(data?.paymentStatus || []).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data?.invoiceStatus || []} cx="50%" cy="50%" outerRadius={100} dataKey="value">
                  {(data?.invoiceStatus || []).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
