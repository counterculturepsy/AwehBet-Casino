import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  consumeRateLimit: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/security/request', () => ({
  assertSameOrigin: mocks.assertSameOrigin,
  consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));

import { POST } from './route';

function request() {
  return new NextRequest('https://awehbet.example/api/admin/promotions/transition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://awehbet.example' },
    body: JSON.stringify({ id: '33333333-3333-4333-8333-333333333333', action: 'submit' }),
  });
}

describe('promotion transition API security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockReturnValue(true);
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('uses the shared origin guard and a per-user transition rate limit', async () => {
    const incoming = request();
    const response = await POST(incoming);
    expect(response.status).toBe(200);
    expect(mocks.assertSameOrigin).toHaveBeenCalledWith(incoming);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(incoming, 'admin-promotion-transition:admin-user', 30, 60);
    expect(mocks.rpc).toHaveBeenCalledWith('admin_transition_promotion', {
      p_campaign_id: '33333333-3333-4333-8333-333333333333',
      p_action: 'submit',
    });
  });

  it('rejects cross-origin requests before reading the session', async () => {
    mocks.assertSameOrigin.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('does not call the transition RPC after rate limiting', async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the campaign rate-limit service is unavailable', async () => {
    mocks.consumeRateLimit.mockRejectedValue(new Error('database unavailable'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
