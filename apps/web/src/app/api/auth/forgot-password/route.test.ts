import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock('@/lib/env', () => ({ getPublicEnv: () => ({ NEXT_PUBLIC_SITE_URL: 'https://example.test' }) }));
vi.mock('@/lib/security/request', () => ({ assertSameOrigin: () => true, consumeRateLimit: async () => true }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { resetPasswordForEmail: mocks.reset } }) }));

import { POST } from './route';

function request() {
  return new NextRequest('https://example.test/api/auth/forgot-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'disposable@example.test' }),
  });
}

describe('password recovery delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not claim email was sent when the provider is rate limited', async () => {
    mocks.reset.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'private provider detail' } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toMatch(/Delivery may be delayed/);
    expect(body.message).not.toMatch(/has been sent/);
    expect(JSON.stringify(body)).not.toContain('private provider detail');
  });

  it('uses the same public response for failed delivery and successful requests, without exposing provider details', async () => {
    mocks.reset.mockResolvedValue({ error: { status: 500, message: 'recipient@example.test SMTP configuration' } });
    const response = await POST(request());
    const failureBody = await response.text();
    mocks.reset.mockResolvedValue({ error: null });
    const successResponse = await POST(request());
    expect(response.status).toBe(successResponse.status);
    expect(failureBody).toBe(await successResponse.text());
    expect(failureBody).not.toContain('recipient@example.test');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('recipient@example.test');
  });

  it('keeps a successful request neutral about account existence and uses the recovery callback', async () => {
    mocks.reset.mockResolvedValue({ error: null });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).message).toMatch(/If this address belongs to an account/);
    expect(mocks.reset).toHaveBeenCalledWith('disposable@example.test', { redirectTo: 'https://example.test/auth/callback?next=/reset-password' });
  });
});
