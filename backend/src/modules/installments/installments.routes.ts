import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listInstallmentsSchema, idParamSchema } from './installments.schema';
import * as ctrl from './installments.controller';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: listInstallmentsSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));

export default router;
