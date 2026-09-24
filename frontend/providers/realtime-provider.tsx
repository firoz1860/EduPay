'use client';

import { useEffect, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { tokenStore } from '@/lib/api';

/** Socket.IO server origin (strip the /api/v1 suffix from the API base URL). */
const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
);

/** Map backend invalidate keys to the frontend TanStack Query key prefixes. */
const KEY_MAP: Record<string, string[][]> = {
  payments: [['payments']],
  invoices: [['invoices']],
  dashboard: [['reports']],
  reports: [['reports']],
  ledger: [['ledger']],
  reconciliation: [['reconciliation']],
  refunds: [['refunds']],
  notifications: [['notifications']],
  students: [['students']],
};

interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
}

/**
 * Opens a single authenticated Socket.IO connection while the user is logged in.
 * Live server events either (a) refresh the relevant queries so tables/KPIs update
 * instantly, or (b) arrive as notifications (toast + notification-center refresh).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const socket: Socket = io(SOCKET_URL, {
      // Re-reads the current access token on every (re)connect attempt.
      auth: (cb) => cb({ token: tokenStore.access ?? '' }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    const invalidate = (keys: string[]) => {
      const seen = new Set<string>();
      for (const key of keys) {
        const targets = KEY_MAP[key] ?? [[key]];
        for (const qk of targets) {
          const id = qk.join('/');
          if (seen.has(id)) continue;
          seen.add(id);
          queryClient.invalidateQueries({ queryKey: qk });
        }
      }
    };

    socket.on('invalidate', (payload: { keys?: string[] }) => {
      if (payload?.keys?.length) invalidate(payload.keys);
    });

    socket.on('notification', (n: NotificationPayload) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      const isFailure = n.type.includes('FAILED');
      const fn = isFailure ? toast.error : toast;
      fn(n.title, { description: n.message });
    });

    return () => {
      socket.off('invalidate');
      socket.off('notification');
      socket.disconnect();
    };
  }, [user, queryClient]);

  return <>{children}</>;
}
