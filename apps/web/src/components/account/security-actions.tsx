'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SecurityActions() {
  const router = useRouter(); const [message, setMessage] = useState('');
  async function signOutAll() { await fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ allSessions: true }) }); setMessage('All sessions have been signed out.'); router.push('/login'); router.refresh(); }
  return <div className="dashboard-form"><h2>Active sessions</h2><p>Supabase manages secure sessions in HTTP cookies. Use this control if you no longer trust another device.</p><button className="account-primary" type="button" onClick={signOutAll}>Sign out all sessions</button>{message && <p className="form-status" role="status">{message}</p>}</div>;
}
