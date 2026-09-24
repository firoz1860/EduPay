import { prisma } from '../../config/prisma';
import { toNumber } from '../../lib/money';

/**
 * Gathers VERIFIED, backend-computed financial figures. This is the only source
 * of numbers the AI is ever allowed to talk about. Everything here is a
 * deterministic aggregate straight from the database.
 */
export interface VerifiedContext {
  totals: { totalFees: number; collected: number; outstanding: number; overdue: number };
  payments: { successful: number; failed: number; pending: number };
  refunds: { completedCount: number; completedAmount: number };
  reconciliation: {
    total: number;
    issues: number;
    byStatus: Record<string, number>;
    openExamples: { status: string; internal: string | null; internalAmount: number | null; gatewayAmount: number | null; notes: string | null }[];
  };
  outstandingByDepartment: { department: string; outstanding: number; students: number }[];
}

export async function buildVerifiedContext(): Promise<VerifiedContext> {
  const [
    feesAgg,
    collectedAgg,
    outstandingAgg,
    overdueAgg,
    successful,
    failed,
    pending,
    refundAgg,
    reconGroups,
    openRecon,
    departments,
  ] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { payableAmount: true }, where: { status: { not: 'CANCELLED' } } }),
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { status: { not: 'CANCELLED' } } }),
    prisma.invoice.aggregate({
      _sum: { outstandingAmount: true },
      where: { status: { notIn: ['CANCELLED', 'PAID'] } },
    }),
    prisma.invoice.aggregate({ _sum: { outstandingAmount: true }, where: { status: 'OVERDUE' } }),
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.count({ where: { status: { in: ['CREATED', 'PENDING'] } } }),
    prisma.refund.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: 'COMPLETED' } }),
    prisma.reconciliationRecord.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.reconciliationRecord.findMany({
      where: { status: { notIn: ['MATCHED', 'RESOLVED'] } },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const g of reconGroups) byStatus[g.status] = g._count._all;
  const issues = Object.entries(byStatus)
    .filter(([s]) => s !== 'MATCHED' && s !== 'RESOLVED')
    .reduce((acc, [, n]) => acc + n, 0);
  const totalRecon = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const outstandingByDepartment = await Promise.all(
    departments.map(async (d) => {
      const agg = await prisma.invoice.aggregate({
        _sum: { outstandingAmount: true },
        where: { status: { notIn: ['CANCELLED', 'PAID'] }, student: { departmentId: d.id } },
      });
      const students = await prisma.student.count({ where: { departmentId: d.id } });
      return { department: d.name, outstanding: toNumber(agg._sum.outstandingAmount), students };
    }),
  );

  return {
    totals: {
      totalFees: toNumber(feesAgg._sum.payableAmount),
      collected: toNumber(collectedAgg._sum.paidAmount),
      outstanding: toNumber(outstandingAgg._sum.outstandingAmount),
      overdue: toNumber(overdueAgg._sum.outstandingAmount),
    },
    payments: { successful, failed, pending },
    refunds: {
      completedCount: refundAgg._count._all,
      completedAmount: toNumber(refundAgg._sum.amount),
    },
    reconciliation: {
      total: totalRecon,
      issues,
      byStatus,
      openExamples: openRecon.map((r) => ({
        status: r.status,
        internal: r.internalPaymentNumber,
        internalAmount: r.internalAmount != null ? toNumber(r.internalAmount) : null,
        gatewayAmount: r.gatewayAmount != null ? toNumber(r.gatewayAmount) : null,
        notes: r.notes,
      })),
    },
    outstandingByDepartment: outstandingByDepartment
      .filter((d) => d.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding),
  };
}
