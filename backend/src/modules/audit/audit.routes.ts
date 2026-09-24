import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listAuditSchema, idParamSchema } from './audit.schema';
import * as ctrl from './audit.controller';

const router = Router();
router.use(authenticate);
router.use(requireRole('ADMIN', 'AUDITOR', 'FINANCE_MANAGER'));

router.get('/', validate({ query: listAuditSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));

export default router;
