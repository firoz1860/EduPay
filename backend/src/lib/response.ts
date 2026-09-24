import type { Response } from 'express';

/** Consistent success envelope: { success, data, message }. */
export function ok<T>(res: Response, data: T, message = 'OK', statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data, message });
}

export function created<T>(res: Response, data: T, message = 'Created'): Response {
  return ok(res, data, message, 201);
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Paginated success envelope with `meta`. */
export function paginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  message = 'OK',
): Response {
  return res.status(200).json({ success: true, data, meta, message });
}
