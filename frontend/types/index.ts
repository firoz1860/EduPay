// API response types (camelCase — matches the backend JSON envelope `data`).

export type UserRole = 'STUDENT' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'ADMIN' | 'AUDITOR';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type InstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ReconciliationStatus =
  | 'MATCHED' | 'AMOUNT_MISMATCH' | 'MISSING_INTERNAL' | 'MISSING_GATEWAY'
  | 'DUPLICATE' | 'STATE_MISMATCH' | 'PENDING_REVIEW' | 'RESOLVED';
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED';
export type LedgerType = 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'FEE' | 'DISCOUNT';
export type LedgerDirection = 'CREDIT' | 'DEBIT';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  studentId: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  _count?: { students: number; courses: number };
  courses?: Course[];
}

export interface Course {
  id: string;
  name: string;
  code: string;
  departmentId: string | null;
  durationYears: number;
}

export interface Student {
  id: string;
  userId: string | null;
  rollNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  courseId: string | null;
  academicYear: string;
  semester: number;
  enrollmentDate: string;
  status: StudentStatus;
  department?: Department | null;
  course?: Course | null;
  invoiceSummary?: { count: number; outstanding: number };
}

export interface FeeHead {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isOptional: boolean;
}

export interface FeeStructureItem {
  id: string;
  feeStructureId: string;
  feeHeadId: string;
  amount: number;
  discountAmount: number;
  discountLabel: string | null;
  sortOrder: number;
  feeHead?: FeeHead;
}

export interface FeeStructure {
  id: string;
  name: string;
  departmentId: string | null;
  courseId: string | null;
  academicYear: string;
  semester: number;
  totalAmount: number;
  status: string;
  department?: Department | null;
  course?: Course | null;
  items?: FeeStructureItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  feeHeadId: string | null;
  feeHeadName: string;
  amount: number;
  discountAmount: number;
  discountLabel: string | null;
  sortOrder: number;
}

export interface Installment {
  id: string;
  invoiceId: string;
  installmentNumber: number;
  label: string;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string | null;
  status: InstallmentStatus;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  feeStructureId: string | null;
  academicYear: string;
  semester: number;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  payableAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string | null;
  status: InvoiceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  student?: Student;
  items?: InvoiceItem[];
  installments?: Installment[];
  payments?: Payment[];
}

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  attemptNumber: number;
  amount: number;
  provider: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  studentId: string;
  invoiceId: string;
  installmentId: string | null;
  amount: number;
  currency: string;
  provider: string;
  providerPaymentId: string | null;
  transactionReference: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  paymentMethod: string | null;
  createdAt: string;
  updatedAt: string;
  student?: { id: string; fullName: string; rollNumber: string; email: string } | null;
  invoice?: { id: string; invoiceNumber: string; payableAmount: number; outstandingAmount: number; status: string } | null;
  attempts?: PaymentAttempt[];
}

export interface Refund {
  id: string;
  refundNumber: string;
  paymentId: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  reason: string | null;
  status: RefundStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  payment?: { id: string; paymentNumber: string; amount: number; status: string } | null;
  student?: { id: string; fullName: string; rollNumber: string } | null;
  invoice?: { id: string; invoiceNumber: string } | null;
}

export interface LedgerEntry {
  id: string;
  reference: string;
  type: LedgerType;
  direction: LedgerDirection;
  amount: number;
  paymentId: string | null;
  invoiceId: string | null;
  refundId: string | null;
  studentId: string | null;
  description: string | null;
  createdAt: string;
  student?: { id: string; fullName: string; rollNumber: string } | null;
}

export interface ReconciliationRecord {
  id: string;
  paymentId: string | null;
  internalPaymentNumber: string | null;
  internalAmount: number | null;
  internalStatus: string | null;
  gatewayPaymentId: string | null;
  gatewayAmount: number | null;
  gatewayStatus: string | null;
  gatewayEventId: string | null;
  status: ReconciliationStatus;
  discrepancyType: string | null;
  notes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  payment?: { id: string; paymentNumber: string; status: string; student?: { fullName: string; rollNumber: string } } | null;
  resolver?: { id: string; fullName: string } | null;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface DashboardData {
  totalFees: number;
  collected: number;
  outstanding: number;
  overdue: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundsCount: number;
  refundsAmount: number;
  reconciliationIssues: number;
  invoiceStatusBreakdown: { status: string; count: number }[];
  paymentStatusBreakdown: { status: string; count: number }[];
}
