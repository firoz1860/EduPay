'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
  RECONCILIATION_STATUS_COLORS,
  RECONCILIATION_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ReconRecord {
  id: string;
  internal_payment_number: string | null;
  internal_amount: number | null;
  internal_status: string | null;
  gateway_payment_id: string | null;
  gateway_amount: number | null;
  gateway_status: string | null;
  gateway_event_id: string | null;
  status: string;
  discrepancy_type: string | null;
  notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  payment: { payment_number: string } | null;
}

export default function ReconciliationPage() {
  const { user } = useAuth();
  const { toast: showToast } = useToast();
  const [records, setRecords] = useState<ReconRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [resolveDialog, setResolveDialog] = useState<ReconRecord | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const canResolve = user && ['ADMIN', 'FINANCE_MANAGER'].includes(user.role);

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    const { data } = await supabase
      .from('reconciliation_records')
      .select(`
        *,
        payment:payments(payment_number)
      `)
      .order('created_at', { ascending: false });
    setRecords((data || []) as ReconRecord[]);
    setLoading(false);
  }

  const filtered = filter === 'ALL' ? records : records.filter((r) => r.status === filter);

  const stats = {
    matched: records.filter((r) => r.status === 'MATCHED').length,
    mismatch: records.filter((r) => ['AMOUNT_MISMATCH', 'STATE_MISMATCH'].includes(r.status)).length,
    missing: records.filter((r) => ['MISSING_INTERNAL', 'MISSING_GATEWAY'].includes(r.status)).length,
    pending: records.filter((r) => r.status === 'PENDING_REVIEW').length,
  };

  async function handleResolve() {
    if (!resolveDialog || !resolutionNotes.trim()) return;
    setResolving(true);

    const { error } = await supabase
      .from('reconciliation_records')
      .update({
        status: 'RESOLVED',
        resolution_notes: resolutionNotes,
        resolved_by: user?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', resolveDialog.id);

    if (error) {
      toast.error('Failed to resolve record');
    } else {
      // Create audit log
      await supabase.from('audit_logs').insert({
        actor_id: user?.id,
        actor_name: user?.full_name,
        actor_role: user?.role,
        action: 'RECONCILIATION_RESOLVED',
        entity: 'reconciliation_records',
        entity_id: resolveDialog.id,
        old_value: { status: resolveDialog.status },
        new_value: { status: 'RESOLVED', resolution_notes: resolutionNotes },
        reason: resolutionNotes,
        request_id: `req_${Date.now()}`,
      });

      toast.success('Reconciliation record resolved');
      setResolveDialog(null);
      setResolutionNotes('');
      fetchRecords();
    }
    setResolving(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reconciliation" description="Compare internal records with gateway records" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const statusOptions = ['ALL', 'MATCHED', 'AMOUNT_MISMATCH', 'STATE_MISMATCH', 'MISSING_INTERNAL', 'MISSING_GATEWAY', 'PENDING_REVIEW', 'RESOLVED'];

  return (
    <div className="space-y-6">
      <PageHeader title="Reconciliation" description="Compare internal records with gateway records" />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Matched</p>
              <p className="text-xl font-bold">{stats.matched}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mismatches</p>
              <p className="text-xl font-bold">{stats.mismatch}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <XCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Missing Records</p>
              <p className="text-xl font-bold">{stats.missing}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
              <HelpCircle className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Review</p>
              <p className="text-xl font-bold">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {statusOptions.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {status === 'ALL' ? 'All' : RECONCILIATION_STATUS_LABELS[status as keyof typeof RECONCILIATION_STATUS_LABELS]}
          </button>
        ))}
      </div>

      {/* Records */}
      <div className="space-y-3">
        {filtered.map((rec) => (
          <Card key={rec.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RECONCILIATION_STATUS_COLORS[rec.status as keyof typeof RECONCILIATION_STATUS_COLORS]}`}>
                      {RECONCILIATION_STATUS_LABELS[rec.status as keyof typeof RECONCILIATION_STATUS_LABELS]}
                    </span>
                    <span className="text-sm font-medium">{rec.payment?.payment_number || rec.internal_payment_number || 'Unknown'}</span>
                  </div>
                  {rec.discrepancy_type && (
                    <p className="text-sm text-muted-foreground">{rec.discrepancy_type}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Internal: {rec.internal_amount ? formatCurrency(Number(rec.internal_amount)) : '-'} ({rec.internal_status || '-'})</span>
                    <span>Gateway: {rec.gateway_amount ? formatCurrency(Number(rec.gateway_amount)) : '-'} ({rec.gateway_status || '-'})</span>
                    <span>Created: {formatDate(rec.created_at)}</span>
                  </div>
                  {rec.resolved_at && (
                    <p className="text-xs text-emerald-600">Resolved: {formatDate(rec.resolved_at)} — {rec.resolution_notes}</p>
                  )}
                </div>
                {canResolve && rec.status !== 'RESOLVED' && rec.status !== 'MATCHED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setResolveDialog(rec); setResolutionNotes(''); }}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No reconciliation records found</div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={(open) => !open && setResolveDialog(null)}>
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
            <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={!resolutionNotes.trim() || resolving}>
              {resolving ? 'Resolving...' : 'Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
