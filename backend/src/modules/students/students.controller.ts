import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './students.service';

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listStudents(req.query as never, getActor(req));
  return paginated(res, data, meta, 'OK');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getStudentById(req.params.id, getActor(req));
  return ok(res, result, 'OK');
}

export async function create(req: Request, res: Response): Promise<Response> {
  const result = await service.createStudent(req.body, getActor(req), req.requestId);
  return created(res, result, 'Student created');
}

export async function update(req: Request, res: Response): Promise<Response> {
  const result = await service.updateStudent(req.params.id, req.body, getActor(req), req.requestId);
  return ok(res, result, 'Student updated');
}
