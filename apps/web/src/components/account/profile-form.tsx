'use client';

import { FormEvent, useState } from 'react';
import type { PlayerProfile } from '@/lib/account';

export function ProfileForm({ profile }: { profile: PlayerProfile }) {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firstName: form.get('firstName'), lastName: form.get('lastName'), mobilePhone: form.get('mobilePhone'), countryOfResidence: form.get('countryOfResidence') }) });
    const result = await response.json() as { error?: string; message?: string };
    setMessage(result.message || result.error || 'Unable to save.');
  }
  return <form className="dashboard-form" onSubmit={submit}><div className="form-grid two"><label>First name<input name="firstName" defaultValue={profile.first_name} required/></label><label>Last name<input name="lastName" defaultValue={profile.last_name} required/></label></div><label>Email address<input value={profile.email} disabled/><small>Email changes require a separately verified flow.</small></label><div className="form-grid two"><label>Mobile number<input name="mobilePhone" type="tel" defaultValue={profile.mobile_phone} required/></label><label>Country of residence<select name="countryOfResidence" defaultValue={profile.country_of_residence}><option value="ZA">South Africa</option><option value="BW">Botswana</option><option value="LS">Lesotho</option><option value="NA">Namibia</option><option value="SZ">Eswatini</option><option value="ZW">Zimbabwe</option><option value="MZ">Mozambique</option></select></label></div><button className="account-primary" type="submit">Save profile</button>{message && <p className="form-status" role="status">{message}</p>}</form>;
}
