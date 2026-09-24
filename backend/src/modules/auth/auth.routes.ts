import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { authLimiter } from '../../middleware/rateLimit.middleware';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema';
import { loginHandler, registerHandler, refreshHandler, meHandler } from './auth.controller';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(registerHandler));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(loginHandler));
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), asyncHandler(refreshHandler));
router.get('/me', authenticate, asyncHandler(meHandler));

export default router;
