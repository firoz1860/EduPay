import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './feeStructures.service';

export async function create(req: Request, res: Response): Promise<Response> {
  const result = await service.createFeeStructure(req.body, getActor(req), req.requestId);
  return created(res, result, 'Fee structure created');
}

export async function update(req: Request, res: Response): Promise<Response> {
  const result = await service.updateFeeStructure(
    req.params.id,
    req.body,
    getActor(req),
    req.requestId,
  );
  return ok(res, result, 'Fee structure updated');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getFeeStructureById(req.params.id);
  return ok(res, result, 'OK');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listFeeStructures(req.query as never);
  return paginated(res, data, meta, 'OK');
}
