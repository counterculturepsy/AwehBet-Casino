import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(300),
  kind: z.enum(['banner','demo-credit']),
  credits: z.number().int().min(0).max(100000),
  idempotencyKey: z.string().uuid(),
  start: z.string().datetime({ offset: true }).nullable(),
  end: z.string().datetime({ offset: true }).nullable(),
}).strict().refine(v => (v.kind === 'banner' && v.credits === 0) || (v.kind === 'demo-credit' && v.credits >= 1), 'Invalid credit amount')
  .refine(v => !v.start || !v.end || Date.parse(v.end) > Date.parse(v.start), 'Invalid schedule');

async function session() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
export async function GET() {
  const { supabase, user } = await session();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase.rpc('admin_list_promotions');
  if (error) return NextResponse.json({ error: 'Unable to load campaigns' }, { status: error.code === '42501' ? 403 : 503 });
  return NextResponse.json({ campaigns: data }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: unknown;
  try { const raw = await request.text(); if (raw.length > 4096) return NextResponse.json({ error: 'Payload too large' }, { status: 413 }); body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid campaign data' }, { status: 400 });
  const { supabase, user } = await session();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (!await consumeRateLimit(request, `admin-promotion-create:${user.id}`, 10, 60)) {
      return NextResponse.json({ error: 'Too many campaign requests' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Campaign security service unavailable' }, { status: 503 });
  }
  const v = parsed.data;
  const { data, error } = await supabase.rpc('admin_create_promotion', {
    p_title: v.title, p_description: v.description, p_kind: v.kind, p_credits: v.credits,
    p_idempotency_key: v.idempotencyKey, p_starts_at: v.start, p_ends_at: v.end,
  });
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '22023' ? 409 : 503;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : status === 409 ? 'Request conflicts with an existing draft' : 'Unable to save draft' }, { status });
  }
  return NextResponse.json({ id: data, status: 'draft' }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
