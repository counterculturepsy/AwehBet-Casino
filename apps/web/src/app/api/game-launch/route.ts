import { NextResponse } from 'next/server';
import { createDemoGameSession } from '../../../lib/provider-launcher';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

  const result = await createDemoGameSession({ gameId: input.gameId, mode: 'demo' });
  return NextResponse.json(result, {
    status: result.status === 'unavailable' ? (result.reason === 'unknown_game' ? 404 : 503) : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
