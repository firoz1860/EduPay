'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import {
  RECONCILIATION_STATUS_COLORS,
  RECONCILIATION_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
} from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ReconciliationRecord, ReconciliationStatus } from '@/types';
import { Search, RefreshCw, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_FILTERS: Array<ReconciliationStatus | 'ALL'> = [
  'ALL',
  'MATCHED',
  'AMOUNT_MISMATCH',
  'STATE_MISMATCH',
  'MISSING_GATEWAY',
  'MISSING_INTERNAL',
  'DUPLICATE',
  'PENDING_REVIEW',
  'RESOLVED',
];

const ALL_STATUSES = Object.keys(RECONCILIATION_STATUS_LABELS) as ReconciliationStatus[];

const PAGE_SIZE = 20;

interface RunResult {
  created: number;
  summary: Record<string, number>;
}

export default function ReconciliationPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [resolveTarget, setResolveTarget] = useState<ReconciliationRecord | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const canRun = hasRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN');
  const canResolve = hasRole('FINANCE_MANAGER', 'ADMIN');

  // Debounce free-text search before it hits the query key.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['reconciliation', { page, statusFilter, search }],
    queryFn: async () =>
      api.get<ReconciliationRecord[]>('/reconciliation', {
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search || undefined,
      }),
  });

  const records = data?.data ?? [];
  const meta = data?.meta;
  const summary = data?.summary ?? {};

  const runMutation = useMutation({
    mutationFn: async () => (await api.post<RunResult>('/reconciliation/run')).data,
    onSuccess: (result) => {
      const breakdown = Object.entries(result.summary)
        .map(([key, count]) => `${RECONCILIATION_STATUS_LABELS[key as ReconciliationStatus] ?? key}: ${count}`)
        .join(' • ');
      toast.success(`Reconciliation complete — ${result.created} new record${result.created === 1 ? '' : 's'} created`, {
        description: breakdown || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to run reconciliation');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!resolveTarget) throw new Error('No record selected');
      return (
        await api.post<ReconciliationRecord>(`/reconciliation/${resolveTarget.id}/resolve`, {
          resolutionNotes,
        })
      ).data;
    },
    onSuccess: () => {
      toast.success('Reconciliation record resolved');
      setResolveTarget(null);
      setResolutionNotes('');
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resolve record');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reconciliation" description="Compare internal records with gateway records" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Compare internal records with gateway records"
        action={
          canRun && (
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              {runMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Run Reconciliation
            </Button>
          )
        }
      />

      {/* Status summary strip */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        {ALL_STATUSES.map((s) => (
          <Card key={s}>
            <CardContent className="p-3">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${RECONCILIATION_STATUS_COLORS[s]}`}>
                {RECONCILIATION_STATUS_LABELS[s]}
              </span>
              <p className="mt-1.5 text-xl font-bold">{summary[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search internal or gateway payment ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s === 'ALL' ? 'All' : RECONCILIATION_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Records */}
      <div className={`space-y-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
        {records.map((rec) => (
          <Card key={rec.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RECONCILIATION_STATUS_COLORS[rec.status]}`}>
                      {RECONCILIATION_STATUS_LABELS[rec.status]}
                    </span>
                    <span className="text-sm font-medium">
                      {rec.internalPaymentNumber || rec.payment?.paymentNumber || 'Unknown'}
                    </span>
                    {rec.payment?.student && (
                      <span className="text-xs text-muted-foreground">
                        {rec.payment.student.fullName} • {rec.payment.student.rollNumber}
                      </span>
                    )}
                  </div>
                  {rec.discrepancyType && (
                    <p className="text-sm text-muted-foreground">{rec.discrepancyType}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      Internal: {rec.internalAmount != null ? formatCurrency(rec.internalAmount) : '-'} ({rec.internalStatus || '-'})
                    </span>
                    <span>
                      Gateway: {rec.gatewayAmount != null ? formatCurrency(rec.gatewayAmount) : '-'} ({rec.gatewayStatus || '-'})
                    </span>
                    <span>Created: {formatDateTime(rec.createdAt)}</span>
                  </div>
                  {rec.notes && <p className="text-xs text-muted-foreground">Notes: {rec.notes}</p>}
                  {rec.resolvedAt && (
                    <p className="text-xs text-emerald-600">
                      Resolved: {formatDateTime(rec.resolvedAt)}
                      {rec.resolver?.fullName ? ` by ${rec.resolver.fullName}` : ''} — {rec.resolutionNotes}
                    </p>
                  )}
                </div>
                {canResolve && rec.status !== 'RESOLVED' && rec.status !== 'MATCHED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResolveTarget(rec);
                      setResolutionNotes('');
                    }}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No reconciliation records found</div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages} • {meta.total} record{meta.total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Reconciliation Record</DialogTitle>
            <DialogDescription>
              Provide a resolution note. This action will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter resolution notes..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={!resolutionNotes.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
