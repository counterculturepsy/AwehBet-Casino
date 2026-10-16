import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getPublicEnv } from '@/lib/env';
import { encryptIdentity, identityFingerprint } from '@/lib/security/identity';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { registrationSchema } from '@/lib/validation/player';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 16_384) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please correct the highlighted information.', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    if (!await consumeRateLimit(request, 'register', 5, 3600)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Registration is temporarily unavailable.' }, { status: 503 });
  }

  const input = parsed.data;
  const env = getPublicEnv();
  const auth = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await auth.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account` },
  });

  if (error || !data.user || data.user.identities?.length === 0) {
    return NextResponse.json({ error: 'Unable to create this account. Check the information or sign in instead.' }, { status: 409 });
  }

  const service = createServiceSupabaseClient();
  const documentNumber = input.documentNumber;
  const { error: profileError } = await service.rpc('register_player_profile', {
    p_user_id: data.user.id,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_date_of_birth: input.birthDate,
    p_country_of_residence: input.countryOfResidence,
    p_mobile_phone: input.mobilePhone,
    p_email: input.email,
    p_marketing_consent: input.marketingConsent,
    p_document_type: input.documentType,
    p_encrypted_identifier: encryptIdentity(documentNumber),
    p_identifier_fingerprint: identityFingerprint(documentNumber),
    p_identifier_last_four: documentNumber.slice(-4),
    p_issuing_country: input.documentType === 'passport' ? input.issuingCountry : 'ZA',
  });

  if (profileError) {
    await service.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: 'Unable to create this account. Check the information or sign in instead.' }, { status: 409 });
  }

  return NextResponse.json({ message: 'Account created. Check your email to verify your address before signing in.' }, { status: 201 });
}
