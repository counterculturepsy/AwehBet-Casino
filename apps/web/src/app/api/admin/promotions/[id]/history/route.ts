import { NextRequest } from 'next/server';
import { getSessionUser, jsonError, jsonOk, mapRpcError } from '@/lib/promotions/api';
import { campaignIdSchema } from '@/lib/promotions/schemas';
import type { HistoryEvent } from '@/lib/promotions/types';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Read-only audit timeline for one campaign, newest first. Authorization and scoping happen in the database. */
export async function GET(_request: NextRequest, context: Context) {
  const id = campaignIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError(404, 'Campaign not available', 'not_found');
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const { data, error } = await supabase.rpc('admin_promotion_history', { p_campaign_id: id.data });
  if (error) return mapRpcError(error, 'history');
  return jsonOk({ events: (data ?? []) as HistoryEvent[] });
}
