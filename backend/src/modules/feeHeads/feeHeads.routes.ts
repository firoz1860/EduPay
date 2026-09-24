import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createFeeHeadSchema,
  idParamSchema,
  listFeeHeadsSchema,
  updateFeeHeadSchema,
} from './feeHeads.schema';
import * as ctrl from './feeHeads.controller';

const router = Router();
router.use(authenticate);

const canManage = requireRole('ADMIN', 'ACCOUNTANT');

router.get('/', validate({ query: listFeeHeadsSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post('/', canManage, validate({ body: createFeeHeadSchema }), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  canManage,
  validate({ params: idParamSchema, body: updateFeeHeadSchema }),
  asyncHandler(ctrl.update),
);

export default router;
