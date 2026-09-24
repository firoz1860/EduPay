'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/constants';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, CreditCard, Receipt, FileText, RefreshCw, AlertTriangle } from 'lucide-react';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

function iconFor(type: string) {
  if (type.startsWith('PAYMENT')) return CreditCard;
  if (type.startsWith('REFUND')) return Receipt;
  if (type.startsWith('INVOICE')) return FileText;
  if (type.startsWith('RECONCILIATION')) return RefreshCw;
  return AlertTriangle;
}

/**
 * Maps a notification to the page it should open. Payments and invoices have
 * detail pages (linked by id); refunds and reconciliation are list-only.
 * Returns null when there is no meaningful destination.
 */
function hrefFor(n: Notif): string | null {
  switch (n.entityType) {
    case 'Payment':
      return n.entityId ? `/payments/${n.entityId}` : '/payments';
    case 'Invoice':
      return n.entityId ? `/invoices/${n.entityId}` : '/invoices';
    case 'Refund':
      return '/refunds';
    case 'ReconciliationRecord':
      return '/reconciliation';
    default:
      // Fall back on the notification type prefix when entityType is absent.
      if (n.type.startsWith('PAYMENT')) return '/payments';
      if (n.type.startsWith('INVOICE')) return '/invoices';
      if (n.type.startsWith('REFUND')) return '/refunds';
      if (n.type.startsWith('RECONCILIATION')) return '/reconciliation';
      return null;
  }
}

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<Notif[]>('/notifications', { pageSize: 15 });
      return { items: res.data, unreadCount: res.unreadCount ?? 0 };
    },
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  const handleClick = (n: Notif) => {
    if (!n.read) markRead.mutate(n.id);
    const href = hrefFor(n);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up</p>
          ) : (
            <div className="divide-y">
              {items.map((n) => {
                const Icon = iconFor(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${n.read ? '' : 'bg-blue-50/40'}`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.type.includes('FAILED') ? 'bg-rose-100 text-rose-600' : 'bg-primary/10 text-primary'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
