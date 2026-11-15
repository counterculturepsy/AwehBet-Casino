import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import type { PromotionErrorCode } from './types';

export const MAX_BODY_BYTES = 4096;
const NO_STORE = { 'Cache-Control': 'no-store' };

export function jsonError(status: number, error: string, code?: PromotionErrorCode) {
  return NextResponse.json(code ? { error, code } : { error }, { status, headers: NO_STORE });
}

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Same-origin, content-type, size and JSON checks shared by every promotion mutation route. */
export async function readGuardedJson(
  request: NextRequest,
  maxBytes = MAX_BODY_BYTES,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const reject = (status: number, message: string) => ({ ok: false as const, response: jsonError(status, message) });
  if (!assertSameOrigin(request)) return reject(403, 'Origin not allowed');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reject(415, 'JSON required');
  if (Number(request.headers.get('content-length') || 0) > maxBytes) return reject(413, 'Payload too large');
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return reject(400, 'Invalid body');
  }
  // Content-Length is optional (for example with chunked transfer), and JavaScript string length counts
  // UTF-16 code units rather than request bytes. Measure the decoded body as UTF-8 so multi-byte input
  // cannot exceed the mutation limit while still appearing short enough here.
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) return reject(413, 'Payload too large');
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return reject(400, 'Invalid JSON');
  }
}

/** The user's own Supabase session. Authorization is decided by the database through that session. */
export async function getSessionUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Per-user limiter. Fails closed: if the limiter is unreachable the mutation is refused. */
export async function enforceRateLimit(
  request: NextRequest,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  try {
    if (!await consumeRateLimit(request, action, limit, windowSeconds)) {
      return jsonError(429, 'Too many campaign requests', 'rate_limited');
    }
    return null;
  } catch {
    return jsonError(503, 'Campaign security service unavailable', 'unavailable');
  }
}

/**
 * Maps database SQLSTATE codes onto neutral responses. Raw database messages never reach the browser, and
 * unexpected failures are logged with the SQLSTATE only: no payloads, identifiers or personal data.
 */
export function mapRpcError(error: { code?: string | null }, operation: string) {
  switch (error.code) {
    case '42501':
      return jsonError(403, 'Forbidden', 'forbidden');
    case 'P0002':
      return jsonError(404, 'Campaign not available', 'not_found');
    case 'PS409':
      return jsonError(409, 'This campaign was changed by another administrator.', 'stale_version');
    case '22023':
      return jsonError(409, 'This request conflicts with the current state of the campaign.', 'conflict');
    case '23514':
    case '23502':
    case '22001':
      return jsonError(400, 'Invalid campaign data', 'invalid');
    default:
      console.error('admin.promotions.rpc_failed', { operation, sqlstate: error.code ?? 'unknown' });
      return jsonError(503, 'Unable to complete the request', 'unavailable');
  }
}
