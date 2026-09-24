import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import studentsRoutes from '../modules/students/students.routes';
import departmentsRoutes from '../modules/departments/departments.routes';
import feeHeadsRoutes from '../modules/feeHeads/feeHeads.routes';
import feeStructuresRoutes from '../modules/feeStructures/feeStructures.routes';
import invoicesRoutes from '../modules/invoices/invoices.routes';
import installmentsRoutes from '../modules/installments/installments.routes';
import paymentsRoutes from '../modules/payments/payments.routes';
import refundsRoutes from '../modules/refunds/refunds.routes';
import reconciliationRoutes from '../modules/reconciliation/reconciliation.routes';
import ledgerRoutes from '../modules/ledger/ledger.routes';
import auditRoutes from '../modules/audit/audit.routes';
import reportsRoutes from '../modules/reports/reports.routes';
import notificationsRoutes from '../modules/notifications/notifications.routes';
import aiRoutes from '../modules/ai/ai.routes';

/** Versioned API router. NOTE: the Stripe webhook is mounted separately in
 *  app.ts (before the JSON body parser) so it can verify the raw request body. */
const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/students', studentsRoutes);
router.use('/departments', departmentsRoutes);
router.use('/fee-heads', feeHeadsRoutes);
router.use('/fee-structures', feeStructuresRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/installments', installmentsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/refunds', refundsRoutes);
router.use('/reconciliation', reconciliationRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/reports', reportsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/ai', aiRoutes);

export default router;
