import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './departments.service';

export async function list(req: Request, res: Response): Promise<Response> {
  const { data, meta } = await service.listDepartments(req.query as never);
  return paginated(res, data, meta, 'OK');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const result = await service.getDepartmentById(req.params.id);
  return ok(res, result, 'OK');
}

export async function create(req: Request, res: Response): Promise<Response> {
  const result = await service.createDepartment(req.body, getActor(req), req.requestId);
  return created(res, result, 'Department created');
}

export async function update(req: Request, res: Response): Promise<Response> {
  const result = await service.updateDepartment(req.params.id, req.body, getActor(req), req.requestId);
  return ok(res, result, 'Department updated');
}

export async function listCourses(req: Request, res: Response): Promise<Response> {
  const result = await service.listCoursesByDepartment(req.params.id);
  return ok(res, result, 'OK');
}

export async function createCourse(req: Request, res: Response): Promise<Response> {
  const result = await service.createCourseInDepartment(req.params.id, req.body, getActor(req), req.requestId);
  return created(res, result, 'Course created');
}
