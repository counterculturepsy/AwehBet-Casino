import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getCapitecDirectDepositConfig } from '@/lib/payments/capitec-direct-deposit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function localContentType(source: string) {
  const extension = extname(source).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function loadImage(source: string, allowedHost: string | null) {
  if (/^https:\/\//i.test(source)) {
    const sourceUrl = new URL(source);
    if (!allowedHost || sourceUrl.hostname.toLowerCase() !== allowedHost) throw new Error('Payment asset host is not approved.');
    const response = await fetch(source, { cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('Payment asset could not be loaded.');
    const contentType = response.headers.get('content-type')?.split(';')[0] || '';
    if (!allowedTypes.has(contentType)) throw new Error('Payment asset has an unsupported type.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, contentType };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Local payment assets are disabled in production.');
  const bytes = new Uint8Array(await readFile(source));
  return { bytes, contentType: localContentType(source) };
}

export async function GET() {
  let user: User | null;
  try {
    const auth = await createServerSupabaseClient();
    ({ data: { user } } = await auth.auth.getUser());
  } catch {
    return NextResponse.json({ error: 'Account service is unavailable.' }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const config = getCapitecDirectDepositConfig();
  if (!config.enabled || !config.source) return NextResponse.json({ error: 'Direct deposit is unavailable.' }, { status: 404 });

  try {
    const { bytes, contentType } = await loadImage(config.source, config.allowedHost);
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Payment asset is too large.');
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (process.env.NODE_ENV === 'production' && !config.expectedSha256) throw new Error('Payment asset integrity is not configured.');
    if (config.expectedSha256 && digest !== config.expectedSha256) throw new Error('Payment asset integrity check failed.');
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'",
      },
    });
  } catch {
    return NextResponse.json({ error: 'Direct deposit asset is unavailable.' }, { status: 503 });
  }
}
