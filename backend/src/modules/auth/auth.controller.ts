import type { Request, Response } from 'express';
import { ok, created } from '../../lib/response';
import * as authService from './auth.service';

export async function loginHandler(req: Request, res: Response): Promise<Response> {
  const result = await authService.login(req.body, req.requestId);
  return ok(res, result, 'Logged in successfully');
}

export async function registerHandler(req: Request, res: Response): Promise<Response> {
  const result = await authService.register(req.body, req.requestId);
  return created(res, result, 'Account created');
}

export async function refreshHandler(req: Request, res: Response): Promise<Response> {
  const result = await authService.refresh(req.body.refreshToken);
  return ok(res, result, 'Token refreshed');
}

export async function meHandler(req: Request, res: Response): Promise<Response> {
  const user = await authService.me(req.user!.sub);
  return ok(res, { user }, 'OK');
}
