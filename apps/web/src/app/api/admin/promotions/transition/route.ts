import { NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit, getSessionUser, jsonError, jsonOk, mapRpcError, readGuardedJson } from '@/lib/promotions/api';

const schema = z.object({ id: z.string().uuid(), action: z.enum(['submit','approve','reject']) }).strict();

export async function POST(request: NextRequest) {
  const guarded = await readGuardedJson(request, 1024);
  if (!guarded.ok) return guarded.response;
  const parsed = schema.safeParse(guarded.body);
  if (!parsed.success) return jsonError(400, 'Invalid transition', 'invalid');
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const limited = await enforceRateLimit(request, `admin-promotion-transition:${user.id}`, 30, 60);
  if (limited) return limited;
  const { error } = await supabase.rpc('admin_transition_promotion', { p_campaign_id: parsed.data.id, p_action: parsed.data.action });
  if (error) return mapRpcError(error, 'transition');
  return jsonOk({ ok: true });
}
