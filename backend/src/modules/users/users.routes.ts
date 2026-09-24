import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createUserSchema, updateUserSchema, listUsersSchema, idParamSchema } from './users.schema';
import * as ctrl from './users.controller';

const router = Router();
router.use(authenticate);

// User management is a sensitive, admin-only surface.
router.use(requireRole('ADMIN'));

router.get('/', validate({ query: listUsersSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post('/', validate({ body: createUserSchema }), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(ctrl.update),
);

export default router;
