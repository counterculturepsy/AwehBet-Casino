import { NextRequest, NextResponse } from 'next/server';
import { featureFlags } from '@/lib/env';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';
import { withdrawalPreviewSchema } from '@/lib/validation/player';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (featureFlags.withdrawals) return NextResponse.json({ error: 'No authorised live payout provider is configured.' }, { status: 501 });
  try {
    if (!await consumeRateLimit(request, 'demo-withdrawal', 5, 3600)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  } catch { return NextResponse.json({ error: 'Withdrawal previews are temporarily unavailable.' }, { status: 503 }); }
  const parsed = withdrawalPreviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Select a verified bank account and enter at least R50.' }, { status: 400 });
  const service = createServiceSupabaseClient();
  const { data, error } = await service.rpc('create_simulated_withdrawal', {
    p_user_id: user.id, p_payout_account_id: parsed.data.payoutAccountId,
    p_amount_minor: parsed.data.amountMinor, p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return NextResponse.json({ error: 'Identity verification, a verified bank account, and sufficient demo balance are required.' }, { status: 403 });
  return NextResponse.json(data, { status: 201 });
}
