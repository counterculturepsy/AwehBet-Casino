import { NextRequest } from 'next/server';
import { enforceRateLimit, getSessionUser, jsonError, jsonOk, mapRpcError, readGuardedJson } from '@/lib/promotions/api';
import { campaignIdSchema, updateCampaignSchema } from '@/lib/promotions/schemas';
import type { CampaignRow } from '@/lib/promotions/types';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Exact, authorized row lookup used by conflict recovery and duplication follow-up. */
export async function GET(_request: NextRequest, context: Context) {
  const id = campaignIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError(404, 'Campaign not available', 'not_found');
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const { data, error } = await supabase.rpc('admin_get_promotion', { p_campaign_id: id.data });
  if (error) return mapRpcError(error, 'get');
  const campaign = ((data ?? []) as CampaignRow[])[0] ?? null;
  if (!campaign) return jsonError(404, 'Campaign not available', 'not_found');
  return jsonOk({ campaign });
}

/**
 * Edits a draft. The caller states the version it last read; the database applies the change only if that
 * version is still current, so a stale editor receives 409 and never overwrites a newer edit.
 */
export async function PATCH(request: NextRequest, context: Context) {
  const guarded = await readGuardedJson(request);
  if (!guarded.ok) return guarded.response;
  const id = campaignIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError(404, 'Campaign not available', 'not_found');
  const parsed = updateCampaignSchema.safeParse(guarded.body);
  if (!parsed.success) return jsonError(400, 'Invalid campaign data', 'invalid');
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const limited = await enforceRateLimit(request, `admin-promotion-update:${user.id}`, 30, 60);
  if (limited) return limited;
  const v = parsed.data;
  const { data, error } = await supabase.rpc('admin_update_promotion', {
    p_campaign_id: id.data,
    p_expected_version: v.expectedVersion,
    p_title: v.title,
    p_description: v.description,
    p_kind: v.kind,
    p_credits: v.credits,
    p_starts_at: v.start,
    p_ends_at: v.end,
  });
  if (error) return mapRpcError(error, 'update');
  return jsonOk({ id: id.data, version: data });
}
