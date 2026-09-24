import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createStudentSchema,
  idParamSchema,
  listStudentsSchema,
  updateStudentSchema,
} from './students.schema';
import * as ctrl from './students.controller';

const router = Router();
router.use(authenticate);

const canManage = requireRole('ADMIN', 'ACCOUNTANT');

router.get('/', validate({ query: listStudentsSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post('/', canManage, validate({ body: createStudentSchema }), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  canManage,
  validate({ params: idParamSchema, body: updateStudentSchema }),
  asyncHandler(ctrl.update),
);

export default router;
