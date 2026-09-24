'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import type { AuditLog } from '@/types';
import {
  Search,
  Shield,
  User,
  FileEdit,
  CreditCard,
  RefreshCw,
  Receipt,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PAYMENT_CREATED: CreditCard,
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: CreditCard,
  PAYMENT_CANCELLED: CreditCard,
  REFUND_CREATED: Receipt,
  REFUND_APPROVED: Receipt,
  REFUND_COMPLETED: Receipt,
  RECONCILIATION_RUN: RefreshCw,
  RECONCILIATION_RESOLVED: RefreshCw,
  FEE_STRUCTURE_CREATED: FileEdit,
  FEE_UPDATED: FileEdit,
  INVOICE_CREATED: FileEdit,
  INVOICE_ISSUED: FileEdit,
  INVOICE_CANCELLED: FileEdit,
  STUDENT_CREATED: User,
  STUDENT_UPDATED: User,
  USER_CREATED: User,
  USER_LOGIN: User,
};

const ENTITY_OPTIONS = [
  'Payment',
  'Invoice',
  'Refund',
  'ReconciliationRecord',
  'FeeStructure',
  'Student',
  'User',
  'GatewayEvent',
];

const ACTION_OPTIONS = [
  'PAYMENT_CREATED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PAYMENT_CANCELLED',
  'REFUND_CREATED',
  'REFUND_APPROVED',
  'REFUND_COMPLETED',
  'INVOICE_CREATED',
  'INVOICE_ISSUED',
  'INVOICE_CANCELLED',
  'FEE_STRUCTURE_CREATED',
  'FEE_UPDATED',
  'RECONCILIATION_RUN',
  'RECONCILIATION_RESOLVED',
  'STUDENT_CREATED',
  'STUDENT_UPDATED',
  'USER_CREATED',
  'USER_LOGIN',
  'WEBHOOK_RECEIVED',
  'WEBHOOK_DUPLICATE',
];

const PAGE_SIZE = 20;

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Debounce free-text search before it hits the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, entityFilter, actionFilter]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs', page, entityFilter, actionFilter, debouncedSearch],
    queryFn: async () => {
      const res = await api.get<AuditLog[]>('/audit-logs', {
        page,
        pageSize: PAGE_SIZE,
        entity: entityFilter === 'ALL' ? undefined : entityFilter,
        action: actionFilter === 'ALL' ? undefined : actionFilter,
        search: debouncedSearch || undefined,
      });
      return res;
    },
    placeholderData: (prev) => prev,
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Logs" description="Immutable record of all financial actions" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Immutable record of all financial actions" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by action or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All entities</SelectItem>
            {ENTITY_OPTIONS.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            {ACTION_OPTIONS.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-4 text-sm text-rose-700">
            {error instanceof ApiError ? error.message : 'Failed to load audit logs.'}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {logs.map((log) => {
          const Icon = ACTION_ICONS[log.action] || Shield;
          const isOpen = expanded.has(log.id);
          const hasDiff = log.oldValue || log.newValue;
          return (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold">{log.action}</span>
                        <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{log.entity}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{log.actorName || 'System'}</span>
                      {log.actorRole && <span className="rounded bg-muted px-1.5 py-0.5">{log.actorRole}</span>}
                    </div>
                    {log.reason && (
                      <p className="text-sm text-muted-foreground">{log.reason}</p>
                    )}
                    {hasDiff && (
                      <button
                        onClick={() => toggleExpanded(log.id)}
                        className="flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
                      >
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {isOpen ? 'Hide changes' : 'View changes'}
                      </button>
                    )}
                    {isOpen && hasDiff && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">
                          <p className="mb-1 font-medium">Old value</p>
                          <pre className="whitespace-pre-wrap break-words font-mono">
                            {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : '—'}
                          </pre>
                        </div>
                        <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
                          <p className="mb-1 font-medium">New value</p>
                          <pre className="whitespace-pre-wrap break-words font-mono">
                            {log.newValue ? JSON.stringify(log.newValue, null, 2) : '—'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {logs.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No audit logs found</div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages} • {meta.total} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
