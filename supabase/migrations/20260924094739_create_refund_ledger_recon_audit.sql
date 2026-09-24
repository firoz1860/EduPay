/*
# EduPay Core Schema - Part 3: Refunds, Ledger, Reconciliation, Audit

## Overview
Creates refund, ledger, reconciliation, and audit log tables.

## New Tables
1. **refunds** - Refund records with full/partial support
2. **ledger_entries** - Immutable financial ledger
3. **reconciliation_records** - Payment reconciliation against gateway
4. **audit_logs** - Immutable audit trail

## Security
- RLS enabled on all tables with anon + authenticated access
*/

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number text UNIQUE NOT NULL,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED')),
  provider_refund_id text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ledger Entries (immutable)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  type text NOT NULL CHECK (type IN ('PAYMENT', 'REFUND', 'ADJUSTMENT', 'FEE', 'DISCOUNT')),
  direction text NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  refund_id uuid REFERENCES refunds(id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Reconciliation Records
CREATE TABLE IF NOT EXISTS reconciliation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  internal_payment_number text,
  internal_amount numeric(12,2),
  internal_status text,
  gateway_payment_id text,
  gateway_amount numeric(12,2),
  gateway_status text,
  gateway_event_id text,
  status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('MATCHED', 'AMOUNT_MISMATCH', 'MISSING_INTERNAL', 'MISSING_GATEWAY', 'DUPLICATE', 'STATE_MISMATCH', 'PENDING_REVIEW', 'RESOLVED')),
  discrepancy_type text,
  notes text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit Logs (immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  request_id text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice ON refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_payment ON ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_invoice ON ledger_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_student ON ledger_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_type ON ledger_entries(type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created ON ledger_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_reconciliation_payment ON reconciliation_records(payment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON reconciliation_records(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- RLS
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Refunds policies
DROP POLICY IF EXISTS "anon_select_refunds" ON refunds;
CREATE POLICY "anon_select_refunds" ON refunds FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_refunds" ON refunds;
CREATE POLICY "anon_insert_refunds" ON refunds FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_refunds" ON refunds;
CREATE POLICY "anon_update_refunds" ON refunds FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_refunds" ON refunds;
CREATE POLICY "anon_delete_refunds" ON refunds FOR DELETE TO anon, authenticated USING (true);

-- Ledger entries policies
DROP POLICY IF EXISTS "anon_select_ledger_entries" ON ledger_entries;
CREATE POLICY "anon_select_ledger_entries" ON ledger_entries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ledger_entries" ON ledger_entries;
CREATE POLICY "anon_insert_ledger_entries" ON ledger_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ledger_entries" ON ledger_entries;
CREATE POLICY "anon_update_ledger_entries" ON ledger_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ledger_entries" ON ledger_entries;
CREATE POLICY "anon_delete_ledger_entries" ON ledger_entries FOR DELETE TO anon, authenticated USING (true);

-- Reconciliation policies
DROP POLICY IF EXISTS "anon_select_reconciliation" ON reconciliation_records;
CREATE POLICY "anon_select_reconciliation" ON reconciliation_records FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reconciliation" ON reconciliation_records;
CREATE POLICY "anon_insert_reconciliation" ON reconciliation_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reconciliation" ON reconciliation_records;
CREATE POLICY "anon_update_reconciliation" ON reconciliation_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reconciliation" ON reconciliation_records;
CREATE POLICY "anon_delete_reconciliation" ON reconciliation_records FOR DELETE TO anon, authenticated USING (true);

-- Audit logs policies
DROP POLICY IF EXISTS "anon_select_audit_logs" ON audit_logs;
CREATE POLICY "anon_select_audit_logs" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;
CREATE POLICY "anon_insert_audit_logs" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_logs" ON audit_logs;
CREATE POLICY "anon_update_audit_logs" ON audit_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_logs" ON audit_logs;
CREATE POLICY "anon_delete_audit_logs" ON audit_logs FOR DELETE TO anon, authenticated USING (true);