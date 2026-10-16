'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';

type FieldErrors = Record<string, string[]>;

export function AuthForm({ mode, next = '/account' }: { mode: 'login' | 'register'; next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [documentType, setDocumentType] = useState('sa-id');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setErrors({});
    const form = new FormData(event.currentTarget);
    const payload = mode === 'login'
      ? { email: form.get('email'), password: form.get('password') }
      : {
          firstName: form.get('firstName'), lastName: form.get('lastName'), birthDate: form.get('birthDate'),
          documentType: form.get('documentType'), documentNumber: form.get('documentNumber'),
          countryOfResidence: form.get('countryOfResidence'), issuingCountry: form.get('issuingCountry') || undefined,
          mobilePhone: form.get('mobilePhone'), email: form.get('email'), password: form.get('password'),
          confirmPassword: form.get('confirmPassword'), acceptedTerms: form.get('acceptedTerms') === 'on',
          acknowledgedPrivacy: form.get('acknowledgedPrivacy') === 'on', marketingConsent: form.get('marketingConsent') === 'on',
        };
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; message?: string; fields?: FieldErrors };
      if (!response.ok) {
        setMessage(result.error || 'Unable to continue.');
        setErrors(result.fields || {});
      } else if (mode === 'login') {
        router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/account');
        router.refresh();
      } else {
        setMessage(result.message || 'Account created. Check your email to verify it.');
        event.currentTarget.reset();
      }
    } catch {
      setMessage('The service is temporarily unavailable. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const errorFor = (name: string) => errors[name]?.[0];
  return <form className="account-form" onSubmit={submit} noValidate>
    {mode === 'register' && <>
      <div className="form-grid two"><Field name="firstName" label="First name" error={errorFor('firstName')} autoComplete="given-name"/><Field name="lastName" label="Last name" error={errorFor('lastName')} autoComplete="family-name"/></div>
      <div className="form-grid two"><Field name="birthDate" label="Date of birth" error={errorFor('birthDate')} type="date" autoComplete="bday"/><label>Country of residence<select name="countryOfResidence" defaultValue="ZA" required><option value="ZA">South Africa</option><option value="BW">Botswana</option><option value="LS">Lesotho</option><option value="NA">Namibia</option><option value="SZ">Eswatini</option><option value="ZW">Zimbabwe</option><option value="MZ">Mozambique</option></select></label></div>
      <fieldset className="identity-fieldset"><legend>Identity document</legend><div className="form-grid two"><label>Document type<select name="documentType" value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="sa-id">South African ID</option><option value="passport">Passport</option></select></label><Field name="documentNumber" label={documentType === 'sa-id' ? 'South African ID number' : 'Passport number'} error={errorFor('documentNumber')} inputMode={documentType === 'sa-id' ? 'numeric' : 'text'} autoComplete="off"/></div>{documentType === 'passport' && <label>Passport issuing country<select name="issuingCountry" defaultValue=""><option value="" disabled>Select a country</option><option value="ZA">South Africa</option><option value="BW">Botswana</option><option value="LS">Lesotho</option><option value="NA">Namibia</option><option value="SZ">Eswatini</option><option value="ZW">Zimbabwe</option><option value="MZ">Mozambique</option></select></label>}<p>Encrypted server-side. A valid format is not proof of identity, and no document upload is collected here.</p></fieldset>
      <Field name="mobilePhone" label="Mobile phone number" error={errorFor('mobilePhone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="082 123 4567"/>
    </>}
    <Field name="email" label="Email address" error={errorFor('email')} type="email" inputMode="email" autoComplete="email"/>
    <label>Password<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-describedby={mode === 'register' ? 'password-help' : undefined} required/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff/> : <Eye/>}</button></div>{errorFor('password') && <span className="field-error">{errorFor('password')}</span>}{mode === 'register' && <small id="password-help">12+ characters with upper and lowercase letters, a number, and a symbol.</small>}</label>
    {mode === 'register' && <><Field name="confirmPassword" label="Confirm password" error={errorFor('confirmPassword')} type="password" autoComplete="new-password"/><label className="check-row"><input name="acceptedTerms" type="checkbox" required/><span>I accept the Terms and Conditions and confirm I am 18 or older.</span></label><label className="check-row"><input name="acknowledgedPrivacy" type="checkbox" required/><span>I acknowledge the Privacy Policy and the handling of identity information for account verification.</span></label><label className="check-row"><input name="marketingConsent" type="checkbox"/><span>Send me marketing communications (optional).</span></label></>}
    <button className="account-primary" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin"/> : <ShieldCheck/>}{mode === 'login' ? 'Secure sign in' : 'Create account'}</button>
    {message && <p className="form-status" role="status" aria-live="polite">{message}</p>}
    <div className="form-links">{mode === 'login' ? <><Link href="/forgot-password">Forgot password?</Link><span>New to AwehBet? <Link href="/register">Create an account</Link></span></> : <span>Already registered? <Link href="/login">Sign in</Link></span>}</div>
  </form>;
}

function Field({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorId = props.name ? `${props.name}-error` : undefined;
  return <label>{label}<input {...props} required aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}/>{error && <span id={errorId} className="field-error">{error}</span>}</label>;
}
