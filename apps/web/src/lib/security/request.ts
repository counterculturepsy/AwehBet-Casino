import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export function clientKey(request: NextRequest, action: string) {
  // Forwarded IP headers are attacker-controlled unless an upstream proxy
  // strips incoming copies and writes its own trusted value.
  // Do not silently trust x-forwarded-for or x-real-ip.
  const configuredHeader = process.env.TRUSTED_PROXY_IP_HEADER?.trim().toLowerCase();
  const allowed = new Set(['x-vercel-forwarded-for', 'cf-connecting-ip', 'true-client-ip']);
  const address = configuredHeader && allowed.has(configuredHeader)
    ? (request.headers.get(configuredHeader)?.split(',')[0]?.trim() || 'unknown')
    : 'unknown';
  return createHash('sha256').update(`${action}:${address}`).digest('hex');
}

export async function consumeRateLimit(request: NextRequest, action: string, limit: number, windowSeconds: number) {
  const service = createServiceSupabaseClient();
  const { data, error } = await service.rpc('consume_rate_limit', {
    p_key_hash: clientKey(request, action),
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error('Rate-limit service unavailable.');
  return data === true;
}
