import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { featureFlags } from '@/lib/env';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';
import { depositPreviewSchema } from '@/lib/validation/player';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (featureFlags.payments) return NextResponse.json({ error: 'No authorised live payment provider is configured.' }, { status: 501 });
  try {
    if (!await consumeRateLimit(request, 'demo-deposit', 10, 3600)) return NextResponse.json({ error: 'Too many demo requests.' }, { status: 429 });
  } catch { return NextResponse.json({ error: 'Deposit previews are temporarily unavailable.' }, { status: 503 }); }
  const parsed = depositPreviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Select a method and enter an amount from R10 to R5,000.' }, { status: 400 });
  const service = createServiceSupabaseClient();
  const { data: wallet } = await service.from('wallets').select('id').eq('user_id', user.id).maybeSingle();
  if (!wallet) return NextResponse.json({ error: 'Wallet is unavailable.' }, { status: 409 });
  const reference = `AWB-DEMO-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error } = await service.from('deposit_intents').insert({
    user_id: user.id, wallet_id: wallet.id, method: parsed.data.method, amount_minor: parsed.data.amountMinor,
    idempotency_key: parsed.data.idempotencyKey, reference, status: 'pending', simulated: true,
  }).select('id, reference, status, simulated').single();
  if (error?.code === '23505') {
    const { data: existing } = await service.from('deposit_intents').select('id, reference, status, simulated').eq('user_id', user.id).eq('idempotency_key', parsed.data.idempotencyKey).single();
    return NextResponse.json(existing);
  }
  if (error) return NextResponse.json({ error: 'Unable to create the demo reference.' }, { status: 409 });
  await service.rpc('record_audit_event', { p_actor_user_id: user.id, p_subject_user_id: user.id, p_event_type: 'deposit.demo_created', p_entity_type: 'deposit_intent', p_entity_id: data.id, p_metadata: { method: parsed.data.method } });
  return NextResponse.json(data, { status: 201 });
}
