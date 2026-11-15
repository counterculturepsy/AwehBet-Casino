import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock('@/lib/security/request', () => ({ assertSameOrigin: () => true, consumeRateLimit: async () => true }));

import { GET } from './route';
import { decodeCursor } from '@/lib/promotions/cursor';

const idFor = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number) => ({
  id: idFor(n), title: `Campaign ${n}`, description: 'Fixture', kind: 'banner', proposed_credits: 0, status: 'draft',
  starts_at: null, ends_at: null, created_by: 'creator', created_at: `2026-11-11T10:00:0${n}.12345${n}+00:00`,
  updated_at: `2026-11-11T11:00:0${n}.54321${n}+00:00`, version: 1, duplicated_from: null, allowed_actions: ['duplicate'],
});
const get = (query = '') => GET(new NextRequest(`https://awehbet.example/api/admin/promotions${query}`));
const lastArgs = () => mocks.rpc.mock.calls.at(-1)?.[1];

describe('GET /api/admin/promotions (search and pagination)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
    mocks.rpc.mockResolvedValue({ data: [row(3), row(2), row(1)], error: null });
  });

  it('uses safe defaults and asks the database for one extra row to detect a next page', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.rpc).toHaveBeenCalledWith('admin_search_promotions', {
      p_search: null, p_status: null, p_kind: null, p_created_by: null, p_created_from: null, p_created_to: null,
      p_updated_from: null, p_updated_to: null, p_sort: 'created_desc', p_limit: 26, p_cursor_ts: null, p_cursor_id: null,
    });
    const body = await response.json();
    expect(body.pageSize).toBe(25);
    expect(body.campaigns).toHaveLength(3);
    expect(body.nextCursor).toBeNull();
  });

  it('normalises filters and forwards them as bound parameters', async () => {
    await get('?search=%20Promo%20&status=approved&kind=demo-credit&createdFrom=2026-01-01T00:00:00Z&sort=updated_asc&limit=10');
    expect(lastArgs()).toMatchObject({
      p_search: 'Promo', p_status: 'approved', p_kind: 'demo-credit', p_created_from: '2026-01-01T00:00:00Z',
      p_sort: 'updated_asc', p_limit: 11,
    });
  });

  it('ignores cleared form fields instead of sending them to the database', async () => {
    await get('?search=&status=&kind=&sort=');
    expect(lastArgs()).toMatchObject({ p_search: null, p_status: null, p_kind: null, p_sort: 'created_desc' });
  });

  it('passes SQL-looking search text as inert data', async () => {
    const attack = "'; drop table promotion_campaigns; --";
    await get(`?search=${encodeURIComponent(attack)}`);
    expect(lastArgs().p_search).toBe(attack);
  });

  it('returns a next cursor for the last row of a full page, keeping microsecond precision', async () => {
    const response = await get('?limit=2');
    const body = await response.json();
    expect(body.campaigns.map((c: { id: string }) => c.id)).toEqual([idFor(3), idFor(2)]);
    expect(mocks.rpc).toHaveBeenCalledWith('admin_search_promotions', expect.objectContaining({ p_limit: 3 }));
    const cursor = decodeCursor(body.nextCursor, { sort: 'created_desc' });
    expect(cursor).toEqual({ timestamp: '2026-11-11T10:00:02.123452+00:00', id: idFor(2) });
  });

  it('builds the cursor from updated_at when sorting by update time', async () => {
    const body = await (await get('?limit=2&sort=updated_desc')).json();
    expect(decodeCursor(body.nextCursor, { sort: 'updated_desc' })).toEqual({ timestamp: '2026-11-11T11:00:02.543212+00:00', id: idFor(2) });
  });

  it('continues from a cursor by passing its exact position to the database', async () => {
    const first = await (await get('?limit=2')).json();
    mocks.rpc.mockResolvedValue({ data: [row(1)], error: null });
    const second = await (await get(`?limit=2&cursor=${first.nextCursor}`)).json();
    expect(lastArgs()).toMatchObject({ p_cursor_ts: '2026-11-11T10:00:02.123452+00:00', p_cursor_id: idFor(2) });
    expect(second.campaigns).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('returns an empty final page without a cursor', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const body = await (await get()).json();
    expect(body).toEqual({ campaigns: [], nextCursor: null, pageSize: 25 });
  });

  it('accepts the maximum page size and caps the extra row at 51', async () => {
    await get('?limit=50');
    expect(lastArgs().p_limit).toBe(51);
  });

  it.each([
    ['unknown status', '?status=published'],
    ['sort outside the allowlist', '?sort=title_asc'],
    ['page size above the maximum', '?limit=51'],
    ['page size of zero', '?limit=0'],
    ['non-numeric page size', '?limit=abc'],
    ['search over 80 characters', `?search=${'a'.repeat(81)}`],
    ['an offset parameter', '?offset=40'],
    ['a repeated parameter', '?status=draft&status=approved'],
    ['a reversed date range', '?createdFrom=2026-02-01T00:00:00Z&createdTo=2026-01-01T00:00:00Z'],
  ])('rejects %s before database access', async (_label, query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['garbage', '?cursor=!!!'],
    ['not a cursor', '?cursor=abc'],
    ['oversized', `?cursor=${'A'.repeat(401)}`],
  ])('rejects a malformed cursor (%s) as invalid_cursor', async (_label, query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_cursor');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects a cursor replayed with a different sort or filter', async () => {
    const { nextCursor } = await (await get('?limit=2&status=draft')).json();
    mocks.rpc.mockClear();
    expect((await get(`?limit=2&status=draft&sort=created_asc&cursor=${nextCursor}`)).status).toBe(400);
    expect((await get(`?limit=2&status=approved&cursor=${nextCursor}`)).status).toBe(400);
    expect((await get(`?limit=2&cursor=${nextCursor}`)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires an authenticated user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await get()).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns only what the database authorised, and 403 when it denies the caller', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private database detail' } });
    const response = await get();
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('private database detail');
  });

  it('answers 503 for an unexpected failure', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'x' } });
    expect((await get()).status).toBe(503);
  });
});
