import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/response';
import * as service from './feeHeads.service';

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listFeeHeads(req.query as never);
  return paginated(res, data, meta, 'OK');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getFeeHeadById(req.params.id);
  return ok(res, result, 'OK');
}

export async function create(req: Request, res: Response): Promise<Response> {
  const result = await service.createFeeHead(req.body);
  return created(res, result, 'Fee head created');
}

export async function update(req: Request, res: Response): Promise<Response> {
  const result = await service.updateFeeHead(req.params.id, req.body);
  return ok(res, result, 'Fee head updated');
}
