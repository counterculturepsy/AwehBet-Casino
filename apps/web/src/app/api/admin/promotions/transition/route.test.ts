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

const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333';

function request(body: unknown = { id: CAMPAIGN_ID, action: 'submit', expectedVersion: 4 }) {
  return new NextRequest('https://awehbet.example/api/admin/promotions/transition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://awehbet.example' },
    body: JSON.stringify(body),
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
      p_campaign_id: CAMPAIGN_ID,
      p_action: 'submit',
      p_expected_version: 4,
    });
  });

  describe('expected version on submit', () => {
    it('forwards the current version and succeeds', async () => {
      const response = await POST(request({ id: CAMPAIGN_ID, action: 'submit', expectedVersion: 1 }));
      expect(response.status).toBe(200);
      expect(mocks.rpc).toHaveBeenCalledWith('admin_transition_promotion', {
        p_campaign_id: CAMPAIGN_ID, p_action: 'submit', p_expected_version: 1,
      });
    });

    it('rejects a submit with no expected version before touching the session or database', async () => {
      const response = await POST(request({ id: CAMPAIGN_ID, action: 'submit' }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'invalid' });
      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it.each([
      ['zero', 0], ['negative', -1], ['fractional', 1.5], ['numeric string', '4'], ['null', null],
      ['boolean', true], ['above int4', 2_147_483_648],
    ])('rejects an invalid expected version (%s)', async (_label, expectedVersion) => {
      const response = await POST(request({ id: CAMPAIGN_ID, action: 'submit', expectedVersion }));
      expect(response.status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('answers 409 stale_version when the database reports a version conflict', async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PS409' } });
      const response = await POST(request());
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'stale_version' });
    });

    it('still answers 403 for an unauthorized submit, never a version conflict', async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
      const response = await POST(request());
      expect(response.status).toBe(403);
    });

    it('answers 409 conflict when the campaign is no longer a draft', async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023' } });
      const response = await POST(request());
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'conflict' });
    });
  });

  describe('approve and reject', () => {
    it.each(['approve', 'reject'])('%s works without a version and sends none to the database', async action => {
      const response = await POST(request({ id: CAMPAIGN_ID, action }));
      expect(response.status).toBe(200);
      expect(mocks.rpc).toHaveBeenCalledWith('admin_transition_promotion', { p_campaign_id: CAMPAIGN_ID, p_action: action });
    });

    it.each(['approve', 'reject'])('%s rejects an unexpected version field', async action => {
      const response = await POST(request({ id: CAMPAIGN_ID, action, expectedVersion: 2 }));
      expect(response.status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('rejects an unknown action', async () => {
      const response = await POST(request({ id: CAMPAIGN_ID, action: 'publish' }));
      expect(response.status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
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
