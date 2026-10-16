import { NextResponse } from 'next/server';
import { findDemoGame } from '../../../../lib/games/catalogue';
import { getDemoProvider } from '../../../../server/providers/registry';
import { ProviderUnavailableError } from '../../../../server/providers/contracts';
import { validateDemoLaunch } from '../../../../server/providers/validate-launch';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Demo launch requests cannot authorize real-money play.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
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
  const { gameId } = body as Record<string, unknown>;
  if (typeof gameId !== 'string' || !findDemoGame(gameId)) {
    return NextResponse.json({ error: 'Unknown game' }, { status: 400 });
  }
  try {
    const result = await getDemoProvider().launchDemo({
      gameId,
      sessionId: crypto.randomUUID(),
      locale: 'en-ZA',
      returnUrl: new URL('/demo', request.url).toString(),
    });
    const approvedHosts = (process.env.DEMO_PROVIDER_LAUNCH_HOSTS ?? '')
      .split(',')
      .map(host => host.trim())
      .filter(Boolean);
    const safeResult = validateDemoLaunch(result, approvedHosts);
    return NextResponse.json(safeResult, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return NextResponse.json({ error: 'Demo provider connection pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unable to launch demo' }, { status: 502 });
  }
}
