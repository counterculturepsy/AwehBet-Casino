import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/validation/player';

const schema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  countryOfResidence: z.string().trim().length(2),
  mobilePhone: z.string().transform(normalizePhone).refine((value) => /^(?:\+27|0)[6-8][0-9]{8}$/.test(value)),
});

export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    if (!await consumeRateLimit(request, 'profile-update', 10, 3600)) return NextResponse.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
  } catch { return NextResponse.json({ error: 'Account updates are temporarily unavailable.' }, { status: 503 }); }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the profile information.' }, { status: 400 });
  const service = createServiceSupabaseClient();
  const { error } = await service.from('player_profiles').update({
    first_name: parsed.data.firstName, last_name: parsed.data.lastName,
    country_of_residence: parsed.data.countryOfResidence.toUpperCase(), mobile_phone: parsed.data.mobilePhone,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Unable to update the profile.' }, { status: 409 });
  await service.rpc('record_audit_event', { p_actor_user_id: user.id, p_subject_user_id: user.id, p_event_type: 'profile.updated', p_entity_type: 'player_profile', p_entity_id: user.id, p_metadata: {} });
  return NextResponse.json({ message: 'Profile updated.' });
}
