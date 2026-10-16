import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validation/player';

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, 'login', 10, 900)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Sign in is temporarily unavailable.' }, { status: 503 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address and password.' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return NextResponse.json({ error: 'Email address or password is incorrect.' }, { status: 401 });
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: 'Verify your email address before signing in.' }, { status: 403 });
  }
  return NextResponse.json({ message: 'Signed in.' });
}
