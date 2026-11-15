import { describe, expect, it } from 'vitest';
import {
  campaignIdSchema, createCampaignSchema, duplicateCampaignSchema, parseSearchParams, updateCampaignSchema,
} from './schemas';

const fields = {
  title: 'Demo banner',
  description: 'A free-to-play campaign draft.',
  kind: 'banner' as const,
  credits: 0,
  start: null,
  end: null,
};
const KEY = '11111111-1111-4111-8111-111111111111';

describe('campaign schemas', () => {
  it('trims text and accepts a valid update that names the version it read', () => {
    const parsed = updateCampaignSchema.safeParse({ ...fields, title: '  Spaced  ', expectedVersion: 3 });
    expect(parsed.success && parsed.data.title).toBe('Spaced');
  });

  it.each([
    ['missing version', undefined],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['string', '2'],
    ['above int range', 2_147_483_648],
  ])('rejects an update with %s as the expected version', (_label, expectedVersion) => {
    expect(updateCampaignSchema.safeParse({ ...fields, expectedVersion }).success).toBe(false);
  });

  it.each(['status', 'created_by', 'createdBy', 'role', 'reviewed_by', 'version', 'id'])(
    'rejects client-supplied %s because only content fields are editable',
    key => {
      expect(updateCampaignSchema.safeParse({ ...fields, expectedVersion: 1, [key]: 'owner' }).success).toBe(false);
      expect(createCampaignSchema.safeParse({ ...fields, idempotencyKey: KEY, [key]: 'owner' }).success).toBe(false);
    },
  );

  it('enforces the credit rules for both kinds', () => {
    expect(updateCampaignSchema.safeParse({ ...fields, credits: 5, expectedVersion: 1 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ ...fields, kind: 'demo-credit', credits: 0, expectedVersion: 1 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ ...fields, kind: 'demo-credit', credits: 100001, expectedVersion: 1 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ ...fields, kind: 'demo-credit', credits: 500, expectedVersion: 1 }).success).toBe(true);
  });

  it('rejects an end before the start, and dates without an offset', () => {
    expect(updateCampaignSchema.safeParse({ ...fields, start: '2030-02-01T00:00:00Z', end: '2030-01-01T00:00:00Z', expectedVersion: 1 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ ...fields, start: '2030-01-01T00:00:00', expectedVersion: 1 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ ...fields, start: 'tomorrow', expectedVersion: 1 }).success).toBe(false);
  });

  it('enforces text length limits', () => {
    expect(updateCampaignSchema.safeParse({ ...fields, title: 'x'.repeat(101), expectedVersion: 1 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ ...fields, title: '   ', expectedVersion: 1 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ ...fields, description: 'x'.repeat(301), expectedVersion: 1 }).success).toBe(false);
  });

  it('requires a UUID idempotency key to create or duplicate', () => {
    expect(createCampaignSchema.safeParse({ ...fields }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...fields, idempotencyKey: 'not-a-uuid' }).success).toBe(false);
    expect(duplicateCampaignSchema.safeParse({}).success).toBe(false);
    expect(duplicateCampaignSchema.safeParse({ idempotencyKey: KEY }).success).toBe(true);
    expect(duplicateCampaignSchema.safeParse({ idempotencyKey: KEY, title: 'x' }).success).toBe(false);
  });

  it('validates campaign ids as UUIDs', () => {
    expect(campaignIdSchema.safeParse(KEY).success).toBe(true);
    expect(campaignIdSchema.safeParse("1' or '1'='1").success).toBe(false);
  });
});

describe('parseSearchParams', () => {
  const parse = (query: string) => parseSearchParams(new URLSearchParams(query));

  it('applies safe defaults', () => {
    expect(parse('')).toEqual({ ok: true, value: { sort: 'created_desc', limit: 25 } });
  });

  it('normalises valid filters, trimming search text', () => {
    const parsed = parse(`search=%20Promo%20&status=draft&kind=demo-credit&createdBy=${KEY}&sort=updated_asc&limit=10`);
    expect(parsed).toEqual({
      ok: true,
      value: { search: 'Promo', status: 'draft', kind: 'demo-credit', createdBy: KEY, sort: 'updated_asc', limit: 10 },
    });
  });

  it('treats empty and whitespace-only values as absent', () => {
    expect(parse('search=&status=&kind=%20&sort=&limit=&cursor=')).toEqual({ ok: true, value: { sort: 'created_desc', limit: 25 } });
  });

  it('accepts date ranges and rejects reversed or malformed ones', () => {
    expect(parse('createdFrom=2026-01-01T00:00:00Z&createdTo=2026-02-01T00:00:00Z').ok).toBe(true);
    expect(parse('createdFrom=2026-02-01T00:00:00Z&createdTo=2026-01-01T00:00:00Z').ok).toBe(false);
    expect(parse('updatedFrom=2026-02-01T00:00:00Z&updatedTo=2026-02-01T00:00:00Z').ok).toBe(false);
    expect(parse('updatedFrom=yesterday').ok).toBe(false);
  });

  it.each([
    ['unknown status', 'status=published'],
    ['unknown kind', 'kind=cash'],
    ['sort outside the allowlist', 'sort=title_asc'],
    ['SQL in sort', 'sort=created_desc;drop%20table%20x'],
    ['limit above the maximum', 'limit=51'],
    ['limit of zero', 'limit=0'],
    ['negative limit', 'limit=-5'],
    ['fractional limit', 'limit=2.5'],
    ['non-numeric limit', 'limit=abc'],
    ['search over 80 characters', `search=${'a'.repeat(81)}`],
    ['malformed creator id', 'createdBy=admin'],
    ['unknown parameter', 'offset=40'],
    ['repeated parameter', 'status=draft&status=approved'],
  ])('rejects %s', (_label, query) => {
    expect(parse(query).ok).toBe(false);
  });

  it('allows the maximum page size and an 80 character search', () => {
    expect(parse('limit=50').ok).toBe(true);
    expect(parse(`search=${'a'.repeat(80)}`).ok).toBe(true);
  });

  it('passes SQL-looking search text through as plain data', () => {
    const parsed = parse(`search=${encodeURIComponent("'; drop table promotion_campaigns; --")}`);
    expect(parsed).toEqual({ ok: true, value: { search: "'; drop table promotion_campaigns; --", sort: 'created_desc', limit: 25 } });
  });
});
