import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicEnv } from '@/lib/env';
import { assertSameOrigin, consumeRateLimit } from '@/lib/security/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const schema = z.object({ email: z.email().max(254).transform((value) => value.trim().toLowerCase()) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, 'forgot-password', 5, 3600)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Password recovery is temporarily unavailable.' }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const env = getPublicEnv();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password` });
  return NextResponse.json({ message: 'If the account exists, a recovery email has been sent.' });
}
