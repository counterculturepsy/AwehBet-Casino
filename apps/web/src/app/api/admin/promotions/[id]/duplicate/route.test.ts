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

const SOURCE = '22222222-2222-4222-8222-222222222222';
const COPY = '33333333-3333-4333-8333-333333333333';
const KEY = '11111111-1111-4111-8111-111111111111';

function request(payload: unknown = { idempotencyKey: KEY }, headers: Record<string, string> = {}) {
  return new NextRequest(`https://awehbet.example/api/admin/promotions/${SOURCE}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://awehbet.example', ...headers },
    body: JSON.stringify(payload),
  });
}
const context = (id = SOURCE) => ({ params: Promise.resolve({ id }) });

describe('POST /api/admin/promotions/[id]/duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.assertSameOrigin.mockReturnValue(true);
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
    mocks.rpc.mockResolvedValue({ data: COPY, error: null });
  });

  it('duplicates a campaign into a new draft using the caller idempotency key', async () => {
    const response = await POST(request(), context());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: COPY, status: 'draft', duplicatedFrom: SOURCE });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(expect.any(NextRequest), 'admin-promotion-duplicate:admin-user', 10, 60);
    expect(mocks.rpc).toHaveBeenCalledWith('admin_duplicate_promotion', { p_campaign_id: SOURCE, p_idempotency_key: KEY });
  });

  it('returns the same copy when the identical request is retried', async () => {
    const first = await (await POST(request(), context())).json();
    const retry = await (await POST(request(), context())).json();
    expect(retry).toEqual(first);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[0]);
  });

  it('answers 409 when the key was already used for a different request', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'private database detail' } });
    const response = await POST(request(), context());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain('private database detail');
  });

  it.each([
    ['a missing key', {}],
    ['a malformed key', { idempotencyKey: 'abc' }],
    ['extra fields that try to set content or ownership', { idempotencyKey: KEY, title: 'Hijack', created_by: 'x', status: 'approved' }],
  ])('rejects %s before database access', async (_label, payload) => {
    expect((await POST(request(payload), context())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects cross-origin requests before any session or database access', async () => {
    mocks.assertSameOrigin.mockReturnValue(false);
    expect((await POST(request(), context())).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires an authenticated user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request(), context())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('answers 404 for a malformed source id without touching the database', async () => {
    expect((await POST(request(), context('not-a-uuid'))).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('applies a conservative per-user limit and fails closed when the limiter is down', async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    expect((await POST(request(), context())).status).toBe(429);
    mocks.consumeRateLimit.mockRejectedValue(new Error('database unavailable'));
    expect((await POST(request(), context())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['42501', 403],
    ['P0002', 404],
    ['XX000', 503],
  ])('maps database error %s to %i', async (code, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'private database detail' } });
    const response = await POST(request(), context());
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('private database detail');
  });
});
