'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
  STUDENT_STATUS_COLORS,
  STUDENT_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import type { Student, Invoice } from '@/types';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  Building2,
  BookOpen,
} from 'lucide-react';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: student,
    isLoading: loadingStudent,
    isError: studentError,
  } = useQuery({
    queryKey: ['students', id],
    queryFn: async () => (await api.get<Student>(`/students/${id}`)).data,
    enabled: !!id,
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', { studentId: id }],
    queryFn: async () => (await api.get<Invoice[]>('/invoices', { studentId: id })).data,
    enabled: !!id,
  });

  const loading = loadingStudent || loadingInvoices;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (studentError || !student) {
    return <div className="py-12 text-center text-muted-foreground">Student not found</div>;
  }

  const invoiceList = invoices ?? [];
  const totalPayable = invoiceList.reduce((sum, i) => sum + Number(i.payableAmount), 0);
  const totalPaid = invoiceList.reduce((sum, i) => sum + Number(i.paidAmount), 0);
  const totalOutstanding = student.invoiceSummary?.outstanding ?? invoiceList.reduce((sum, i) => sum + Number(i.outstandingAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/students')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={student.fullName} description={`${student.rollNumber} • ${student.academicYear}`} />
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
              <span>Enrolled {formatDate(student.enrollmentDate)}</span>
            </div>
            <div className="pt-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STUDENT_STATUS_COLORS[student.status]}`}>
                {STUDENT_STATUS_LABELS[student.status]}
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
            {student.invoiceSummary && (
              <p className="mt-3 text-xs text-muted-foreground">
                {student.invoiceSummary.count} invoice{student.invoiceSummary.count === 1 ? '' : 's'} on record
              </p>
            )}
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
            {invoiceList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No invoices</p>
            ) : (
              invoiceList.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(Number(inv.payableAmount))}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid: {formatCurrency(Number(inv.paidAmount))}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
