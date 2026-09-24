import { Server, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt';
import { allowedOrigins } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Real-time transport (Socket.IO). A single authenticated connection per client.
 * The JWT is verified in the handshake; each socket joins a personal room
 * (`user:<id>`) and a role room (`role:<ROLE>`) so the server can push events to
 * exactly the right recipients.
 */
let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    // Fall back to polling automatically if websockets are blocked by a proxy.
    transports: ['websocket', 'polling'],
  });

  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error('unauthorized'));
    try {
      const user = verifyAccessToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;
    socket.join(`user:${user.sub}`);
    socket.join(`role:${user.role}`);
    socket.emit('connected', { userId: user.sub, role: user.role });
    logger.debug({ userId: user.sub }, 'socket connected');

    socket.on('disconnect', () => {
      logger.debug({ userId: user.sub }, 'socket disconnected');
    });
  });

  return io;
}

export function getIo(): Server | null {
  return io;
}

/** Emit an event to specific users' rooms. No-op if the socket server isn't up. */
export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  if (!io) return;
  for (const id of userIds) io.to(`user:${id}`).emit(event, payload);
}

/** Emit an event to all connected members of the given roles. */
export function emitToRoles(roles: string[], event: string, payload: unknown): void {
  if (!io) return;
  for (const role of roles) io.to(`role:${role}`).emit(event, payload);
}

export async function closeSocket(): Promise<void> {
  if (io) {
    await io.close();
    io = null;
  }
}
