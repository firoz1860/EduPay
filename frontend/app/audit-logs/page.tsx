'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/constants';
import { Search, Shield, User, FileEdit, CreditCard, RefreshCw, Receipt } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  request_id: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PAYMENT_CREATED: CreditCard,
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: CreditCard,
  REFUND_CREATED: Receipt,
  REFUND_APPROVED: Receipt,
  RECONCILIATION_RESOLVED: RefreshCw,
  FEE_UPDATED: FileEdit,
  DISCOUNT_APPLIED: FileEdit,
  INVOICE_CREATED: FileEdit,
  INVOICE_ISSUED: FileEdit,
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setLogs((data || []) as unknown as AuditLogEntry[]);
      setLoading(false);
    }
    fetchLogs();
  }, []);

  const filtered = logs.filter((log) =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.entity.toLowerCase().includes(search.toLowerCase()) ||
    (log.actor_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by action, entity, or actor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((log) => {
          const Icon = ACTION_ICONS[log.action] || Shield;
          return (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold">{log.action}</span>
                        <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{log.entity}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{log.actor_name || 'System'}</span>
                      {log.actor_role && <span className="rounded bg-muted px-1.5 py-0.5">{log.actor_role}</span>}
                    </div>
                    {log.reason && (
                      <p className="text-sm text-muted-foreground">{log.reason}</p>
                    )}
                    {log.old_value && log.new_value && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <div className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">
                          <span className="font-medium">From: </span>
                          {JSON.stringify(log.old_value).slice(0, 80)}
                        </div>
                        <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                          <span className="font-medium">To: </span>
                          {JSON.stringify(log.new_value).slice(0, 80)}
                        </div>
                      </div>
                    )}
                    {log.request_id && (
                      <p className="font-mono text-xs text-muted-foreground/60">{log.request_id}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No audit logs found</div>
      )}
    </div>
  );
}
