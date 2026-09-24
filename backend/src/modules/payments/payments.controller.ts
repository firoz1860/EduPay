import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/response';
import * as service from './payments.service';
import type { Actor } from '../../lib/actor';
import { getActor } from '../../lib/actor';

export async function create(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  const result = await service.createPayment(req.body, actor, req.requestId);
  return created(res, result, 'Payment initiated');
}

export async function simulate(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  const result = await service.simulateSettlement(req.params.id, req.body, actor, req.requestId);
  return ok(res, result, 'Payment settlement simulated');
}

export async function cancel(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  const result = await service.cancelPayment(req.params.id, actor, req.requestId);
  return ok(res, result, 'Payment cancelled');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  const result = await service.getPaymentById(req.params.id, actor);
  return ok(res, result, 'OK');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  const { data, meta } = await service.listPayments(req.query as never, actor);
  return paginated(res, data, meta, 'OK');
}

export type { Actor };
