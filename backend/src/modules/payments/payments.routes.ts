import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { idempotency } from '../../middleware/idempotency.middleware';
import {
  createPaymentSchema,
  simulateSchema,
  listPaymentsSchema,
  idParamSchema,
} from './payments.schema';
import * as ctrl from './payments.controller';

const router = Router();

// All payment routes require authentication.
router.use(authenticate);

router.get('/', validate({ query: listPaymentsSchema }), asyncHandler(ctrl.list));

// Creating a payment is a money-moving op -> idempotency-key aware.
router.post(
  '/',
  idempotency('payment.create'),
  validate({ body: createPaymentSchema }),
  asyncHandler(ctrl.create),
);

router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));

router.post(
  '/:id/simulate',
  idempotency('payment.simulate'),
  validate({ params: idParamSchema, body: simulateSchema }),
  asyncHandler(ctrl.simulate),
);

router.post(
  '/:id/cancel',
  requireRole('STUDENT', 'ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(ctrl.cancel),
);

export default router;
