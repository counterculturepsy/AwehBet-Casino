'use client';

import { FormEvent, useState } from 'react';

async function send(payload: object) {
  const response = await fetch('/api/account/responsible-gaming', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return response.json() as Promise<{ error?: string; message?: string }>;
}

export function ResponsibleGamingForm() {
  const [message, setMessage] = useState('');
  async function limits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const minor = (name: string) => form.get(name) ? Math.round(Number(form.get(name)) * 100) : null;
    const result = await send({ action: 'limits', dailyMinor: minor('daily'), weeklyMinor: minor('weekly'), monthlyMinor: minor('monthly') }); setMessage(result.message || result.error || 'Unable to save.');
  }
  async function restriction(action: 'cool-off' | 'self-exclude', value: number) {
    if (!window.confirm('This restriction cannot be shortened or removed from this screen. Continue?')) return;
    const result = await send(action === 'cool-off' ? { action, days: value } : { action, months: value }); setMessage(result.message || result.error || 'Unable to save.');
  }
  return <div className="split-panels"><form className="dashboard-form" onSubmit={limits}><h2>Deposit limits</h2><p>Lower limits apply immediately. Increases and removals require a cooling-off review.</p><label>Daily limit (ZAR)<input name="daily" type="number" min="0" step="1"/></label><label>Weekly limit (ZAR)<input name="weekly" type="number" min="0" step="1"/></label><label>Monthly limit (ZAR)<input name="monthly" type="number" min="0" step="1"/></label><button className="account-primary" type="submit">Save limits</button></form><section className="dashboard-form"><h2>Take a break</h2><p>Cooling-off and self-exclusion restrictions cannot be reversed here.</p><div className="restriction-actions"><button type="button" onClick={() => restriction('cool-off', 1)}>Cool off 24 hours</button><button type="button" onClick={() => restriction('cool-off', 7)}>Cool off 7 days</button><button type="button" onClick={() => restriction('cool-off', 30)}>Cool off 30 days</button><button type="button" className="danger" onClick={() => restriction('self-exclude', 6)}>Self-exclude 6 months</button><button type="button" className="danger" onClick={() => restriction('self-exclude', 12)}>Self-exclude 12 months</button><button type="button" className="danger" onClick={() => restriction('self-exclude', 60)}>Self-exclude 5 years</button></div></section>{message && <p className="form-status span-all" role="status">{message}</p>}</div>;
}
