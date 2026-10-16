'use client';

import { FormEvent, useState } from 'react';
import type { PayoutAccount } from '@/lib/account';

export function WithdrawalForm({ accounts }: { accounts: PayoutAccount[] }) {
  const [message, setMessage] = useState('');
  async function saveBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch('/api/account/payout-accounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bankCode: form.get('bankCode'), accountHolder: form.get('accountHolder'), accountNumber: form.get('accountNumber') }) });
    const result = await response.json() as { error?: string; message?: string }; setMessage(result.message || result.error || 'Unable to save.');
  }
  async function requestWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch('/api/account/withdrawals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payoutAccountId: form.get('payoutAccountId'), amountMinor: Math.round(Number(form.get('amount')) * 100), idempotencyKey: crypto.randomUUID() }) });
    const result = await response.json() as { error?: string; id?: string }; setMessage(result.id ? 'Simulated withdrawal request created for review.' : result.error || 'Unable to continue.');
  }
  return <div className="split-panels"><form className="dashboard-form" onSubmit={saveBank}><h2>Secure bank-account setup</h2><p>Account numbers are encrypted and never returned to the browser after saving.</p><label>Bank<select name="bankCode" defaultValue="fnb"><option value="fnb">FNB</option><option value="capitec">Capitec</option><option value="nedbank">Nedbank</option><option value="absa">Absa</option></select></label><label>Account holder<input name="accountHolder" autoComplete="name" required/></label><label>Account number<input name="accountNumber" inputMode="numeric" autoComplete="off" minLength={6} maxLength={16} required/></label><button className="account-primary" type="submit">Save for verification</button></form><form className="dashboard-form" onSubmit={requestWithdrawal}><h2>Withdrawal request</h2><p>Requires verified identity, a verified bank account, and sufficient available demo balance.</p><label>Payout account<select name="payoutAccountId" defaultValue="" required><option value="" disabled>Select an account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.bank_code.toUpperCase()} · •••• {account.account_last_four} · {account.verified_at ? 'Verified' : 'Pending verification'}</option>)}</select></label><label>Amount (ZAR)<input name="amount" type="number" min="50" max="10000" step="0.01" required/></label><button className="account-primary" type="submit" disabled={!accounts.some((account) => account.verified_at)}>Request simulated withdrawal</button></form>{message && <p className="form-status span-all" role="status">{message}</p>}</div>;
}
