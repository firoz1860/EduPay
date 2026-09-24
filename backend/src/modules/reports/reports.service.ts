import { prisma } from '../../config/prisma';
import { toNumber } from '../../lib/money';

/**
 * Read-only reporting/analytics module. Every figure is computed with
 * server-side Prisma aggregation (aggregate/groupBy/count) — we never pull
 * full row sets into Node to sum in JavaScript.
 */

const NOT_CANCELLED = { not: 'CANCELLED' } as const;

export interface DashboardQuery {
  academicYear?: string;
}

export async function getDashboard(query: DashboardQuery) {
  const academicYear = query.academicYear;
  const invoiceBase = academicYear ? { academicYear } : {};

  const [
    totalFeesAgg,
    collectedAgg,
    outstandingAgg,
    overdueAgg,
    successfulPayments,
    failedPayments,
    pendingPayments,
    refundsCount,
    refundsAgg,
    reconciliationIssues,
    invoiceStatusGroups,
    paymentStatusGroups,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...invoiceBase, status: NOT_CANCELLED },
      _sum: { payableAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { ...invoiceBase, status: NOT_CANCELLED },
      _sum: { paidAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { ...invoiceBase, status: { notIn: ['CANCELLED', 'PAID'] } },
      _sum: { outstandingAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { ...invoiceBase, status: 'OVERDUE' },
      _sum: { outstandingAmount: true },
    }),
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.count({ where: { status: { in: ['CREATED', 'PENDING'] } } }),
    prisma.refund.count({ where: { status: { in: ['COMPLETED'] } } }),
    prisma.refund.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.reconciliationRecord.count({ where: { status: { notIn: ['MATCHED', 'RESOLVED'] } } }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: invoiceBase,
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  return {
    totalFees: toNumber(totalFeesAgg._sum.payableAmount),
    collected: toNumber(collectedAgg._sum.paidAmount),
    outstanding: toNumber(outstandingAgg._sum.outstandingAmount),
    overdue: toNumber(overdueAgg._sum.outstandingAmount),
    successfulPayments,
    failedPayments,
    pendingPayments,
    refundsCount,
    refundsAmount: toNumber(refundsAgg._sum.amount),
    reconciliationIssues,
    invoiceStatusBreakdown: invoiceStatusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    paymentStatusBreakdown: paymentStatusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
  };
}

export async function getCollectionByDepartment() {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const rows = await Promise.all(
    departments.map(async (dept) => {
      const agg = await prisma.invoice.aggregate({
        where: { student: { departmentId: dept.id } },
        _sum: { paidAmount: true, outstandingAmount: true },
        _count: { _all: true },
      });
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        collected: toNumber(agg._sum.paidAmount),
        outstanding: toNumber(agg._sum.outstandingAmount),
        invoiceCount: agg._count._all,
      };
    }),
  );

  return rows;
}

export async function getCollectionByFeeHead() {
  const groups = await prisma.invoiceItem.groupBy({
    by: ['feeHeadName'],
    _sum: { amount: true, discountAmount: true },
    _count: { _all: true },
    orderBy: { feeHeadName: 'asc' },
  });

  return groups.map((g) => {
    const charged = toNumber(g._sum.amount);
    const discount = toNumber(g._sum.discountAmount);
    return {
      feeHeadName: g.feeHeadName,
      charged,
      discount,
      netCharged: charged - discount,
      lineCount: g._count._all,
    };
  });
}

export async function getPaymentStatusReport() {
  const groups = await prisma.payment.groupBy({
    by: ['status'],
    _count: { _all: true },
    _sum: { amount: true },
  });

  return groups.map((g) => ({
    status: g.status,
    count: g._count._all,
    amount: toNumber(g._sum.amount),
  }));
}

export async function getOutstandingInvoices() {
  const invoices = await prisma.invoice.findMany({
    where: {
      outstandingAmount: { gt: 0 },
      status: { notIn: ['CANCELLED', 'PAID'] },
    },
    orderBy: { outstandingAmount: 'desc' },
    take: 20,
    include: {
      student: { select: { fullName: true, rollNumber: true } },
    },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    studentId: inv.studentId,
    student: inv.student,
    academicYear: inv.academicYear,
    status: inv.status,
    payableAmount: toNumber(inv.payableAmount),
    paidAmount: toNumber(inv.paidAmount),
    outstandingAmount: toNumber(inv.outstandingAmount),
    dueDate: inv.dueDate,
  }));
}
