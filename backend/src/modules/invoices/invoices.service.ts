import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { round2, sub, toNumber, ZERO, gt } from '../../lib/money';
import { generateNumber } from '../../lib/sequence';
import { NotFoundError, UnprocessableError, ForbiddenError } from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import { computeInvoiceTotals, computeOutstanding } from '../../services/invoice-math';
import { publishInvoiceCreated } from '../../realtime/publish';
import { toSkipTake, buildMeta } from '../../lib/pagination';
import { UNMATCHABLE_UUID, type Actor } from '../../lib/actor';
import type { CreateInvoiceInput, ListInvoicesQuery } from './invoices.schema';

function assertOwnership(actor: Actor, studentId: string): void {
  if (actor.role === 'STUDENT' && actor.studentId !== studentId) {
    throw new ForbiddenError('You can only access your own invoices');
  }
}

interface LineItem {
  feeHeadId: string | null;
  feeHeadName: string;
  amount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountLabel: string | null;
  sortOrder: number;
}

/** Split a payable amount into N installments (equal, remainder on the last). */
function splitInstallments(payable: Prisma.Decimal, count: number): Prisma.Decimal[] {
  if (count <= 1) return [round2(payable)];
  const base = round2(payable.div(count));
  const parts: Prisma.Decimal[] = [];
  let accumulated = ZERO;
  for (let i = 0; i < count - 1; i += 1) {
    parts.push(base);
    accumulated = accumulated.add(base);
  }
  parts.push(round2(sub(payable, accumulated)));
  return parts;
}

export async function createInvoice(input: CreateInvoiceInput, actor: Actor, requestId: string) {
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new NotFoundError('Student not found');

  // Derive line items from a fee structure, or use explicit items. Never trust client totals.
  let items: LineItem[] = [];
  let academicYear = input.academicYear ?? student.academicYear;
  let semester = input.semester ?? student.semester;

  if (input.feeStructureId) {
    const structure = await prisma.feeStructure.findUnique({
      where: { id: input.feeStructureId },
      include: { items: { include: { feeHead: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!structure) throw new NotFoundError('Fee structure not found');
    academicYear = input.academicYear ?? structure.academicYear;
    semester = input.semester ?? structure.semester;
    items = structure.items.map((it, idx) => ({
      feeHeadId: it.feeHeadId,
      feeHeadName: it.feeHead.name,
      amount: round2(it.amount),
      discountAmount: round2(it.discountAmount),
      discountLabel: it.discountLabel,
      sortOrder: it.sortOrder ?? idx,
    }));
  } else if (input.items) {
    items = input.items.map((it, idx) => ({
      feeHeadId: it.feeHeadId ?? null,
      feeHeadName: it.feeHeadName,
      amount: round2(it.amount),
      discountAmount: round2(it.discountAmount ?? 0),
      discountLabel: it.discountLabel ?? null,
      sortOrder: idx,
    }));
  }

  if (items.length === 0) throw new UnprocessableError('Invoice must have at least one line item');

  const totals = computeInvoiceTotals(
    items.map((i) => ({ amount: i.amount, discountAmount: i.discountAmount })),
    input.taxAmount,
  );

  const dueDate = input.dueDate ? new Date(input.dueDate) : null;
  const status = input.issue ? 'ISSUED' : 'DRAFT';
  const outstanding = input.issue ? totals.payableAmount : ZERO;

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        invoiceNumber: generateNumber('INV'),
        studentId: student.id,
        feeStructureId: input.feeStructureId ?? null,
        academicYear,
        semester,
        totalAmount: totals.totalAmount,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        payableAmount: totals.payableAmount,
        paidAmount: ZERO,
        outstandingAmount: outstanding,
        dueDate,
        status,
        notes: input.notes ?? null,
        createdBy: actor.sub,
        items: {
          create: items.map((it) => ({
            feeHeadId: it.feeHeadId,
            feeHeadName: it.feeHeadName,
            amount: it.amount,
            discountAmount: it.discountAmount,
            discountLabel: it.discountLabel,
            sortOrder: it.sortOrder,
          })),
        },
      },
    });

    // Optional installment plan.
    if (input.installmentCount && input.installmentCount > 1) {
      const parts = splitInstallments(totals.payableAmount, input.installmentCount);
      await tx.installment.createMany({
        data: parts.map((amt, i) => ({
          invoiceId: created.id,
          installmentNumber: i + 1,
          label: `Installment ${i + 1}`,
          amount: amt,
          paidAmount: ZERO,
          outstandingAmount: amt,
          dueDate: dueDate
            ? new Date(dueDate.getTime() + i * 30 * 24 * 60 * 60 * 1000)
            : null,
          status: 'PENDING',
        })),
      });
    }

    await recordAudit(tx, {
      actor,
      action: 'INVOICE_CREATED',
      entity: 'Invoice',
      entityId: created.id,
      newValue: {
        invoiceNumber: created.invoiceNumber,
        payableAmount: toNumber(totals.payableAmount),
        status,
      },
      requestId,
    });

    return created;
  });

  await publishInvoiceCreated(invoice.id);

  return getInvoiceById(invoice.id, actor);
}

export async function issueInvoice(id: string, actor: Actor, requestId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (invoice.status !== 'DRAFT') {
    throw new UnprocessableError(`Only DRAFT invoices can be issued (current: ${invoice.status})`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: { status: 'ISSUED', outstandingAmount: invoice.payableAmount },
    });
    await recordAudit(tx, {
      actor,
      action: 'INVOICE_ISSUED',
      entity: 'Invoice',
      entityId: id,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'ISSUED' },
      requestId,
    });
  });
  return getInvoiceById(id, actor);
}

export async function cancelInvoice(id: string, reason: string | undefined, actor: Actor, requestId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (invoice.status === 'CANCELLED') return getInvoiceById(id, actor);
  if (gt(invoice.paidAmount, ZERO)) {
    throw new UnprocessableError('Cannot cancel an invoice that has received payments; issue a refund instead');
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status: 'CANCELLED', outstandingAmount: ZERO } });
    await recordAudit(tx, {
      actor,
      action: 'INVOICE_CANCELLED',
      entity: 'Invoice',
      entityId: id,
      oldValue: { status: invoice.status },
      newValue: { status: 'CANCELLED' },
      reason: reason ?? null,
      requestId,
    });
  });
  return getInvoiceById(id, actor);
}

const invoiceInclude = {
  student: {
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      email: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
  items: { orderBy: { sortOrder: 'asc' as const } },
  installments: { orderBy: { installmentNumber: 'asc' as const } },
  payments: {
    select: { id: true, paymentNumber: true, amount: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

function serialize(inv: InvoiceRow) {
  return {
    ...inv,
    totalAmount: toNumber(inv.totalAmount),
    discountAmount: toNumber(inv.discountAmount),
    taxAmount: toNumber(inv.taxAmount),
    payableAmount: toNumber(inv.payableAmount),
    paidAmount: toNumber(inv.paidAmount),
    outstandingAmount: toNumber(inv.outstandingAmount),
    items: inv.items.map((it) => ({
      ...it,
      amount: toNumber(it.amount),
      discountAmount: toNumber(it.discountAmount),
    })),
    installments: inv.installments.map((it) => ({
      ...it,
      amount: toNumber(it.amount),
      paidAmount: toNumber(it.paidAmount),
      outstandingAmount: toNumber(it.outstandingAmount),
    })),
    payments: inv.payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
  };
}

export async function getInvoiceById(id: string, actor: Actor) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw new NotFoundError('Invoice not found');
  assertOwnership(actor, invoice.studentId);
  return serialize(invoice);
}

export async function listInvoices(query: ListInvoicesQuery, actor: Actor) {
  const { skip, take } = toSkipTake(query.page, query.pageSize);
  const where: Prisma.InvoiceWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.academicYear) where.academicYear = query.academicYear;
  if (actor.role === 'STUDENT') where.studentId = actor.studentId ?? UNMATCHABLE_UUID;
  else if (query.studentId) where.studentId = query.studentId;
  if (query.search) {
    where.OR = [
      { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
      { student: { fullName: { contains: query.search, mode: 'insensitive' } } },
      { student: { rollNumber: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: { createdAt: query.sortOrder }, skip, take }),
    prisma.invoice.count({ where }),
  ]);
  return { data: rows.map(serialize), meta: buildMeta(query.page, query.pageSize, total) };
}
