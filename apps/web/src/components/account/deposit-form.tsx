'use client';

import { FormEvent, useState } from 'react';
import { CreditCard, Landmark, ShieldAlert, Smartphone, Ticket } from 'lucide-react';

const methods = [
  ['instant-eft', 'Instant EFT', Landmark], ['fnb', 'FNB', Landmark], ['capitec', 'Capitec', Landmark],
  ['nedbank', 'Nedbank', Landmark], ['absa', 'Absa', Landmark], ['card', 'Debit / credit card', CreditCard],
  ['voucher', 'Supported voucher', Ticket], ['apple-pay', 'Apple Pay', Smartphone], ['google-pay', 'Google Pay', Smartphone],
] as const;

export function DepositForm({ capitecDirectDeposit }: { capitecDirectDeposit: boolean }) {
  const [method, setMethod] = useState('instant-eft');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const amount = Number(new FormData(event.currentTarget).get('amount'));
    const response = await fetch('/api/account/deposit-intents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, amountMinor: Math.round(amount * 100), idempotencyKey: crypto.randomUUID() }) });
    const result = await response.json() as { error?: string; reference?: string };
    setMessage(result.reference ? `Demo reference ${result.reference} created. No money was taken.` : result.error || 'Unable to create preview.');
  }
  return <form className="dashboard-form" onSubmit={submit}><div className="method-grid" role="radiogroup" aria-label="Payment method">{methods.map(([id, label, Icon]) => <button key={id} type="button" role="radio" aria-checked={method === id} className={method === id ? 'selected' : ''} onClick={() => setMethod(id)}><Icon/><strong>{label}</strong><span>{id === 'capitec' && capitecDirectDeposit ? 'Approved direct deposit' : 'Integration pending'}</span></button>)}</div>{method === 'capitec' && <section className="capitec-deposit" aria-live="polite"><h2>Capitec Pay Me direct deposit</h2>{capitecDirectDeposit ? <><img src="/api/account/payment-assets/capitec-qr" alt="AwehBet Capitec Pay Me QR code"/><p>Confirm your unique deposit reference and amount before scanning. A transfer is not automatically a credited wallet deposit until it has been reconciled and approved.</p></> : <p>The supplied QR code is held outside the public codebase and is not displayed while payments, merchant approval, reconciliation and operational controls remain disabled.</p>}</section>}<label>Demo amount (ZAR)<input name="amount" type="number" min="10" max="5000" step="0.01" defaultValue="200" required/></label><div className="safety-notice"><ShieldAlert/><p><strong>Simulation only.</strong> Do not enter card numbers, banking credentials, voucher PINs, or one-time passwords. This creates a reference record but cannot move money.</p></div><button className="account-primary" type="submit">Create demo reference</button>{message && <p className="form-status" role="status">{message}</p>}</form>;
}
