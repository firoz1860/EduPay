import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listReconSchema, idParamSchema, resolveSchema } from './reconciliation.schema';
import * as ctrl from './reconciliation.controller';

const router = Router();
router.use(authenticate);

// Read: any staff role (incl. AUDITOR read-only).
const canView = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR');
const canResolve = requireRole('FINANCE_MANAGER', 'ADMIN');
const canRun = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN');

router.get('/', canView, validate({ query: listReconSchema }), asyncHandler(ctrl.list));
router.post('/run', canRun, asyncHandler(ctrl.run));
router.get('/:id', canView, validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post('/:id/resolve', canResolve, validate({ params: idParamSchema, body: resolveSchema }), asyncHandler(ctrl.resolve));

export default router;
