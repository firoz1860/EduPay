import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createFeeStructureSchema,
  updateFeeStructureSchema,
  listFeeStructuresSchema,
  idParamSchema,
} from './feeStructures.schema';
import * as ctrl from './feeStructures.controller';

const router = Router();
router.use(authenticate);

const canManage = requireRole('ADMIN', 'ACCOUNTANT');

router.get('/', validate({ query: listFeeStructuresSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post(
  '/',
  canManage,
  validate({ body: createFeeStructureSchema }),
  asyncHandler(ctrl.create),
);
router.patch(
  '/:id',
  canManage,
  validate({ params: idParamSchema, body: updateFeeStructureSchema }),
  asyncHandler(ctrl.update),
);

export default router;
