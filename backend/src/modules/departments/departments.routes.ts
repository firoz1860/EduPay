import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createCourseSchema,
  createDepartmentSchema,
  idParamSchema,
  listDepartmentsSchema,
  updateDepartmentSchema,
} from './departments.schema';
import * as ctrl from './departments.controller';

const router = Router();
router.use(authenticate);

const adminOnly = requireRole('ADMIN');

router.get('/', validate({ query: listDepartmentsSchema }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getOne));
router.post('/', adminOnly, validate({ body: createDepartmentSchema }), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  adminOnly,
  validate({ params: idParamSchema, body: updateDepartmentSchema }),
  asyncHandler(ctrl.update),
);
router.get('/:id/courses', validate({ params: idParamSchema }), asyncHandler(ctrl.listCourses));
router.post(
  '/:id/courses',
  adminOnly,
  validate({ params: idParamSchema, body: createCourseSchema }),
  asyncHandler(ctrl.createCourse),
);

export default router;
