import { NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit, getSessionUser, jsonError, jsonOk, mapRpcError, readGuardedJson } from '@/lib/promotions/api';

const campaignId = z.string().uuid();
// Submitting freezes a draft into review, so the caller must name the version it reviewed. The database checks it
// under the same row lock as the state change and answers 409 when the draft has moved on.
// Approve and reject act on a submitted campaign, which can no longer be edited, so they carry no version.
const schema = z.discriminatedUnion('action', [
  z.object({ id: campaignId, action: z.literal('submit'), expectedVersion: z.number().int().min(1).max(2_147_483_647) }).strict(),
  z.object({ id: campaignId, action: z.enum(['approve', 'reject']) }).strict(),
]);

export async function POST(request: NextRequest) {
  const guarded = await readGuardedJson(request, 1024);
  if (!guarded.ok) return guarded.response;
  const parsed = schema.safeParse(guarded.body);
  if (!parsed.success) return jsonError(400, 'Invalid transition', 'invalid');
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const limited = await enforceRateLimit(request, `admin-promotion-transition:${user.id}`, 30, 60);
  if (limited) return limited;
  const t = parsed.data;
  const { error } = await supabase.rpc('admin_transition_promotion', {
    p_campaign_id: t.id,
    p_action: t.action,
    ...(t.action === 'submit' ? { p_expected_version: t.expectedVersion } : {}),
  });
  if (error) return mapRpcError(error, 'transition');
  return jsonOk({ ok: true });
}
