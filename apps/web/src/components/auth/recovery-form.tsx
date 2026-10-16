'use client';

import { FormEvent, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { passwordSchema } from '@/lib/validation/player';

export function ForgotPasswordForm() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') || '');
    const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const result = await response.json() as { error?: string; message?: string };
    setMessage(result.message || result.error || 'Unable to continue.');
  }
  return <form className="account-form" onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" required/></label><button className="account-primary" type="submit">Send recovery email</button>{message && <p className="form-status" role="status">{message}</p>}</form>;
}

export function ResetPasswordForm() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') || '');
    const valid = passwordSchema.safeParse(password);
    if (!valid.success) { setMessage(valid.error.issues[0]?.message || 'Use a stronger password.'); return; }
    const { error } = await createBrowserSupabaseClient().auth.updateUser({ password });
    setMessage(error ? 'Unable to update the password. Request a new recovery email.' : 'Password updated. You may continue to your account.');
  }
  return <form className="account-form" onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required/><small>12+ characters with upper and lowercase letters, a number, and a symbol.</small></label><button className="account-primary" type="submit">Update password</button>{message && <p className="form-status" role="status">{message}</p>}</form>;
}
