import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), service: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signUp: mocks.signUp } }) }));
vi.mock('@/lib/env', () => ({ getPublicEnv: () => ({ NEXT_PUBLIC_SITE_URL: 'https://example.test', NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key' }) }));
vi.mock('@/lib/security/request', () => ({ assertSameOrigin: () => true, consumeRateLimit: async () => true }));
vi.mock('@/lib/security/identity', () => ({ encryptIdentity: () => 'encrypted-test-data', identityFingerprint: () => 'test-fingerprint' }));
vi.mock('@/lib/supabase/server', () => ({ createServiceSupabaseClient: mocks.service }));
vi.mock('@/lib/validation/player', async () => import('../../../../lib/validation/player'));

import { POST } from './route';

function request() {
  return new NextRequest('https://example.test/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Disposable', lastName: 'QA Test', birthDate: '1990-01-01',
      documentType: 'passport', documentNumber: 'QATEST12345', issuingCountry: 'ZA',
      countryOfResidence: 'ZA', mobilePhone: '0600000000', email: 'disposable@example.test',
      password: 'Test-Only!Password123', confirmPassword: 'Test-Only!Password123',
      acceptedTerms: true, acknowledgedPrivacy: true, marketingConsent: false,
    }),
  });
}

describe('registration provider failures', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports provider email throttling as retryable rather than an account conflict', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: { status: 429, code: 'over_email_send_rate_limit', message: 'private provider detail' } });
    const response = await POST(request());
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toMatch(/email service/);
    expect(JSON.stringify(body)).not.toContain('private provider detail');
    expect(mocks.service).not.toHaveBeenCalled();
  });

  it('keeps an obfuscated duplicate response neutral and does not write a profile', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: 'opaque-id', identities: [] } }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error).not.toMatch(/already registered|account exists/i);
    expect(mocks.service).not.toHaveBeenCalled();
  });

  it('does not expose delivery-provider messages or mislabel their failure as a duplicate', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: { status: 500, message: 'SMTP secret recipient@example.test' } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('SMTP secret');
    expect(mocks.service).not.toHaveBeenCalled();
  });
});
