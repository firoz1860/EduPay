import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { aiLimiter } from '../../middleware/rateLimit.middleware';
import { credentialsBodySchema } from './ai.credentials';
import {
  validateHandler,
  modelsHandler,
  askHandler,
  insightsHandler,
  reconSummaryHandler,
  connectHandler,
  disconnectHandler,
  askBodySchema,
  connectBodySchema,
} from './ai.controller';

const router = Router();

// All AI routes require authentication and are rate-limited (cost/abuse control).
router.use(authenticate);
router.use(aiLimiter);

// Data-exposing AI features are limited to staff + auditor (they surface aggregates).
const canUseAI = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR');

// Setup endpoints (any authenticated user): validate a BYOK key and list models.
// The key travels in the request body over HTTPS and is never stored or returned.
router.post('/validate', validate({ body: credentialsBodySchema }), asyncHandler(validateHandler));
router.post('/models', validate({ body: credentialsBodySchema }), asyncHandler(modelsHandler));
router.post('/connect', validate({ body: connectBodySchema }), asyncHandler(connectHandler));
router.post('/disconnect', asyncHandler(disconnectHandler));

// AI features (verified-data explanations). BYOK credentials come from X-AI-* headers.
router.get('/insights', canUseAI, asyncHandler(insightsHandler));
router.post('/ask', canUseAI, validate({ body: askBodySchema }), asyncHandler(askHandler));
router.post('/reconciliation-summary', canUseAI, asyncHandler(reconSummaryHandler));

export default router;
