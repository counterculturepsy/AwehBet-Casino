import { NextRequest, NextResponse } from 'next/server';
import { assertGameId, launchDemoGame, ProviderNotConfiguredError } from '../../../../lib/demo-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin) {
    const expected = new URL(request.url).origin;
    if (origin !== expected) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 2048) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  let gameId: string;
  try {
    const data: unknown = await request.json();
    if (!data || typeof data !== 'object' || !('gameId' in data)) throw new Error('Missing game ID');
    gameId = (data as { gameId: string }).gameId;
    assertGameId(gameId);
  } catch {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }
  try {
    const launch = await launchDemoGame(gameId);
    return NextResponse.json(launch, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ error: 'Provider integration pending' }, { status: 503 });
    }
    console.error('Demo launch unavailable', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to launch this demo' }, { status: 502 });
  }
}
