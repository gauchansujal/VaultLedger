'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Transaction, TransactionListResponse, TransactionCategory, TransactionType } from '@/lib/types';

const categories: TransactionCategory[] = [
  'housing',
  'food',
  'transport',
  'utilities',
  'entertainment',
  'health',
  'savings',
  'subscriptions',
  'other',
];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<TransactionCategory>('food');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'esewa'>('manual');
  const [submitting, setSubmitting] = useState(false);

  async function loadTransactions() {
    setLoading(true);
    try {
      const res = await api.get<TransactionListResponse>('/api/transactions');
      setTransactions(res.transactions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (paymentMethod === 'esewa') {
        // eSewa v2 requires an actual HTML form POST to their payment page - not a
        // fetch/redirect. We ask our backend to prepare the signed form fields, then
        // build and auto-submit a real <form> to navigate the browser there.
        const res = await api.post<{
          formUrl: string;
          formParams: Record<string, string>;
        }>('/api/payments/esewa/initiate', {
          type,
          category,
          amount: Number(amount),
          note: note || undefined,
        });

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.formUrl;
        Object.entries(res.formParams).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return; // browser is navigating away - nothing more to do here
      }

      await api.post('/api/transactions', {
        type,
        category,
        amount: Number(amount),
        note: note || undefined,
      });
      setAmount('');
      setNote('');
      setShowForm(false);
      await loadTransactions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/transactions/${id}`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete transaction');
    }
  }

  const balance = transactions.reduce(
    (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
    0
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-vault-text">Transactions</h1>
          <p className="text-vault-textMuted text-sm mt-1">
            Balance:{' '}
            <span className={`font-mono ${balance >= 0 ? 'text-vault-teal' : 'text-vault-danger'}`}>
              {formatCurrency(balance, 'GBP')}
            </span>
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="vault-btn-primary">
          {showForm ? 'Cancel' : '+ Add transaction'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="vault-card p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="vault-label">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="vault-input"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="vault-label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                className="vault-input"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="vault-label">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="vault-input font-mono"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="vault-label">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="vault-input"
              placeholder="e.g. Weekly groceries"
              maxLength={280}
            />
          </div>

          {type === 'expense' && (
            <div>
              <label className="vault-label">Payment method</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm text-vault-text cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'manual'}
                    onChange={() => setPaymentMethod('manual')}
                  />
                  Log manually
                </label>
                <label className="flex items-center gap-2 text-sm text-vault-text cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'esewa'}
                    onChange={() => setPaymentMethod('esewa')}
                  />
                  Pay with eSewa (test)
                </label>
              </div>
              {paymentMethod === 'esewa' && (
                <p className="text-vault-textMuted text-xs mt-2">
                  You&apos;ll be redirected to eSewa&apos;s sandbox to complete a test payment,
                  then brought back here automatically.
                </p>
              )}
            </div>
          )}

          <button type="submit" disabled={submitting} className="vault-btn-primary w-full">
            {submitting
              ? paymentMethod === 'esewa'
                ? 'Redirecting to eSewa…'
                : 'Saving…'
              : paymentMethod === 'esewa'
                ? 'Continue to eSewa'
                : 'Save transaction'}
          </button>
        </form>
      )}

      {error && (
        <p className="text-vault-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-vault-textMuted text-sm">Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="vault-card p-8 text-center">
          <p className="text-vault-textMuted text-sm">
            No transactions yet. Add your first one to start tracking.
          </p>
        </div>
      ) : (
        <div className="vault-card divide-y divide-vault-border">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-vault-text text-sm font-medium">
                  {t.note || t.category[0].toUpperCase() + t.category.slice(1)}
                </p>
                <p className="text-vault-textMuted text-xs mt-0.5 font-mono flex items-center gap-2">
                  {formatDate(t.occurredAt)} · {t.category}
                  {t.paymentMethod === 'esewa' && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                        t.paymentStatus === 'completed'
                          ? 'bg-vault-teal/10 text-vault-teal'
                          : t.paymentStatus === 'failed'
                            ? 'bg-vault-danger/10 text-vault-danger'
                            : 'bg-vault-gold/10 text-vault-gold'
                      }`}
                    >
                      eSewa · {t.paymentStatus}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`font-mono text-sm ${
                    t.type === 'income' ? 'text-vault-teal' : 'text-vault-text'
                  }`}
                >
                  {t.type === 'income' ? '+' : '−'}
                  {formatCurrency(t.amount, t.currency)}
                </span>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-vault-textMuted hover:text-vault-danger text-xs transition-colors"
                  aria-label={`Delete transaction: ${t.note || t.category}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
