import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/response';
import { getActor } from '../../lib/actor';
import { prisma } from '../../config/prisma';
import { recordAudit } from '../../services/audit.service';
import * as service from './ai.service';
import { credentialsBodySchema, credentialsFromHeaders, providerEnum } from './ai.credentials';
import type { AICredentials } from './ai.types';

export const askBodySchema = z.object({ question: z.string().min(3).max(500) });
export const connectBodySchema = z.object({
  provider: providerEnum,
  model: z.string().trim().min(1).max(120),
});

function credsFromBody(body: z.infer<typeof credentialsBodySchema>): AICredentials {
  return {
    provider: body.provider,
    apiKey: body.apiKey,
    model: body.model,
    baseUrl: body.baseUrl,
    providerName: body.providerName,
  };
}

/** Validate a BYOK key + discover models. The key is never stored, logged or returned. */
export async function validateHandler(req: Request, res: Response): Promise<Response> {
  const result = await service.validateCredentials(credsFromBody(req.body));
  return ok(res, result, 'API key verified');
}

export async function modelsHandler(req: Request, res: Response): Promise<Response> {
  const models = await service.listModels(credsFromBody(req.body));
  return ok(res, { models }, 'OK');
}

export async function askHandler(req: Request, res: Response): Promise<Response> {
  const creds = credentialsFromHeaders(req);
  const result = await service.ask(req.body.question, creds);
  return ok(res, result, 'OK');
}

export async function insightsHandler(req: Request, res: Response): Promise<Response> {
  const creds = credentialsFromHeaders(req);
  const result = await service.insights(creds);
  return ok(res, result, 'OK');
}

export async function reconSummaryHandler(req: Request, res: Response): Promise<Response> {
  const creds = credentialsFromHeaders(req);
  const result = await service.reconciliationSummary(creds);
  return ok(res, result, 'OK');
}

/** Record that a user connected an AI provider. Stores metadata only — never the key. */
export async function connectHandler(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  await recordAudit(prisma, {
    actor,
    action: 'AI_PROVIDER_CONNECTED',
    entity: 'AIConfig',
    entityId: actor.sub,
    newValue: { provider: req.body.provider, model: req.body.model },
    requestId: req.requestId,
  });
  return ok(res, { provider: req.body.provider, model: req.body.model, configured: true }, 'AI provider connected');
}

export async function disconnectHandler(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  await recordAudit(prisma, {
    actor,
    action: 'AI_PROVIDER_DISCONNECTED',
    entity: 'AIConfig',
    entityId: actor.sub,
    requestId: req.requestId,
  });
  return ok(res, { configured: false }, 'AI provider disconnected');
}
