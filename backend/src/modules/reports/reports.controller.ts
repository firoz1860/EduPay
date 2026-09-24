import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import * as service from './reports.service';

export async function dashboard(req: Request, res: Response): Promise<Response> {
  const academicYear = typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
  const result = await service.getDashboard({ academicYear });
  return ok(res, result, 'OK');
}

export async function collectionByDepartment(_req: Request, res: Response): Promise<Response> {
  const result = await service.getCollectionByDepartment();
  return ok(res, result, 'OK');
}

export async function collectionByFeeHead(_req: Request, res: Response): Promise<Response> {
  const result = await service.getCollectionByFeeHead();
  return ok(res, result, 'OK');
}

export async function paymentStatus(_req: Request, res: Response): Promise<Response> {
  const result = await service.getPaymentStatusReport();
  return ok(res, result, 'OK');
}

export async function outstanding(_req: Request, res: Response): Promise<Response> {
  const result = await service.getOutstandingInvoices();
  return ok(res, result, 'OK');
}
