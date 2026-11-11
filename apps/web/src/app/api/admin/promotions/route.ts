import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(300),
  kind: z.enum(['banner','demo-credit']),
  credits: z.number().int().min(0).max(100000),
  start: z.string().datetime({ offset: true }).nullable(),
  end: z.string().datetime({ offset: true }).nullable(),
}).strict().refine(v => (v.kind === 'banner' && v.credits === 0) || (v.kind === 'demo-credit' && v.credits >= 1), 'Invalid credit amount')
  .refine(v => !v.start || !v.end || Date.parse(v.end) > Date.parse(v.start), 'Invalid schedule');

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
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
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: unknown;
  try { const raw = await request.text(); if (raw.length > 4096) return NextResponse.json({ error: 'Payload too large' }, { status: 413 }); body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid campaign data' }, { status: 400 });
  const { supabase, user } = await session();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const v = parsed.data;
  const { data, error } = await supabase.rpc('admin_create_promotion', {
    p_title: v.title, p_description: v.description, p_kind: v.kind, p_credits: v.credits,
    p_starts_at: v.start, p_ends_at: v.end,
  });
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'Forbidden' : 'Unable to save draft' }, { status: error.code === '42501' ? 403 : 503 });
  return NextResponse.json({ id: data, status: 'draft' }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
