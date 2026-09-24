import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createInvoiceSchema, listInvoicesSchema, idParamSchema, cancelSchema } from './invoices.schema';
import * as ctrl from './invoices.controller';

const router = Router();
router.use(authenticate);

const canManage = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN');

router.get('/', validate({ query: listInvoicesSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post('/', canManage, validate({ body: createInvoiceSchema }), asyncHandler(ctrl.create));
router.post('/:id/issue', canManage, validate({ params: idParamSchema }), asyncHandler(ctrl.issue));
router.post(
  '/:id/cancel',
  canManage,
  validate({ params: idParamSchema, body: cancelSchema }),
  asyncHandler(ctrl.cancel),
);

export default router;
