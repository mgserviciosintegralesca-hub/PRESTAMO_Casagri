export enum UserRole {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
}

export enum LoanStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
}

export interface Worker {
  uid: string;
  displayName: string;
  email: string;
  idNumber?: string;
  department?: string;
  role: UserRole;
  createdAt: string;
  cargo?: string;
  sucursal?: string;
}

export enum RepaymentFrequency {
  MONTHLY = 'monthly',
  BIWEEKLY = 'biweekly',
}

export interface Loan {
  id: string;
  loanNumber: string;
  workerId: string;
  workerName?: string;
  amountForeign: number;
  currency: Currency;
  rateAtAgreement: number;
  motiveId: string;
  subMotiveId?: string;
  status: LoanStatus;
  totalInstallments: number;
  repaymentFrequency: RepaymentFrequency;
  remainingInstallments: number;
  determinationMode?: 'months' | 'fixed_amount';
  fixedInstallmentAmount?: number | null;
  guaranteeInfo?: string;
  repaymentSchedule?: RepaymentInstallment[];
  requestedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  disbursementDate?: string;
  disbursementReference?: string;
  disbursementBy?: string;
  disbursementProofUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepaymentInstallment {
  installmentNumber: number;
  dueDate: string;
  amountForeign: number;
  status: 'pending' | 'paid';
}

export enum PaymentMethod {
  CASH_BS = 'cash_bs',
  CASH_USD = 'cash_usd',
  PAYROLL_DEDUCTION = 'payroll_deduction',
  MOBILE_PAYMENT = 'mobile_payment',
  BANK_TRANSFER = 'bank_transfer',
  MIXED = 'mixed',
  USDT = 'usdt',
}

export interface Payment {
  id: string;
  loanId: string;
  workerId: string;
  amountBs: number;
  amountForeign: number;
  rateApplied: number;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber: string;
  status: 'pending' | 'confirmed';
  registeredBy?: string;
  mixedBreakdown?: {
    bs: number;
    usd: number;
    eur: number;
  };
}

export interface Motive {
  id: string;
  name: string;
  subMotives: string[];
}

export interface SystemSettings {
  usdRate: number;
  eurRate: number;
  usdtRate?: number;
  lastUpdated: string;
  updatedBy: string;
  companyName?: string;
  companyLogo?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyTaxId?: string;
}

export enum NotificationType {
  PAYMENT_DUE = 'payment_due',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  SYSTEM = 'system',
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}
