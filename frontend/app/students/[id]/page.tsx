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
  STUDENT_STATUS_COLORS,
  STUDENT_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  Building2,
  BookOpen,
} from 'lucide-react';

interface StudentDetail {
  id: string;
  roll_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  academic_year: string;
  semester: number;
  enrollment_date: string;
  status: string;
  department: { name: string; code: string } | null;
  course: { name: string; code: string } | null;
}

interface StudentInvoice {
  id: string;
  invoice_number: string;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: string;
  due_date: string | null;
}

interface StudentPayment {
  id: string;
  payment_number: string;
  amount: number;
  status: string;
  created_at: string;
  invoice: { invoice_number: string } | null;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const id = params.id as string;
      const [
        { data: studentData },
        { data: invoiceData },
        { data: paymentData },
      ] = await Promise.all([
        supabase
          .from('students')
          .select('*, department:departments(name, code), course:courses(name, code)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('invoices')
          .select('id, invoice_number, payable_amount, paid_amount, outstanding_amount, status, due_date')
          .eq('student_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('id, payment_number, amount, status, created_at, invoice:invoices(invoice_number)')
          .eq('student_id', id)
          .order('created_at', { ascending: false }),
      ]);

      setStudent(studentData as StudentDetail | null);
      setInvoices((invoiceData || []) as StudentInvoice[]);
      setPayments((paymentData || []) as StudentPayment[]);
      setLoading(false);
    }
    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!student) {
    return <div className="py-12 text-center text-muted-foreground">Student not found</div>;
  }

  const totalPayable = invoices.reduce((sum, i) => sum + Number(i.payable_amount), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.paid_amount), 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + Number(i.outstanding_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/students')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={student.full_name} description={`${student.roll_number} • ${student.academic_year}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{student.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{student.phone || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{student.department?.name || 'Not assigned'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>{student.course?.name || 'Not assigned'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span>Semester {student.semester}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Enrolled {formatDate(student.enrollment_date)}</span>
            </div>
            <div className="pt-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STUDENT_STATUS_COLORS[student.status as keyof typeof STUDENT_STATUS_COLORS]}`}>
                {STUDENT_STATUS_LABELS[student.status as keyof typeof STUDENT_STATUS_LABELS]}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Total Payable</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totalPayable)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Total Paid</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-xs text-amber-700">Outstanding</p>
                <p className="mt-1 text-xl font-bold text-amber-700">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No invoices</p>
            ) : (
              invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">Due: {formatDate(inv.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(Number(inv.payable_amount))}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid: {formatCurrency(Number(inv.paid_amount))}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status as keyof typeof INVOICE_STATUS_COLORS]}`}>
                      {INVOICE_STATUS_LABELS[inv.status as keyof typeof INVOICE_STATUS_LABELS]}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments</p>
            ) : (
              payments.map((pay) => (
                <div
                  key={pay.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{pay.payment_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {pay.invoice?.invoice_number || '-'} • {formatDate(pay.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatCurrency(Number(pay.amount))}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_COLORS[pay.status as keyof typeof PAYMENT_STATUS_COLORS]}`}>
                      {PAYMENT_STATUS_LABELS[pay.status as keyof typeof PAYMENT_STATUS_LABELS]}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
