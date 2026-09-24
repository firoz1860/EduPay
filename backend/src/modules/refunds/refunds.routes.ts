import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { idempotency } from '../../middleware/idempotency.middleware';
import { createRefundSchema, listRefundsSchema, idParamSchema, decisionSchema } from './refunds.schema';
import * as ctrl from './refunds.controller';

const router = Router();
router.use(authenticate);

const canRequest = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN');
const canApprove = requireRole('FINANCE_MANAGER', 'ADMIN');

router.get('/', validate({ query: listRefundsSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post('/', canRequest, idempotency('refund.create'), validate({ body: createRefundSchema }), asyncHandler(ctrl.create));
router.post('/:id/approve', canApprove, validate({ params: idParamSchema, body: decisionSchema }), asyncHandler(ctrl.approve));
router.post('/:id/complete', canApprove, idempotency('refund.complete'), validate({ params: idParamSchema }), asyncHandler(ctrl.complete));

export default router;
