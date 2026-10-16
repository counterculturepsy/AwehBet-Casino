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

function clientKey(request: NextRequest, action: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown';
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
