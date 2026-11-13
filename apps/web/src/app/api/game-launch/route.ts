import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import {
  createDemoGameSession,
  getApprovedProviderHosts,
  getDemoProviderAdapter,
} from '@/lib/provider-launcher';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > 2048) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'JSON body required' }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (typeof input.gameId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.gameId) || input.mode !== 'demo') {
    return NextResponse.json({ error: 'Invalid game or mode' }, { status: 400 });
  }

  try {
    const allowed = await consumeRateLimit(request, 'demo-game-launch', 20, 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many launch attempts' }, { status: 429 });
    }

    const result = await createDemoGameSession(
      { gameId: input.gameId, mode: 'demo' },
      {
        adapter: getDemoProviderAdapter(),
        approvedHosts: getApprovedProviderHosts(),
        returnUrl: new URL('/demo', request.url).toString(),
        sessionId: crypto.randomUUID(),
      },
    );
    return NextResponse.json(result, {
      status: result.status === 'unavailable' ? (result.reason === 'unknown_game' ? 404 : 503) : 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error && error.message === 'Rate-limit service unavailable.'
      ? 'Launch protection is temporarily unavailable'
      : 'Unable to create a provider demo session';
    return NextResponse.json({ error: message }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
