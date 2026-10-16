'use client';

import { FormEvent, useState } from 'react';
import { CreditCard, Landmark, ShieldAlert, Smartphone, Ticket } from 'lucide-react';

const methods = [
  ['instant-eft', 'Instant EFT', Landmark], ['fnb', 'FNB', Landmark], ['capitec', 'Capitec', Landmark],
  ['nedbank', 'Nedbank', Landmark], ['absa', 'Absa', Landmark], ['card', 'Debit / credit card', CreditCard],
  ['voucher', 'Supported voucher', Ticket], ['apple-pay', 'Apple Pay', Smartphone], ['google-pay', 'Google Pay', Smartphone],
] as const;

export function DepositForm() {
  const [method, setMethod] = useState('instant-eft');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const amount = Number(new FormData(event.currentTarget).get('amount'));
    const response = await fetch('/api/account/deposit-intents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, amountMinor: Math.round(amount * 100), idempotencyKey: crypto.randomUUID() }) });
    const result = await response.json() as { error?: string; reference?: string };
    setMessage(result.reference ? `Demo reference ${result.reference} created. No money was taken.` : result.error || 'Unable to create preview.');
  }
  return <form className="dashboard-form" onSubmit={submit}><div className="method-grid" role="radiogroup" aria-label="Payment method">{methods.map(([id, label, Icon]) => <button key={id} type="button" role="radio" aria-checked={method === id} className={method === id ? 'selected' : ''} onClick={() => setMethod(id)}><Icon/><strong>{label}</strong><span>Integration pending</span></button>)}</div><label>Demo amount (ZAR)<input name="amount" type="number" min="10" max="5000" step="0.01" defaultValue="200" required/></label><div className="safety-notice"><ShieldAlert/><p><strong>Simulation only.</strong> Do not enter card numbers, banking credentials, voucher PINs, or one-time passwords. This creates a reference record but cannot move money.</p></div><button className="account-primary" type="submit">Create demo reference</button>{message && <p className="form-status" role="status">{message}</p>}</form>;
}
