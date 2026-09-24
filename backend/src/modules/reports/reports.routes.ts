import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import * as ctrl from './reports.controller';

const router = Router();
router.use(authenticate);

const canView = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR');

router.get('/dashboard', canView, asyncHandler(ctrl.dashboard));
router.get('/collection-by-department', canView, asyncHandler(ctrl.collectionByDepartment));
router.get('/collection-by-fee-head', canView, asyncHandler(ctrl.collectionByFeeHead));
router.get('/payment-status', canView, asyncHandler(ctrl.paymentStatus));
router.get('/outstanding', canView, asyncHandler(ctrl.outstanding));

export default router;
