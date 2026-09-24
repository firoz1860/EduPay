import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { getActor } from '../../lib/actor';
import * as service from './notifications.service';

export async function list(req: Request, res: Response): Promise<Response> {
  const actor = getActor(req);
  const q = req.query as unknown as { page: number; pageSize: number; unread?: boolean };
  const result = await service.listNotifications(actor, q.page, q.pageSize, !!q.unread);
  return res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
    unreadCount: result.unreadCount,
    message: 'OK',
  });
}

export async function unread(req: Request, res: Response): Promise<Response> {
  const count = await service.unreadCount(getActor(req));
  return ok(res, { unreadCount: count }, 'OK');
}

export async function markRead(req: Request, res: Response): Promise<Response> {
  const result = await service.markRead(getActor(req), req.params.id);
  return ok(res, result, 'Marked as read');
}

export async function markAllRead(req: Request, res: Response): Promise<Response> {
  const result = await service.markAllRead(getActor(req));
  return ok(res, result, 'All notifications marked as read');
}
