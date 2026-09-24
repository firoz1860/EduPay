import type { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './ledger.service';

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listLedgerEntries(req.query as never, getActor(req));
  return paginated(res, data, meta, 'OK');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getLedgerEntryById(req.params.id, getActor(req));
  return ok(res, result, 'OK');
}
