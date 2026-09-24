import type {
  InvoiceStatus,
  PaymentStatus,
  ReconciliationStatus,
  RefundStatus,
  InstallmentStatus,
  UserRole,
  StudentStatus,
} from '@/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'Student',
  ACCOUNTANT: 'Accountant',
  FINANCE_MANAGER: 'Finance Manager',
  ADMIN: 'Admin',
  AUDITOR: 'Auditor',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  STUDENT: 'bg-blue-100 text-blue-700',
  ACCOUNTANT: 'bg-amber-100 text-amber-700',
  FINANCE_MANAGER: 'bg-emerald-100 text-emerald-700',
  ADMIN: 'bg-rose-100 text-rose-700',
  AUDITOR: 'bg-violet-100 text-violet-700',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-gray-100 text-gray-500 line-through',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  CREATED: 'Created',
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUND_PENDING: 'Refund Pending',
  REFUNDED: 'Refunded',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  CREATED: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-amber-100 text-amber-700',
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  REFUND_PENDING: 'bg-orange-100 text-orange-700',
  REFUNDED: 'bg-violet-100 text-violet-700',
};

export const PAYMENT_STATE_FLOW: PaymentStatus[] = [
  'CREATED',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
];

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  MATCHED: 'Matched',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  MISSING_INTERNAL: 'Missing Internal',
  MISSING_GATEWAY: 'Missing Gateway',
  DUPLICATE: 'Duplicate',
  STATE_MISMATCH: 'State Mismatch',
  PENDING_REVIEW: 'Pending Review',
  RESOLVED: 'Resolved',
};

export const RECONCILIATION_STATUS_COLORS: Record<ReconciliationStatus, string> = {
  MATCHED: 'bg-emerald-100 text-emerald-700',
  AMOUNT_MISMATCH: 'bg-rose-100 text-rose-700',
  MISSING_INTERNAL: 'bg-orange-100 text-orange-700',
  MISSING_GATEWAY: 'bg-amber-100 text-amber-700',
  DUPLICATE: 'bg-violet-100 text-violet-700',
  STATE_MISMATCH: 'bg-rose-100 text-rose-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const REFUND_STATUS_COLORS: Record<RefundStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

export const INSTALLMENT_STATUS_COLORS: Record<InstallmentStatus, string> = {
  PENDING: 'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  GRADUATED: 'Graduated',
  SUSPENDED: 'Suspended',
};

export const STUDENT_STATUS_COLORS: Record<StudentStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  GRADUATED: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-rose-100 text-rose-700',
};

export const DEMO_CREDENTIALS = [
  { email: 'admin@edupay.edu', password: 'demo1234', role: 'Admin' },
  { email: 'finance@edupay.edu', password: 'demo1234', role: 'Finance Manager' },
  { email: 'accountant@edupay.edu', password: 'demo1234', role: 'Accountant' },
  { email: 'auditor@edupay.edu', password: 'demo1234', role: 'Auditor' },
  { email: 'student1@edupay.edu', password: 'demo1234', role: 'Student' },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string | null): string {
  if (!date) return '-';
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(date);
}
