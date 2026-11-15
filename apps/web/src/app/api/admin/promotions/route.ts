import { NextRequest } from 'next/server';
import { enforceRateLimit, getSessionUser, jsonError, jsonOk, mapRpcError, readGuardedJson } from '@/lib/promotions/api';
import { decodeCursor, encodeCursor, type CursorPosition } from '@/lib/promotions/cursor';
import { createCampaignSchema, parseSearchParams } from '@/lib/promotions/schemas';
import type { CampaignRow } from '@/lib/promotions/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const parsed = parseSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) return jsonError(400, 'Invalid search parameters', 'invalid');
  const query = parsed.value;
  let position: CursorPosition | null = null;
  if (query.cursor) {
    position = decodeCursor(query.cursor, query);
    if (!position) return jsonError(400, 'Invalid cursor', 'invalid_cursor');
  }
  // One extra row tells us whether another page exists without a second count query.
  const { data, error } = await supabase.rpc('admin_search_promotions', {
    p_search: query.search ?? null,
    p_status: query.status ?? null,
    p_kind: query.kind ?? null,
    p_created_by: query.createdBy ?? null,
    p_created_from: query.createdFrom ?? null,
    p_created_to: query.createdTo ?? null,
    p_updated_from: query.updatedFrom ?? null,
    p_updated_to: query.updatedTo ?? null,
    p_sort: query.sort,
    p_limit: query.limit + 1,
    p_cursor_ts: position?.timestamp ?? null,
    p_cursor_id: position?.id ?? null,
  });
  if (error) return mapRpcError(error, 'search');
  const rows = (data ?? []) as CampaignRow[];
  const campaigns = rows.slice(0, query.limit);
  const last = campaigns[campaigns.length - 1];
  const nextCursor = rows.length > query.limit && last
    ? encodeCursor(query, { timestamp: query.sort.startsWith('updated') ? last.updated_at : last.created_at, id: last.id })
    : null;
  return jsonOk({ campaigns, nextCursor, pageSize: query.limit });
}

export async function POST(request: NextRequest) {
  const guarded = await readGuardedJson(request);
  if (!guarded.ok) return guarded.response;
  const parsed = createCampaignSchema.safeParse(guarded.body);
  if (!parsed.success) return jsonError(400, 'Invalid campaign data', 'invalid');
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError(401, 'Unauthorized');
  const limited = await enforceRateLimit(request, `admin-promotion-create:${user.id}`, 10, 60);
  if (limited) return limited;
  const v = parsed.data;
  const { data, error } = await supabase.rpc('admin_create_promotion', {
    p_title: v.title, p_description: v.description, p_kind: v.kind, p_credits: v.credits,
    p_idempotency_key: v.idempotencyKey, p_starts_at: v.start, p_ends_at: v.end,
  });
  if (error) return mapRpcError(error, 'create');
  return jsonOk({ id: data, status: 'draft' }, 201);
}
