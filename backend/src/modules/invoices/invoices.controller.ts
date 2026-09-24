import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './invoices.service';

export async function create(req: Request, res: Response): Promise<Response> {
  const result = await service.createInvoice(req.body, getActor(req), req.requestId);
  return created(res, result, 'Invoice created');
}

export async function issue(req: Request, res: Response): Promise<Response> {
  const result = await service.issueInvoice(req.params.id, getActor(req), req.requestId);
  return ok(res, result, 'Invoice issued');
}

export async function cancel(req: Request, res: Response): Promise<Response> {
  const result = await service.cancelInvoice(req.params.id, req.body?.reason, getActor(req), req.requestId);
  return ok(res, result, 'Invoice cancelled');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getInvoiceById(req.params.id, getActor(req));
  return ok(res, result, 'OK');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listInvoices(req.query as never, getActor(req));
  return paginated(res, data, meta, 'OK');
}
