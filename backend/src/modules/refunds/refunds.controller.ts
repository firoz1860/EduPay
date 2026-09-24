import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './refunds.service';

export async function create(req: Request, res: Response): Promise<Response> {
  const result = await service.createRefund(req.body, getActor(req), req.requestId);
  return created(res, result, 'Refund requested');
}

export async function approve(req: Request, res: Response): Promise<Response> {
  const result = await service.approveRefund(req.params.id, getActor(req), req.requestId);
  return ok(res, result, 'Refund approved');
}

export async function complete(req: Request, res: Response): Promise<Response> {
  const result = await service.completeRefund(req.params.id, getActor(req), req.requestId);
  return ok(res, result, 'Refund completed');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getRefundById(req.params.id);
  return ok(res, result, 'OK');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listRefunds(req.query as never, getActor(req));
  return paginated(res, data, meta, 'OK');
}
