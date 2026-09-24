import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './reconciliation.service';

export async function run(req: Request, res: Response): Promise<Response> {
  const result = await service.runReconciliation(getActor(req), req.requestId);
  return ok(res, result, 'Reconciliation run complete');
}

export async function resolve(req: Request, res: Response): Promise<Response> {
  const result = await service.resolveReconciliation(req.params.id, req.body, getActor(req), req.requestId);
  return ok(res, result, 'Reconciliation resolved');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getReconciliationById(req.params.id);
  return ok(res, result, 'OK');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta, summary } = await service.listReconciliation(req.query as never);
  return res.status(200).json({ success: true, data, meta, summary, message: 'OK' });
}
