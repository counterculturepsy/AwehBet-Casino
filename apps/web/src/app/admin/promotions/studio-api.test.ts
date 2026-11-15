import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDraft, duplicateCampaign, fetchCampaignById, fetchCampaignPage, fetchHistory, transitionCampaign, updateDraft,
} from './studio-api';

const fetchMock = vi.fn();
const ID = '22222222-2222-4222-8222-222222222222';
const KEY = '11111111-1111-4111-8111-111111111111';
const payload = { title: 'T', description: 'D', kind: 'banner' as const, credits: 0, start: null, end: null };

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('request construction', () => {
  it('reads a page of campaigns uncached, with or without a query', async () => {
    fetchMock.mockResolvedValue(reply(200, { campaigns: [], nextCursor: null, pageSize: 25 }));
    await fetchCampaignPage('');
    expect(lastCall()[0]).toBe('/api/admin/promotions');
    await fetchCampaignPage('status=draft&cursor=abc');
    expect(lastCall()[0]).toBe('/api/admin/promotions?status=draft&cursor=abc');
    expect(lastCall()[1]).toMatchObject({ cache: 'no-store' });
  });

  it('PATCHes an edit with the version it read and JSON content type', async () => {
    fetchMock.mockResolvedValue(reply(200, { id: ID, version: 4 }));
    const result = await updateDraft(ID, payload, 3);
    const [url, init] = lastCall();
    expect(url).toBe(`/api/admin/promotions/${ID}`);
    expect(init.method).toBe('PATCH');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ ...payload, expectedVersion: 3 });
    expect(result).toEqual({ ok: true, data: { id: ID, version: 4 } });
  });

  it('POSTs a duplicate request carrying only the idempotency key', async () => {
    fetchMock.mockResolvedValue(reply(201, { id: 'copy', status: 'draft', duplicatedFrom: ID }));
    await duplicateCampaign(ID, KEY);
    const [url, init] = lastCall();
    expect(url).toBe(`/api/admin/promotions/${ID}/duplicate`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ idempotencyKey: KEY });
  });

  it('creates drafts and transitions through the existing endpoints', async () => {
    fetchMock.mockResolvedValue(reply(201, { id: ID, status: 'draft' }));
    await createDraft({ ...payload, idempotencyKey: KEY });
    expect(lastCall()[0]).toBe('/api/admin/promotions');
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ ...payload, idempotencyKey: KEY });
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    await transitionCampaign(ID, 'approve');
    expect(lastCall()[0]).toBe('/api/admin/promotions/transition');
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ id: ID, action: 'approve' });
  });

  it('reads campaign history', async () => {
    fetchMock.mockResolvedValue(reply(200, { events: [] }));
    expect(await fetchHistory(ID)).toEqual({ ok: true, data: { events: [] } });
    expect(lastCall()[0]).toBe(`/api/admin/promotions/${ID}/history`);
  });
});

describe('failure handling', () => {
  it('surfaces the server stale-version code so the UI can offer a reload', async () => {
    fetchMock.mockResolvedValue(reply(409, { error: 'x', code: 'stale_version' }));
    expect(await updateDraft(ID, payload, 1)).toEqual({ ok: false, status: 409, code: 'stale_version' });
  });

  it.each([
    [400, 'invalid'], [401, 'forbidden'], [403, 'forbidden'], [404, 'not_found'], [409, 'conflict'], [429, 'rate_limited'],
    [500, 'unavailable'], [503, 'unavailable'],
  ])('derives a reason from HTTP %i when the body carries no code', async (status, code) => {
    fetchMock.mockResolvedValue(reply(status, { error: 'plain' }));
    expect(await fetchHistory(ID)).toEqual({ ok: false, status, code });
  });

  it('does not trust a code the client does not know', async () => {
    fetchMock.mockResolvedValue(reply(409, { code: '<script>alert(1)</script>' }));
    expect(await fetchHistory(ID)).toMatchObject({ ok: false, code: 'conflict' });
  });

  it('copes with a non-JSON error body', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError('bad'); } });
    expect(await fetchHistory(ID)).toEqual({ ok: false, status: 502, code: 'unavailable' });
  });

  it('reports a network failure distinctly', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchHistory(ID)).toEqual({ ok: false, status: 0, code: 'network' });
  });
});

describe('malformed success responses', () => {
  it.each([
    ['a campaign page without a list', () => fetchCampaignPage(''), { nextCursor: null }],
    ['a campaign row missing its actions', () => fetchCampaignPage(''), { campaigns: [{ id: 'a', title: 'T', version: 1 }], nextCursor: null }],
    ['a campaign page with a numeric cursor', () => fetchCampaignPage(''), { campaigns: [], nextCursor: 5 }],
    ['history without events', () => fetchHistory(ID), { items: [] }],
    ['a malformed history event', () => fetchHistory(ID), { events: [{ id: 'x' }] }],
    ['an edit response without a version', () => updateDraft(ID, payload, 1), { id: ID }],
    ['a duplicate response without an id', () => duplicateCampaign(ID, KEY), {}],
    ['a create response without an id', () => createDraft({ ...payload, idempotencyKey: KEY }), { status: 'draft' }],
    ['a null body', () => fetchCampaignPage(''), null],
  ])('treats %s as a failure instead of letting it crash the page', async (_label, run, body) => {
    fetchMock.mockResolvedValue(reply(200, body));
    expect(await run()).toMatchObject({ ok: false, code: 'unavailable' });
  });

  it('still accepts a well-formed empty page', async () => {
    fetchMock.mockResolvedValue(reply(200, { campaigns: [], nextCursor: null, pageSize: 25 }));
    expect(await fetchCampaignPage('')).toMatchObject({ ok: true });
  });
});

describe('fetchCampaignById', () => {
  const row = (id: string) => ({ id, title: id, version: 1, allowed_actions: [] as string[] });

  it('uses the dedicated exact-id endpoint', async () => {
    fetchMock.mockResolvedValue(reply(200, { campaign: row(ID) }));
    const result = await fetchCampaignById(ID);
    expect(lastCall()[0]).toBe(`/api/admin/promotions/${ID}`);
    expect(result).toEqual({ ok: true, data: row(ID) });
  });

  it('treats a malformed successful response as unavailable', async () => {
    fetchMock.mockResolvedValue(reply(200, { campaign: null }));
    expect(await fetchCampaignById(ID)).toEqual({ ok: false, status: 200, code: 'unavailable' });
  });

  it('passes failures through', async () => {
    fetchMock.mockResolvedValue(reply(403, { error: 'Forbidden', code: 'forbidden' }));
    expect(await fetchCampaignById(ID)).toEqual({ ok: false, status: 403, code: 'forbidden' });
  });
});
