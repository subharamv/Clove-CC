
export enum View {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  ISSUED_HISTORY = 'ISSUED_HISTORY',
  PENDING = 'PENDING',
  PREVIEW = 'PREVIEW',
  PROFILE = 'PROFILE',
  SETTINGS = 'SETTINGS',
  SETTLEMENT = 'SETTLEMENT',
  SCAN_COUPON = 'SCAN_COUPON',
  VENDOR_HISTORY = 'VENDOR_HISTORY',
  RESET_PASSWORD = 'RESET_PASSWORD'
}

export enum CouponStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  RECEIVED = 'RECEIVED',
  ISSUED = 'ISSUED',
  SETTLED = 'SETTLED'
}

export interface Settlement {
  id: string;
  totalAmount: number;
  couponCount: number;
  settledBy: string;
  vendorId?: string;
  settledAt: string;
  referenceNumber: string;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  empId: string;
  otHours: number;
  amount: number;
  status: CouponStatus;
  serialCode: string;
  issueDate: string;
  validTill: string;
  created_at?: string;
  couponImageUrl?: string;
  print_status?: 'PENDING_PRINT' | 'PRINTED';
  settlement_id?: string;
  received_by?: string;
}

export interface TemplateElement {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
}

export interface CouponAmountConfig {
  id: string;
  amount: number;
  validityPeriod: number;
  isDefault: boolean;
  isVisible?: boolean;
}

export interface SystemSettings {
  prefix: string;
  startNumber: number;
  suffix: string;
  amount: number;
  validityPeriod: number;
  useFixedDate: boolean;
  fixedDate?: string;
  backgroundTemplate: string;
  templateElements?: TemplateElement[];
  qrEnabled?: boolean;
  paymentEnabled?: boolean;
  stripePublicKey?: string;
  allowPartialPayments?: boolean;
  couponAmounts?: CouponAmountConfig[];
  amountVisible?: boolean;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  UPI = 'UPI',
  NET_BANKING = 'NET_BANKING',
  WALLET = 'WALLET'
}

export interface Payment {
  id: string;
  couponId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  stripePaymentIntentId?: string;
  transactionId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
  refundAmount?: number;
  refundedAt?: string;
}

export interface PaymentRequest {
  couponIds: string[];
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  clientSecret: string;
  paymentMethodId?: string;
  nextAction?: any;
}

export interface PaymentFormData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
  email?: string;
  phone?: string;
  savePaymentMethod?: boolean;
}

export interface PaymentSettings {
  enabled: boolean;
  stripePublicKey: string;
  stripeSecretKey?: string;
  webhookSecret?: string;
  allowedMethods: PaymentMethod[];
  minimumAmount: number;
  maximumAmount: number;
  requireCvv: boolean;
  autoRefundEnabled: boolean;
  refundPolicy: string;
}

export interface PaymentHistory {
  totalPayments: number;
  totalAmount: number;
  successfulPayments: number;
  failedPayments: number;
  refundedAmount: number;
  recentPayments: Payment[];
}

export interface Receipt {
  id: string;
  paymentId: string;
  couponId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  issuedAt: string;
  customerEmail?: string;
  customerPhone?: string;
  couponDetails: {
    employeeName: string;
    employeeId: string;
    serialCode: string;
    amount: number;
    issueDate: string;
    validTill: string;
  };
}

export interface PaymentError {
  code: string;
  message: string;
  type: string;
  paymentIntentId?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
  livemode: boolean;
}
