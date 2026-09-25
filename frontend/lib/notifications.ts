/**
 * Shared helpers for rendering notifications in the bell dropdown and the full
 * notifications page. Pure mapping logic — no data fetching here.
 */
import {
  CreditCard,
  Receipt,
  FileText,
  RefreshCw,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

/** Icon for a notification, chosen by its type prefix. */
export function notifIconFor(type: string): LucideIcon {
  if (type.startsWith('PAYMENT')) return CreditCard;
  if (type.startsWith('REFUND')) return Receipt;
  if (type.startsWith('INVOICE')) return FileText;
  if (type.startsWith('RECONCILIATION')) return RefreshCw;
  return AlertTriangle;
}

/**
 * Page a notification should open. Payments and invoices have detail pages
 * (linked by id); refunds and reconciliation are list-only. Returns null when
 * there is no meaningful destination.
 */
export function notifHrefFor(
  n: Pick<AppNotification, 'type' | 'entityType' | 'entityId'>,
): string | null {
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
      if (n.type.startsWith('PAYMENT')) return '/payments';
      if (n.type.startsWith('INVOICE')) return '/invoices';
      if (n.type.startsWith('REFUND')) return '/refunds';
      if (n.type.startsWith('RECONCILIATION')) return '/reconciliation';
      return null;
  }
}

/** True when the ISO timestamp falls on the local calendar's today. */
export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
