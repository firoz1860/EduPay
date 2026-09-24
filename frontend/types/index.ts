export type UserRole = 'STUDENT' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'ADMIN' | 'AUDITOR';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type InstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ReconciliationStatus = 'MATCHED' | 'AMOUNT_MISMATCH' | 'MISSING_INTERNAL' | 'MISSING_GATEWAY' | 'DUPLICATE' | 'STATE_MISMATCH' | 'PENDING_REVIEW' | 'RESOLVED';
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED';
export type LedgerType = 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'FEE' | 'DISCOUNT';
export type LedgerDirection = 'CREDIT' | 'DEBIT';

export interface User {
  id: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  department_id: string | null;
  duration_years: number;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  user_id: string | null;
  roll_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  course_id: string | null;
  academic_year: string;
  semester: number;
  enrollment_date: string;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
  department?: Department;
  course?: Course;
}

export interface FeeHead {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_optional: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeeStructure {
  id: string;
  name: string;
  department_id: string | null;
  course_id: string | null;
  academic_year: string;
  semester: number;
  total_amount: number;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  course?: Course;
  items?: FeeStructureItem[];
}

export interface FeeStructureItem {
  id: string;
  fee_structure_id: string;
  fee_head_id: string;
  amount: number;
  discount_amount: number;
  discount_label: string | null;
  sort_order: number;
  fee_head?: FeeHead;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  student_id: string;
  fee_structure_id: string | null;
  academic_year: string;
  semester: number;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  due_date: string | null;
  status: InvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
  items?: InvoiceItem[];
  installments?: Installment[];
  payments?: Payment[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  fee_head_id: string | null;
  fee_head_name: string;
  amount: number;
  discount_amount: number;
  discount_label: string | null;
  sort_order: number;
}

export interface Installment {
  id: string;
  invoice_id: string;
  installment_number: number;
  label: string;
  amount: number;
  paid_amount: number;
  outstanding_amount: number;
  due_date: string | null;
  status: InstallmentStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  payment_number: string;
  student_id: string;
  invoice_id: string;
  installment_id: string | null;
  amount: number;
  currency: string;
  provider: string;
  provider_payment_id: string | null;
  transaction_reference: string | null;
  status: PaymentStatus;
  failure_reason: string | null;
  payment_method: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
  invoice?: Invoice;
}

export interface PaymentAttempt {
  id: string;
  payment_id: string;
  attempt_number: number;
  amount: number;
  provider: string;
  provider_attempt_id: string | null;
  status: string;
  failure_reason: string | null;
  provider_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GatewayEvent {
  id: string;
  gateway_event_id: string;
  provider: string;
  event_type: string | null;
  event_data: Record<string, unknown> | null;
  payment_id: string | null;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

export interface Refund {
  id: string;
  refund_number: string;
  payment_id: string;
  invoice_id: string;
  student_id: string;
  amount: number;
  reason: string | null;
  status: RefundStatus;
  provider_refund_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  payment?: Payment;
  student?: Student;
  invoice?: Invoice;
}

export interface LedgerEntry {
  id: string;
  reference: string;
  type: LedgerType;
  direction: LedgerDirection;
  amount: number;
  payment_id: string | null;
  invoice_id: string | null;
  refund_id: string | null;
  student_id: string | null;
  description: string | null;
  created_at: string;
}

export interface ReconciliationRecord {
  id: string;
  payment_id: string | null;
  internal_payment_number: string | null;
  internal_amount: number | null;
  internal_status: string | null;
  gateway_payment_id: string | null;
  gateway_amount: number | null;
  gateway_status: string | null;
  gateway_event_id: string | null;
  status: ReconciliationStatus;
  discrepancy_type: string | null;
  notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  payment?: Payment;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
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
