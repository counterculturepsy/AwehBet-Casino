import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, filterSignature } from './cursor';
import type { SearchFilters } from './schemas';

const filters: SearchFilters = { sort: 'created_desc', status: 'draft', search: 'Promo' };
const position = { timestamp: '2026-11-11T10:00:03.123453+00:00', id: '00000000-0000-4000-8000-000000000003' };
const b64 = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const payload = (patch: Record<string, unknown> = {}) => ({
  v: 1, s: 'created_desc', f: filterSignature(filters), t: position.timestamp, i: position.id, ...patch,
});

describe('promotion cursor', () => {
  it('round-trips the exact position, keeping microsecond precision', () => {
    const decoded = decodeCursor(encodeCursor(filters, position), filters);
    expect(decoded).toEqual(position);
    expect(decoded?.timestamp).toBe('2026-11-11T10:00:03.123453+00:00');
  });

  it('is opaque: filter values are not readable from the token', () => {
    const decoded = Buffer.from(encodeCursor(filters, position), 'base64url').toString('utf8');
    expect(decoded).not.toContain('Promo');
    expect(decoded).not.toContain('draft');
  });

  it('rejects a cursor issued for a different sort order', () => {
    const token = encodeCursor(filters, position);
    expect(decodeCursor(token, { ...filters, sort: 'updated_asc' })).toBeNull();
  });

  it.each([
    ['status', { status: 'approved' as const }],
    ['search text', { search: 'Other' }],
    ['kind', { kind: 'banner' as const }],
    ['creator', { createdBy: '11111111-1111-4111-8111-111111111111' }],
    ['created range', { createdFrom: '2026-01-01T00:00:00Z' }],
  ])('rejects a cursor replayed after the %s filter changed', (_label, patch) => {
    expect(decodeCursor(encodeCursor(filters, position), { ...filters, ...patch })).toBeNull();
  });

  it('treats search case-insensitively, matching the database', () => {
    expect(filterSignature({ ...filters, search: 'PROMO' })).toBe(filterSignature({ ...filters, search: 'promo' }));
  });

  it.each([
    ['empty string', ''],
    ['non-base64url characters', 'not base64!'],
    ['padding characters', `${encodeCursor(filters, position)}==`],
    ['valid base64 of invalid JSON', b64('{not json')],
    ['JSON null', b64('null')],
    ['empty object', b64({})],
    ['unsupported version', b64(payload({ v: 2 }))],
    ['unknown sort', b64(payload({ s: 'title_asc' }))],
    ['malformed signature', b64(payload({ f: 'zzzz' }))],
    ['malformed timestamp', b64(payload({ t: 'yesterday' }))],
    ['impossible timestamp', b64(payload({ t: '2026-99-99T25:61:61Z' }))],
    ['impossible calendar day', b64(payload({ t: '2026-02-31T10:00:00Z' }))],
    ['impossible timezone offset', b64(payload({ t: '2026-11-11T10:00:00+25:00' }))],
    ['SQL in timestamp', b64(payload({ t: "2026-11-11'; drop table x; --" }))],
    ['malformed id', b64(payload({ i: 'abc' }))],
    ['extra property', b64(payload({ offset: 40 }))],
    ['oversized token', 'A'.repeat(401)],
  ])('rejects a malformed cursor: %s', (_label, token) => {
    expect(decodeCursor(token, filters)).toBeNull();
  });
});
