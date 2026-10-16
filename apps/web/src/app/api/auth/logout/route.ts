import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/security/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { allSessions?: boolean };
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: body.allSessions ? 'global' : 'local' });
  return NextResponse.json({ message: 'Signed out.' });
}
