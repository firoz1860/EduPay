import type { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response';
import * as service from './audit.service';

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listAuditLogs(req.query as never);
  return paginated(res, data, meta, 'OK');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getAuditLogById(req.params.id);
  return ok(res, result, 'OK');
}
