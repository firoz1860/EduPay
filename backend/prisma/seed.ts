/**
 * EduPay demo seed.
 *
 * Populates a coherent demo dataset: users for every role (bcrypt-hashed),
 * departments/courses/fee heads/structures, students, invoices with
 * installments, and a spread of payment / ledger / reconciliation scenarios
 * (MATCHED, AMOUNT_MISMATCH, STATE_MISMATCH, MISSING_GATEWAY, DUPLICATE) plus a
 * completed refund and audit entries — everything needed for the demo flow.
 *
 * Idempotent-by-reset: clears the demo tables first, then inserts fresh.
 * Run with: npm run seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const PASSWORD = 'demo1234';

// Fixed IDs so relationships are deterministic across reseeds.
const U = {
  admin: '11111111-1111-1111-1111-111111111111',
  finance: '22222222-2222-2222-2222-222222222222',
  accountant: '33333333-3333-3333-3333-333333333333',
  auditor: '44444444-4444-4444-4444-444444444444',
  student: '55555555-5555-5555-5555-555555555555',
};

async function reset(): Promise<void> {
  // Child-first deletion order to respect FKs.
  await prisma.auditLog.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.reconciliationRecord.deleteMany();
  await prisma.gatewayEvent.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.feeStructureItem.deleteMany();
  await prisma.feeStructure.deleteMany();
  await prisma.student.deleteMany();
  await prisma.course.deleteMany();
  await prisma.feeHead.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  console.log('🌱 Resetting demo data…');
  await reset();

  const hash = await bcrypt.hash(PASSWORD, 10);

  console.log('👤 Users…');
  await prisma.user.createMany({
    data: [
      { id: U.admin, email: 'admin@edupay.edu', passwordHash: hash, fullName: 'Aisha Admin', role: 'ADMIN' },
      { id: U.finance, email: 'finance@edupay.edu', passwordHash: hash, fullName: 'Farid Finance', role: 'FINANCE_MANAGER' },
      { id: U.accountant, email: 'accountant@edupay.edu', passwordHash: hash, fullName: 'Anil Accountant', role: 'ACCOUNTANT' },
      { id: U.auditor, email: 'auditor@edupay.edu', passwordHash: hash, fullName: 'Uma Auditor', role: 'AUDITOR' },
      { id: U.student, email: 'student1@edupay.edu', passwordHash: hash, fullName: 'Sana Student', role: 'STUDENT' },
    ],
  });

  console.log('🏛️  Departments & courses…');
  const cse = await prisma.department.create({ data: { name: 'Computer Science', code: 'CSE', description: 'School of Computing' } });
  const ece = await prisma.department.create({ data: { name: 'Electronics', code: 'ECE', description: 'Electronics & Communication' } });
  const mech = await prisma.department.create({ data: { name: 'Mechanical', code: 'MECH', description: 'Mechanical Engineering' } });

  const btechCse = await prisma.course.create({ data: { name: 'B.Tech CSE', code: 'BT-CSE', departmentId: cse.id, durationYears: 4 } });
  const btechEce = await prisma.course.create({ data: { name: 'B.Tech ECE', code: 'BT-ECE', departmentId: ece.id, durationYears: 4 } });
  const btechMech = await prisma.course.create({ data: { name: 'B.Tech MECH', code: 'BT-MECH', departmentId: mech.id, durationYears: 4 } });

  console.log('💰 Fee heads…');
  const fh = await Promise.all(
    [
      { name: 'Tuition', code: 'TUITION' },
      { name: 'Hostel', code: 'HOSTEL', isOptional: true },
      { name: 'Transport', code: 'TRANSPORT', isOptional: true },
      { name: 'Library', code: 'LIBRARY' },
      { name: 'Examination', code: 'EXAM' },
      { name: 'Miscellaneous', code: 'MISC', isOptional: true },
    ].map((d) => prisma.feeHead.create({ data: d })),
  );
  const feeHeadByCode = Object.fromEntries(fh.map((f) => [f.code, f]));

  console.log('🧾 Fee structures…');
  const ay = '2026-2027';
  const cseStructure = await prisma.feeStructure.create({
    data: {
      name: 'B.Tech CSE — Sem 1 (2026-27)',
      departmentId: cse.id,
      courseId: btechCse.id,
      academicYear: ay,
      semester: 1,
      status: 'ACTIVE',
      createdBy: U.accountant,
      totalAmount: D(78000),
      items: {
        create: [
          { feeHeadId: feeHeadByCode.TUITION.id, amount: D(50000), discountAmount: D(10000), discountLabel: 'Merit Scholarship', sortOrder: 0 },
          { feeHeadId: feeHeadByCode.HOSTEL.id, amount: D(20000), discountAmount: D(0), sortOrder: 1 },
          { feeHeadId: feeHeadByCode.LIBRARY.id, amount: D(5000), discountAmount: D(0), sortOrder: 2 },
          { feeHeadId: feeHeadByCode.EXAM.id, amount: D(3000), discountAmount: D(0), sortOrder: 3 },
        ],
      },
    },
    include: { items: true },
  });

  console.log('🎓 Students…');
  const students = await Promise.all(
    [
      { id: undefined, userId: U.student, roll: 'CSE2026001', name: 'Sana Student', email: 'student1@edupay.edu', dept: cse.id, course: btechCse.id },
      { roll: 'CSE2026002', name: 'Rahul Verma', email: 'rahul@edupay.edu', dept: cse.id, course: btechCse.id },
      { roll: 'CSE2026003', name: 'Neha Gupta', email: 'neha@edupay.edu', dept: cse.id, course: btechCse.id },
      { roll: 'ECE2026001', name: 'Imran Khan', email: 'imran@edupay.edu', dept: ece.id, course: btechEce.id },
      { roll: 'ECE2026002', name: 'Divya Rao', email: 'divya@edupay.edu', dept: ece.id, course: btechEce.id },
      { roll: 'MECH2026001', name: 'Karan Mehta', email: 'karan@edupay.edu', dept: mech.id, course: btechMech.id },
    ].map((s) =>
      prisma.student.create({
        data: {
          userId: s.userId ?? null,
          rollNumber: s.roll,
          fullName: s.name,
          email: s.email,
          departmentId: s.dept,
          courseId: s.course,
          academicYear: ay,
          semester: 1,
          status: 'ACTIVE',
        },
      }),
    ),
  );

  const items = cseStructure.items;
  const payable = D(78000);

  // Helper: create an invoice from the CSE structure for a student.
  async function makeInvoice(studentId: string, opts: { installments?: number; paid?: Prisma.Decimal.Value; status?: string; overdue?: boolean } = {}) {
    const paid = D(opts.paid ?? 0);
    const outstanding = payable.sub(paid);
    const dueDate = opts.overdue ? new Date(Date.now() - 15 * 864e5) : new Date(Date.now() + 30 * 864e5);
    const status = opts.status ?? (paid.equals(payable) ? 'PAID' : paid.gt(0) ? 'PARTIALLY_PAID' : opts.overdue ? 'OVERDUE' : 'ISSUED');
    const number = `INV-2026-${studentId.slice(0, 4).toUpperCase()}${Math.floor(Math.random() * 9000 + 1000)}`;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: number,
        studentId,
        feeStructureId: cseStructure.id,
        academicYear: ay,
        semester: 1,
        totalAmount: D(78000),
        discountAmount: D(10000),
        taxAmount: D(0),
        payableAmount: payable,
        paidAmount: paid,
        outstandingAmount: outstanding.lt(0) ? D(0) : outstanding,
        dueDate,
        status,
        createdBy: U.accountant,
        items: {
          create: items.map((it, idx) => ({
            feeHeadId: it.feeHeadId,
            feeHeadName: ['Tuition', 'Hostel', 'Library', 'Examination'][idx] ?? 'Fee',
            amount: it.amount,
            discountAmount: it.discountAmount,
            discountLabel: it.discountLabel,
            sortOrder: idx,
          })),
        },
      },
    });
    if (opts.installments && opts.installments > 1) {
      const per = payable.div(opts.installments).toDecimalPlaces(2);
      const parts: Prisma.Decimal[] = [];
      let acc = D(0);
      for (let i = 0; i < opts.installments - 1; i++) { parts.push(per); acc = acc.add(per); }
      parts.push(payable.sub(acc));
      await prisma.installment.createMany({
        data: parts.map((amt, i) => ({
          invoiceId: invoice.id,
          installmentNumber: i + 1,
          label: `Installment ${i + 1}`,
          amount: amt,
          paidAmount: D(0),
          outstandingAmount: amt,
          dueDate: new Date(Date.now() + (i + 1) * 30 * 864e5),
          status: 'PENDING',
        })),
      });
    }
    return invoice;
  }

  // Helper: create a settled (SUCCESS) payment + attempt + ledger + gateway event.
  async function makeSuccessPayment(invoiceId: string, studentId: string, amount: Prisma.Decimal, opts: { providerId?: string } = {}) {
    const num = `PAY-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
    const providerId = opts.providerId ?? `pi_${Math.random().toString(36).slice(2, 12)}`;
    const payment = await prisma.payment.create({
      data: {
        paymentNumber: num,
        studentId,
        invoiceId,
        amount,
        currency: 'INR',
        provider: 'STRIPE',
        providerPaymentId: providerId,
        transactionReference: `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        status: 'SUCCESS',
        paymentMethod: 'card',
        createdBy: U.accountant,
      },
    });
    await prisma.paymentAttempt.create({ data: { paymentId: payment.id, attemptNumber: 1, amount, provider: 'STRIPE', providerAttemptId: providerId, status: 'SUCCESS' } });
    await prisma.gatewayEvent.create({ data: { gatewayEventId: `evt_${Math.random().toString(36).slice(2, 12)}`, provider: 'STRIPE', eventType: 'payment_intent.succeeded', paymentId: payment.id, processed: true, processedAt: new Date(), eventData: { amount: amount.toNumber() * 100, currency: 'inr' } as Prisma.InputJsonValue } });
    await prisma.ledgerEntry.create({ data: { reference: `LED-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, type: 'PAYMENT', direction: 'CREDIT', amount, paymentId: payment.id, invoiceId, studentId, description: `Payment ${num} settled` } });
    return payment;
  }

  console.log('🧾 Invoices & payments…');
  // Student 1 (Sana): fully paid in one shot -> MATCHED reconciliation.
  const inv1 = await makeInvoice(students[0].id, { paid: payable, status: 'PAID' });
  const pay1 = await makeSuccessPayment(inv1.id, students[0].id, payable);
  await prisma.reconciliationRecord.create({
    data: { paymentId: pay1.id, internalPaymentNumber: pay1.paymentNumber, internalAmount: payable, internalStatus: 'SUCCESS', gatewayPaymentId: pay1.providerPaymentId, gatewayAmount: payable, gatewayStatus: 'SUCCESS', gatewayEventId: 'evt_matched_1', status: 'MATCHED', notes: 'Internal and gateway records agree.' },
  });

  // Student 2 (Rahul): partial payment (installments) -> PARTIALLY_PAID + MATCHED partial.
  const inv2 = await makeInvoice(students[1].id, { installments: 3, paid: D(26000), status: 'PARTIALLY_PAID' });
  const pay2 = await makeSuccessPayment(inv2.id, students[1].id, D(26000));
  await prisma.reconciliationRecord.create({
    data: { paymentId: pay2.id, internalPaymentNumber: pay2.paymentNumber, internalAmount: D(26000), internalStatus: 'SUCCESS', gatewayPaymentId: pay2.providerPaymentId, gatewayAmount: D(26000), gatewayStatus: 'SUCCESS', status: 'MATCHED', notes: 'Matched.' },
  });

  // Student 3 (Neha): AMOUNT_MISMATCH — internal 39000, gateway 38000.
  const inv3 = await makeInvoice(students[2].id, { paid: D(39000), status: 'PARTIALLY_PAID' });
  const pay3 = await makeSuccessPayment(inv3.id, students[2].id, D(39000));
  await prisma.reconciliationRecord.create({
    data: { paymentId: pay3.id, internalPaymentNumber: pay3.paymentNumber, internalAmount: D(39000), internalStatus: 'SUCCESS', gatewayPaymentId: pay3.providerPaymentId, gatewayAmount: D(38000), gatewayStatus: 'SUCCESS', status: 'AMOUNT_MISMATCH', discrepancyType: 'AMOUNT_MISMATCH', notes: 'Internal amount ₹39,000 does not match gateway amount ₹38,000.' },
  });

  // Student 4 (Imran): STATE_MISMATCH — internal PENDING, gateway SUCCESS.
  const inv4 = await makeInvoice(students[3].id, { status: 'ISSUED', overdue: true });
  const pendingPayNum = `PAY-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  const pay4 = await prisma.payment.create({
    data: { paymentNumber: pendingPayNum, studentId: students[3].id, invoiceId: inv4.id, amount: payable, currency: 'INR', provider: 'STRIPE', providerPaymentId: `pi_pending_${Math.random().toString(36).slice(2, 8)}`, status: 'PENDING', paymentMethod: 'card', createdBy: U.accountant },
  });
  await prisma.paymentAttempt.create({ data: { paymentId: pay4.id, attemptNumber: 1, amount: payable, provider: 'STRIPE', status: 'PENDING' } });
  await prisma.reconciliationRecord.create({
    data: { paymentId: pay4.id, internalPaymentNumber: pay4.paymentNumber, internalAmount: payable, internalStatus: 'PENDING', gatewayPaymentId: pay4.providerPaymentId, gatewayAmount: payable, gatewayStatus: 'SUCCESS', status: 'STATE_MISMATCH', discrepancyType: 'STATE_MISMATCH', notes: 'Internal status PENDING does not match gateway status SUCCESS (payment likely succeeded but callback was lost).' },
  });

  // Student 5 (Divya): a FAILED payment + MISSING_GATEWAY reconciliation on another attempt.
  const inv5 = await makeInvoice(students[4].id, { status: 'ISSUED' });
  const failNum = `PAY-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  const pay5 = await prisma.payment.create({
    data: { paymentNumber: failNum, studentId: students[4].id, invoiceId: inv5.id, amount: payable, currency: 'INR', provider: 'STRIPE', providerPaymentId: `pi_fail_${Math.random().toString(36).slice(2, 8)}`, status: 'FAILED', failureReason: 'card_declined', paymentMethod: 'card', createdBy: U.accountant },
  });
  await prisma.paymentAttempt.create({ data: { paymentId: pay5.id, attemptNumber: 1, amount: payable, provider: 'STRIPE', status: 'FAILED', failureReason: 'card_declined' } });
  const missNum = `PAY-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  const pay5b = await prisma.payment.create({
    data: { paymentNumber: missNum, studentId: students[4].id, invoiceId: inv5.id, amount: D(15000), currency: 'INR', provider: 'STRIPE', providerPaymentId: `pi_miss_${Math.random().toString(36).slice(2, 8)}`, status: 'SUCCESS', paymentMethod: 'upi', createdBy: U.accountant },
  });
  await prisma.reconciliationRecord.create({
    data: { paymentId: pay5b.id, internalPaymentNumber: pay5b.paymentNumber, internalAmount: D(15000), internalStatus: 'SUCCESS', gatewayPaymentId: pay5b.providerPaymentId, gatewayAmount: null, gatewayStatus: null, status: 'MISSING_GATEWAY', discrepancyType: 'MISSING_GATEWAY', notes: 'Internal payment recorded as SUCCESS but no matching gateway record was found.' },
  });

  // Student 6 (Karan): DUPLICATE — two internal payments referencing the same gateway id.
  const inv6 = await makeInvoice(students[5].id, { paid: payable, status: 'PAID' });
  const dupProvider = `pi_dup_${Math.random().toString(36).slice(2, 8)}`;
  const payA = await makeSuccessPayment(inv6.id, students[5].id, payable, { providerId: dupProvider });
  const payB = await prisma.payment.create({
    data: { paymentNumber: `PAY-2026-${Math.floor(Math.random() * 900000 + 100000)}`, studentId: students[5].id, invoiceId: inv6.id, amount: payable, currency: 'INR', provider: 'STRIPE', providerPaymentId: dupProvider, status: 'SUCCESS', paymentMethod: 'card', createdBy: U.accountant },
  });
  await prisma.reconciliationRecord.create({
    data: { paymentId: payB.id, internalPaymentNumber: payB.paymentNumber, internalAmount: payable, internalStatus: 'SUCCESS', gatewayPaymentId: dupProvider, gatewayAmount: payable, gatewayStatus: 'SUCCESS', status: 'DUPLICATE', discrepancyType: 'DUPLICATE_GATEWAY_REFERENCE', notes: `Two internal records reference gateway transaction ${dupProvider}.` },
  });

  // A completed refund against Sana's fully paid invoice (partial refund of ₹5,000).
  console.log('↩️  Refund…');
  const refund = await prisma.refund.create({
    data: { refundNumber: `REF-2026-${Math.floor(Math.random() * 90000 + 10000)}`, paymentId: pay1.id, invoiceId: inv1.id, studentId: students[0].id, amount: D(5000), reason: 'Hostel fee adjustment', status: 'COMPLETED', approvedBy: U.finance, approvedAt: new Date(), createdBy: U.accountant, providerRefundId: `re_${Math.random().toString(36).slice(2, 10)}` },
  });
  await prisma.ledgerEntry.create({ data: { reference: `LED-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, type: 'REFUND', direction: 'DEBIT', amount: D(5000), paymentId: pay1.id, invoiceId: inv1.id, refundId: refund.id, studentId: students[0].id, description: `Refund ${refund.refundNumber}` } });
  await prisma.invoice.update({ where: { id: inv1.id }, data: { paidAmount: D(73000), outstandingAmount: D(5000), status: 'PARTIALLY_PAID' } });

  console.log('📝 Audit logs…');
  await prisma.auditLog.createMany({
    data: [
      { actorId: U.accountant, actorName: 'Anil Accountant', actorRole: 'ACCOUNTANT', action: 'INVOICE_CREATED', entity: 'Invoice', entityId: inv1.id, newValue: { invoiceNumber: inv1.invoiceNumber, payableAmount: 78000 } as Prisma.InputJsonValue },
      { actorId: U.accountant, actorName: 'Anil Accountant', actorRole: 'ACCOUNTANT', action: 'PAYMENT_SUCCESS', entity: 'Payment', entityId: pay1.id, newValue: { amount: 78000, status: 'SUCCESS' } as Prisma.InputJsonValue },
      { actorId: U.finance, actorName: 'Farid Finance', actorRole: 'FINANCE_MANAGER', action: 'REFUND_APPROVED', entity: 'Refund', entityId: refund.id, newValue: { amount: 5000 } as Prisma.InputJsonValue },
      { actorId: U.finance, actorName: 'Farid Finance', actorRole: 'FINANCE_MANAGER', action: 'REFUND_COMPLETED', entity: 'Refund', entityId: refund.id, newValue: { amount: 5000, status: 'COMPLETED' } as Prisma.InputJsonValue },
    ],
  });

  console.log('✅ Seed complete.');
  console.log(`\nDemo credentials (password: ${PASSWORD}):`);
  console.log('  admin@edupay.edu       ADMIN');
  console.log('  finance@edupay.edu     FINANCE_MANAGER');
  console.log('  accountant@edupay.edu  ACCOUNTANT');
  console.log('  auditor@edupay.edu     AUDITOR');
  console.log('  student1@edupay.edu    STUDENT');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
