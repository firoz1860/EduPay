import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/response';
import { asyncHandler } from '../../lib/asyncHandler';
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as service from './ai.service';

const askSchema = z.object({ question: z.string().min(3).max(500) });

async function askHandler(req: Request, res: Response): Promise<Response> {
  const result = await service.ask(req.body.question);
  return ok(res, result, 'OK');
}

async function insightsHandler(_req: Request, res: Response): Promise<Response> {
  const result = await service.insights();
  return ok(res, result, 'OK');
}

const router = Router();
router.use(authenticate);
const canUse = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR');

router.get('/insights', canUse, asyncHandler(insightsHandler));
router.post('/ask', canUse, validate({ body: askSchema }), asyncHandler(askHandler));

export default router;
