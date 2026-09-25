'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/constants';
import { notifIconFor, notifHrefFor, isToday, type AppNotification } from '@/lib/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';

function NotificationRow({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const Icon = notifIconFor(n.type);
  const isFailure = n.type.includes('FAILED');
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none ${
        n.read ? '' : 'bg-primary/[0.04]'
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isFailure ? 'bg-rose-100 text-rose-600' : 'bg-primary/10 text-primary'
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm leading-tight ${n.read ? 'font-medium' : 'font-semibold'}`}>
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
      </div>
      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
    </button>
  );
}

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const prevUnread = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<AppNotification[]>('/notifications', { pageSize: 20 });
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

  // Wiggle the bell once whenever the unread count rises (a new one arrived).
  useEffect(() => {
    if (unread > prevUnread.current) {
      setWiggle(true);
      const t = setTimeout(() => setWiggle(false), 750);
      prevUnread.current = unread;
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);

  const today = items.filter((n) => isToday(n.createdAt));
  const earlier = items.filter((n) => !isToday(n.createdAt));

  const handleClick = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    const href = notifHrefFor(n);
    setOpen(false);
    if (href) router.push(href);
  };

  const viewAll = () => {
    setOpen(false);
    router.push('/notifications');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className={`h-5 w-5 origin-top ${wiggle ? 'motion-safe:animate-wiggle' : ''}`} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {unread} new
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[26rem]">
          {isLoading ? (
            <div className="divide-y">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">New activity will show up here.</p>
            </div>
          ) : (
            <div>
              {today.length > 0 && (
                <>
                  <p className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Today
                  </p>
                  <div className="divide-y">
                    {today.map((n) => (
                      <NotificationRow key={n.id} n={n} onClick={() => handleClick(n)} />
                    ))}
                  </div>
                </>
              )}
              {earlier.length > 0 && (
                <>
                  <p className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Earlier
                  </p>
                  <div className="divide-y">
                    {earlier.map((n) => (
                      <NotificationRow key={n.id} n={n} onClick={() => handleClick(n)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-2">
          <button
            onClick={viewAll}
            className="w-full rounded-md py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-muted"
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
