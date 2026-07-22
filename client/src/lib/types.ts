export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'housing'
  | 'food'
  | 'transport'
  | 'utilities'
  | 'entertainment'
  | 'health'
  | 'savings'
  | 'subscriptions'
  | 'other';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  note?: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'user' | 'household-admin' | 'system-admin';
  avatarUrl?: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'household-admin' | 'system-admin';
  avatarUrl?: string;
  mfaEnabled: boolean;
  isLocked: boolean;
  createdAt: string;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
