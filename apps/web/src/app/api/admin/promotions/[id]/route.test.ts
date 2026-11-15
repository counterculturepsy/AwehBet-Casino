import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

import { GET, PATCH } from './route';

const ID = '22222222-2222-4222-8222-222222222222';
const body = {
  title: 'Edited banner',
  description: 'An updated free-to-play draft.',
  kind: 'banner',
  credits: 0,
  start: null,
  end: null,
  expectedVersion: 2,
};

function request(payload: unknown = body, headers: Record<string, string> = {}) {
  return new NextRequest(`https://awehbet.example/api/admin/promotions/${ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: 'https://awehbet.example', ...headers },
    body: JSON.stringify(payload),
  });
}
const context = (id = ID) => ({ params: Promise.resolve({ id }) });

describe('GET /api/admin/promotions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'viewer-user' } }, error: null });
    mocks.rpc.mockResolvedValue({ data: [{ id: ID, title: 'Exact campaign', version: 2, allowed_actions: [] }], error: null });
  });

  it('uses the authorized exact-id RPC and returns one campaign', async () => {
    const response = await GET(new NextRequest(`https://awehbet.example/api/admin/promotions/${ID}`), context());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('admin_get_promotion', { p_campaign_id: ID });
    expect((await response.json()).campaign.id).toBe(ID);
  });

  it('requires authentication and a valid campaign id', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(new NextRequest(`https://awehbet.example/api/admin/promotions/${ID}`), context())).status).toBe(401);
    expect((await GET(new NextRequest('https://awehbet.example/api/admin/promotions/bad'), context('bad'))).status).toBe(404);
  });

  it('maps a database authorization failure without leaking details', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private detail' } });
    const response = await GET(new NextRequest(`https://awehbet.example/api/admin/promotions/${ID}`), context());
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('private detail');
  });
});

describe('PATCH /api/admin/promotions/[id]', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.assertSameOrigin.mockReturnValue(true);
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
    mocks.rpc.mockResolvedValue({ data: 3, error: null });
  });
  afterEach(() => { errorSpy.mockRestore(); });

  it('edits a draft, sending the version it last read, and returns the new version', async () => {
    const response = await PATCH(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: ID, version: 3 });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(expect.any(NextRequest), 'admin-promotion-update:admin-user', 30, 60);
    expect(mocks.rpc).toHaveBeenCalledWith('admin_update_promotion', {
      p_campaign_id: ID, p_expected_version: 2, p_title: body.title, p_description: body.description,
      p_kind: 'banner', p_credits: 0, p_starts_at: null, p_ends_at: null,
    });
  });

  it('rejects a cross-origin request before any session or database access', async () => {
    mocks.assertSameOrigin.mockReturnValue(false);
    const response = await PATCH(request(), context());
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires a JSON body and bounds its size', async () => {
    expect((await PATCH(request(body, { 'Content-Type': 'text/plain' }), context())).status).toBe(415);
    expect((await PATCH(request(body, { 'Content-Length': '5000' }), context())).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing version', { ...body, expectedVersion: undefined }],
    ['a zero version', { ...body, expectedVersion: 0 }],
    ['a client-supplied status', { ...body, status: 'approved' }],
    ['a client-supplied creator', { ...body, created_by: 'someone-else' }],
    ['a client-supplied role', { ...body, role: 'owner' }],
    ['a banner with credits', { ...body, credits: 5 }],
    ['an end before the start', { ...body, start: '2030-02-01T00:00:00Z', end: '2030-01-01T00:00:00Z' }],
  ])('rejects %s before database access', async (_label, payload) => {
    const response = await PATCH(request(payload), context());
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('answers 404 for a malformed campaign id without touching the database', async () => {
    const response = await PATCH(request(), context("1' or '1'='1"));
    expect(response.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires an authenticated user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await PATCH(request(), context())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('answers 429 without calling the database when the rate limit is exceeded', async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    expect((await PATCH(request(), context())).status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the rate-limit service is unavailable', async () => {
    mocks.consumeRateLimit.mockRejectedValue(new Error('database unavailable'));
    expect((await PATCH(request(), context())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('reports a stale version as a 409 conflict the UI can recognise, without database detail', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PS409', message: 'private database detail' } });
    const response = await PATCH(request(), context());
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(JSON.parse(text).code).toBe('stale_version');
    expect(text).not.toContain('private database detail');
  });

  it.each([
    ['42501', 403, 'forbidden'],
    ['22023', 409, 'conflict'],
    ['P0002', 404, 'not_found'],
    ['23514', 400, 'invalid'],
  ])('maps database error %s to %i', async (code, status, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'private database detail' } });
    const response = await PATCH(request(), context());
    expect(response.status).toBe(status);
    const text = await response.text();
    expect(JSON.parse(text).code).toBe(reason);
    expect(text).not.toContain('private database detail');
  });

  it('logs an unexpected database failure with the SQLSTATE only', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: body.title } });
    expect((await PATCH(request(), context())).status).toBe(503);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(body.title);
    expect(errorSpy).toHaveBeenCalledWith('admin.promotions.rpc_failed', { operation: 'update', sqlstate: 'XX000' });
  });
});
