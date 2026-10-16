import { NextRequest, NextResponse } from 'next/server';
import { encryptIdentity, identityFingerprint } from '@/lib/security/identity';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';
import { payoutAccountSchema } from '@/lib/validation/player';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    if (!await consumeRateLimit(request, 'payout-account', 5, 3600)) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  } catch { return NextResponse.json({ error: 'Bank account setup is temporarily unavailable.' }, { status: 503 }); }
  const parsed = payoutAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the bank account information.' }, { status: 400 });
  const account = parsed.data.accountNumber;
  const service = createServiceSupabaseClient();
  const { data, error } = await service.rpc('save_payout_account', {
    p_user_id: user.id, p_bank_code: parsed.data.bankCode, p_account_holder: parsed.data.accountHolder,
    p_encrypted_account_number: encryptIdentity(account), p_account_fingerprint: identityFingerprint(`bank:${parsed.data.bankCode}:${account}`),
    p_account_last_four: account.slice(-4),
  });
  if (error) return NextResponse.json({ error: 'Unable to save this payout account.' }, { status: 409 });
  return NextResponse.json({ id: data, message: 'Bank account saved securely. It must be verified before withdrawals.' }, { status: 201 });
}
