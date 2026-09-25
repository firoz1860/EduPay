'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/constants';
import { notifIconFor, notifHrefFor, isToday, type AppNotification } from '@/lib/notifications';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['notifications', 'all', page],
    queryFn: async () => {
      const res = await api.get<AppNotification[]>('/notifications', { page, pageSize: PAGE_SIZE });
      return { items: res.data, meta: res.meta, unreadCount: res.unreadCount ?? 0 };
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;
  const unread = data?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleClick = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    const href = notifHrefFor(n);
    if (href) router.push(href);
  };

  const today = items.filter((n) => isToday(n.createdAt));
  const earlier = items.filter((n) => !isToday(n.createdAt));

  const renderRow = (n: AppNotification) => {
    const Icon = notifIconFor(n.type);
    const isFailure = n.type.includes('FAILED');
    return (
      <button
        key={n.id}
        onClick={() => handleClick(n)}
        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none ${
          n.read ? '' : 'bg-primary/[0.04]'
        }`}
      >
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isFailure ? 'bg-rose-100 text-rose-600' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-tight ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
        </div>
        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Your recent payment, invoice, refund, and reconciliation activity"
        action={
          unread > 0 ? (
            <Button size="sm" variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-sm text-muted-foreground">
              New payment, invoice, and refund activity will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {today.length > 0 && (
            <>
              <p className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Today
              </p>
              <div className="divide-y">{today.map(renderRow)}</div>
            </>
          )}
          {earlier.length > 0 && (
            <>
              <p className="border-y bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Earlier
              </p>
              <div className="divide-y">{earlier.map(renderRow)}</div>
            </>
          )}
        </Card>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} &middot; {meta.total} notifications
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
