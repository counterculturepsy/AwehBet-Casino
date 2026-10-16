import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';
import { responsibleGamingSchema } from '@/lib/validation/player';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    if (!await consumeRateLimit(request, 'responsible-gaming', 10, 3600)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  } catch { return NextResponse.json({ error: 'Safety controls are temporarily unavailable.' }, { status: 503 }); }
  const parsed = responsibleGamingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid safety-control request.' }, { status: 400 });
  const service = createServiceSupabaseClient();
  const { data: current } = await service.from('responsible_gaming_settings').select('*').eq('user_id', user.id).single();
  const now = new Date();
  let changes: Record<string, string | number | null> = { updated_at: now.toISOString() };
  if (parsed.data.action === 'cool-off') {
    const until = new Date(now.getTime() + parsed.data.days * 86_400_000);
    if (current?.cooling_off_until && new Date(current.cooling_off_until) > until) return NextResponse.json({ error: 'An active cooling-off period cannot be shortened.' }, { status: 409 });
    changes.cooling_off_until = until.toISOString();
  } else if (parsed.data.action === 'self-exclude') {
    const until = new Date(now); until.setUTCMonth(until.getUTCMonth() + parsed.data.months);
    changes = { ...changes, self_excluded_at: now.toISOString(), self_exclusion_until: until.toISOString() };
  } else {
    const proposed = [parsed.data.dailyMinor, parsed.data.weeklyMinor, parsed.data.monthlyMinor];
    if (proposed[0] !== null && proposed[1] !== null && proposed[0] > proposed[1] || proposed[1] !== null && proposed[2] !== null && proposed[1] > proposed[2]) return NextResponse.json({ error: 'Daily, weekly, and monthly limits must increase in that order.' }, { status: 400 });
    const old = [current?.daily_deposit_limit_minor, current?.weekly_deposit_limit_minor, current?.monthly_deposit_limit_minor];
    if (proposed.some((value, index) => old[index] != null && (value == null || value > old[index]))) return NextResponse.json({ error: 'Limit increases or removals require a cooling-off review.' }, { status: 409 });
    changes = { ...changes, daily_deposit_limit_minor: proposed[0], weekly_deposit_limit_minor: proposed[1], monthly_deposit_limit_minor: proposed[2] };
  }
  const { error } = await service.from('responsible_gaming_settings').update(changes).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Unable to save the safety control.' }, { status: 409 });
  await service.rpc('record_audit_event', { p_actor_user_id: user.id, p_subject_user_id: user.id, p_event_type: `responsible_gaming.${parsed.data.action}`, p_entity_type: 'responsible_gaming_settings', p_entity_id: null, p_metadata: {} });
  return NextResponse.json({ message: 'Safety control saved. Restrictions cannot be removed from this screen.' });
}
