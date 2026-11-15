import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ assertSameOrigin: vi.fn(), consumeRateLimit: vi.fn() }));
vi.mock('@/lib/security/request', () => ({
  assertSameOrigin: mocks.assertSameOrigin,
  consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({}) }));

import { enforceRateLimit, mapRpcError, readGuardedJson } from './api';

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://awehbet.example/api/admin/promotions/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://awehbet.example', ...headers },
    body,
  });
}

describe('mapRpcError', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { errorSpy.mockRestore(); });

  it.each([
    ['42501', 403, 'forbidden'],
    ['P0002', 404, 'not_found'],
    ['PS409', 409, 'stale_version'],
    ['22023', 409, 'conflict'],
    ['23514', 400, 'invalid'],
    ['23502', 400, 'invalid'],
    ['22001', 400, 'invalid'],
    ['XX000', 503, 'unavailable'],
    [undefined, 503, 'unavailable'],
  ])('maps SQLSTATE %s to HTTP %i (%s) without leaking the database message', async (code, status, reason) => {
    const response = mapRpcError({ code, message: 'relation "private.admin_members" does not exist' } as { code?: string }, 'test');
    expect(response.status).toBe(status);
    const text = await response.text();
    expect(JSON.parse(text).code).toBe(reason);
    expect(text).not.toContain('admin_members');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('logs unexpected failures with the operation and SQLSTATE only', () => {
    mapRpcError({ code: 'XX000', message: 'secret detail', details: 'row data' } as { code?: string }, 'update');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('admin.promotions.rpc_failed', { operation: 'update', sqlstate: 'XX000' });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('secret detail');
  });

  it('does not log expected, handled outcomes', () => {
    for (const code of ['42501', 'P0002', 'PS409', '22023', '23514']) mapRpcError({ code }, 'update');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('readGuardedJson', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.assertSameOrigin.mockReturnValue(true); });

  it('returns the parsed body for a same-origin JSON request', async () => {
    expect(await readGuardedJson(post('{"a":1}'))).toEqual({ ok: true, body: { a: 1 } });
  });

  it('rejects a cross-origin request with 403', async () => {
    mocks.assertSameOrigin.mockReturnValue(false);
    const result = await readGuardedJson(post('{}'));
    expect(result.ok === false && result.response.status).toBe(403);
  });

  it('rejects non-JSON content with 415', async () => {
    const result = await readGuardedJson(post('a=b', { 'Content-Type': 'text/plain' }));
    expect(result.ok === false && result.response.status).toBe(415);
  });

  it('rejects an oversized declared length and an oversized actual body with 413', async () => {
    const declared = await readGuardedJson(post('{}', { 'Content-Length': '5000' }));
    expect(declared.ok === false && declared.response.status).toBe(413);
    const actual = await readGuardedJson(post(JSON.stringify({ pad: 'x'.repeat(5000) })));
    expect(actual.ok === false && actual.response.status).toBe(413);
  });

  it('measures the actual body in UTF-8 bytes when Content-Length is absent', async () => {
    const result = await readGuardedJson(post(JSON.stringify({ pad: 'é'.repeat(2_100) })));
    expect(result.ok === false && result.response.status).toBe(413);
  });

  it('rejects malformed JSON with 400', async () => {
    const result = await readGuardedJson(post('{broken'));
    expect(result.ok === false && result.response.status).toBe(400);
  });
});

describe('enforceRateLimit', () => {
  const request = post('{}');
  beforeEach(() => vi.clearAllMocks());

  it('allows requests within the limit', async () => {
    mocks.consumeRateLimit.mockResolvedValue(true);
    expect(await enforceRateLimit(request, 'action:user', 5, 60)).toBeNull();
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(request, 'action:user', 5, 60);
  });

  it('answers 429 once the limit is exceeded', async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    expect((await enforceRateLimit(request, 'action:user', 5, 60))?.status).toBe(429);
  });

  it('fails closed with 503 when the limiter is unavailable', async () => {
    mocks.consumeRateLimit.mockRejectedValue(new Error('database unavailable'));
    expect((await enforceRateLimit(request, 'action:user', 5, 60))?.status).toBe(503);
  });
});
