import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
// Reading history needs no origin check or rate limit; the mock only satisfies the shared helper import.
vi.mock('@/lib/security/request', () => ({ assertSameOrigin: () => true, consumeRateLimit: async () => true }));

import { GET } from './route';

const ID = '22222222-2222-4222-8222-222222222222';
const request = () => new NextRequest(`https://awehbet.example/api/admin/promotions/${ID}/history`);
const context = (id = ID) => ({ params: Promise.resolve({ id }) });
const events = [
  { id: 3, action: 'submitted', occurred_at: '2026-11-11T10:00:03.123456+00:00', previous_status: 'draft', new_status: 'submitted', campaign_version: 4, changed_fields: null, related_campaign_id: null, actor_id: 'a1', actor_kind: 'administrator', is_self: true },
  { id: 1, action: 'created', occurred_at: '2026-11-11T10:00:01+00:00', previous_status: null, new_status: 'draft', campaign_version: 1, changed_fields: null, related_campaign_id: null, actor_id: 'a1', actor_kind: 'administrator', is_self: true },
];

describe('GET /api/admin/promotions/[id]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'viewer-user' } }, error: null });
    mocks.rpc.mockResolvedValue({ data: events, error: null });
  });

  it('returns the campaign timeline from the authorised database function, uncached', async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ events });
    expect(mocks.rpc).toHaveBeenCalledWith('admin_promotion_history', { p_campaign_id: ID });
  });

  it('returns an empty list rather than null when there are no events', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await (await GET(request(), context())).json()).toEqual({ events: [] });
  });

  it('requires an authenticated user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request(), context())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('answers 404 for a malformed campaign id without touching the database', async () => {
    expect((await GET(request(), context('abc'))).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('answers 403 with no history when the database denies the caller', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private database detail' } });
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).not.toContain('private database detail');
    expect(text).not.toContain('events');
  });

  it('answers 404 for a campaign the database reports as unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'x' } });
    expect((await GET(request(), context())).status).toBe(404);
  });

  it('answers 503 for unexpected failures', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'x' } });
    expect((await GET(request(), context())).status).toBe(503);
  });
});
