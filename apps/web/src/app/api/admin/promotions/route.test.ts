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

const body = {
  title: 'Demo banner',
  description: 'A free-to-play campaign draft.',
  kind: 'banner',
  credits: 0,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  start: null,
  end: null,
};

function request(payload: unknown = body) {
  return new NextRequest('https://awehbet.example/api/admin/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://awehbet.example' },
    body: JSON.stringify(payload),
  });
}

describe('promotion draft API security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockReturnValue(true);
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
    mocks.rpc.mockResolvedValue({ data: '22222222-2222-4222-8222-222222222222', error: null });
  });

  it('passes a validated idempotency key to the database RPC', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(expect.any(NextRequest), 'admin-promotion-create:admin-user', 10, 60);
    expect(mocks.rpc).toHaveBeenCalledWith('admin_create_promotion', expect.objectContaining({
      p_idempotency_key: body.idempotencyKey,
      p_title: body.title,
    }));
  });

  it('rejects a missing or malformed idempotency key before database access', async () => {
    const { idempotencyKey: _removed, ...invalid } = body;
    const response = await POST(request(invalid));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the campaign rate-limit service is unavailable', async () => {
    mocks.consumeRateLimit.mockRejectedValue(new Error('database unavailable'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Campaign security service unavailable' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns 429 without calling the campaign RPC when the rate limit is exceeded', async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('maps conflicting idempotency-key reuse to a neutral conflict response', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'private database detail' } });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain('private database detail');
  });
});
