import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listNotificationsSchema, idParamSchema } from './notifications.schema';
import * as ctrl from './notifications.controller';

const router = Router();
router.use(authenticate);

// Every authenticated user has a personal notification inbox.
router.get('/', validate({ query: listNotificationsSchema }), asyncHandler(ctrl.list));
router.get('/unread-count', asyncHandler(ctrl.unread));
router.post('/read-all', asyncHandler(ctrl.markAllRead));
router.post('/:id/read', validate({ params: idParamSchema }), asyncHandler(ctrl.markRead));

export default router;
