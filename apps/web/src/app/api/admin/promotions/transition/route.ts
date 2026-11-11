import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const schema = z.object({ id: z.string().uuid(), action: z.enum(['submit','approve','reject']) }).strict();

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  let raw: string;
  try { raw = await request.text(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (raw.length > 1024) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let parsed;
  try { parsed = schema.safeParse(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ error: 'Invalid transition' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await supabase.rpc('admin_transition_promotion', { p_campaign_id: parsed.data.id, p_action: parsed.data.action });
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'Forbidden' : 'Transition not permitted' }, { status: error.code === '42501' ? 403 : 409 });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
