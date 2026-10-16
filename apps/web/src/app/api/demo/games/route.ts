import { NextResponse } from 'next/server';
import { listDemoGames, ProviderNotConfiguredError } from '../../../../lib/demo-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const games = await listDemoGames();
    return NextResponse.json({ status: 'ready', games }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ status: 'pending', games: [], message: 'Provider access is pending.' },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('Demo catalogue unavailable', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Demo catalogue temporarily unavailable' }, { status: 502 });
  }
}
