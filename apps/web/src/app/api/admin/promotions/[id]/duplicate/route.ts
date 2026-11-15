import { NextRequest } from 'next/server';
import { enforceRateLimit, getSessionUser, jsonError, jsonOk, mapRpcError, readGuardedJson } from '@/lib/promotions/api';
import { campaignIdSchema, duplicateCampaignSchema } from '@/lib/promotions/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Copies a campaign's content into a new draft. Retrying with the same idempotency key returns the same
 * copy; reusing a key for a different source campaign is a conflict.
 */
export async function POST(request: NextRequest, context: Context) {
  const guarded = await readGuardedJson(request);
  if (!guarded.ok) return guarded.response;
  const id = campaignIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError(404, 'Campaign not available', 'not_found');
  const parsed = duplicateCampaignSchema.safeParse(guarded.body);
  if (!parsed.success) return jsonError(400, 'Invalid duplicate request', 'invalid');
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const limited = await enforceRateLimit(request, `admin-promotion-duplicate:${user.id}`, 10, 60);
  if (limited) return limited;
  const { data, error } = await supabase.rpc('admin_duplicate_promotion', {
    p_campaign_id: id.data,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return mapRpcError(error, 'duplicate');
  return jsonOk({ id: data, status: 'draft', duplicatedFrom: id.data }, 201);
}
