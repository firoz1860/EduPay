import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listLedgerSchema, idParamSchema } from './ledger.schema';
import * as ctrl from './ledger.controller';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: listLedgerSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));

export default router;
