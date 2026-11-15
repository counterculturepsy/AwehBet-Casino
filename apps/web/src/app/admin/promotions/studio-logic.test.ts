import { describe, expect, it } from 'vitest';
import type { CampaignRow, HistoryEvent } from '@/lib/promotions/types';
import {
  DEFAULT_FILTERS, NEW_DRAFT, actorLabel, describeEvent, draftFromCampaign, draftToPayload, failureMessage, filterIssues,
  filtersFromSearchParams, filtersToApiQuery, filtersToUrlQuery, formatDateTime, fromLocalInput, hasActiveFilters,
  statusClass, toLocalInput, validateDraft, visibleActions, type Filters,
} from './studio-logic';

const campaign: CampaignRow = {
  id: '22222222-2222-4222-8222-222222222222', title: 'Spring banner', description: 'A free-to-play banner.', kind: 'banner',
  proposed_credits: 0, status: 'draft', starts_at: '2030-06-15T10:30:45.123456+00:00', ends_at: null,
  created_by: '11111111-1111-4111-8111-111111111111', created_at: '2030-06-01T08:00:00.000001+00:00',
  updated_at: '2030-06-02T08:00:00.000002+00:00', version: 3, duplicated_from: null, allowed_actions: ['edit', 'submit', 'duplicate'],
};
const event = (patch: Partial<HistoryEvent>): HistoryEvent => ({
  id: 1, action: 'created', occurred_at: '2030-06-01T08:00:00+00:00', previous_status: null, new_status: 'draft',
  campaign_version: 1, changed_fields: null, related_campaign_id: null, actor_id: 'aaaaaaaa-0000-4000-8000-000000000001',
  actor_kind: 'administrator', is_self: false, ...patch,
});
const dayStart = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();

describe('schedule inputs', () => {
  it('converts to and from datetime-local values without drifting', () => {
    const local = toLocalInput('2030-06-15T10:30:00.000Z');
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromLocalInput(local)).toBe('2030-06-15T10:30:00.000Z');
  });

  it('treats empty and invalid values as no date', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('not a date')).toBe('');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('nonsense')).toBeNull();
  });
});

describe('draft helpers', () => {
  it('builds an editable draft from a campaign, never marking it ready-for-review', () => {
    const draft = draftFromCampaign(campaign);
    expect(draft).toMatchObject({ title: 'Spring banner', kind: 'banner', credits: 0, end: '', enabled: false });
    expect(draft.start).toBe(toLocalInput(campaign.starts_at));
  });

  it('accepts the default draft and reports each broken rule', () => {
    expect(validateDraft(NEW_DRAFT)).toEqual([]);
    expect(validateDraft({ ...NEW_DRAFT, title: '  ' })).toHaveLength(1);
    expect(validateDraft({ ...NEW_DRAFT, title: 'x'.repeat(101) })).toHaveLength(1);
    expect(validateDraft({ ...NEW_DRAFT, description: '' })).toHaveLength(1);
    expect(validateDraft({ ...NEW_DRAFT, start: '2030-02-01T10:00', end: '2030-02-01T10:00' })).toHaveLength(1);
    expect(validateDraft({ ...NEW_DRAFT, kind: 'demo-credit', credits: 0 })).toHaveLength(1);
    expect(validateDraft({ ...NEW_DRAFT, kind: 'demo-credit', credits: 100001 })).toHaveLength(1);
    expect(validateDraft({ ...NEW_DRAFT, kind: 'demo-credit', credits: 1.5 })).toHaveLength(1);
    expect(validateDraft({ ...NEW_DRAFT, kind: 'demo-credit', credits: 500 })).toEqual([]);
  });

  it('sends zero credits for a banner even if a stale credit value is left in the form', () => {
    expect(draftToPayload({ ...NEW_DRAFT, kind: 'banner', credits: 5 }).credits).toBe(0);
    expect(draftToPayload({ ...NEW_DRAFT, kind: 'demo-credit', credits: 500 }).credits).toBe(500);
  });

  it('keeps an untouched stored schedule exactly, including precision the input cannot show', () => {
    const payload = draftToPayload(draftFromCampaign(campaign), campaign);
    expect(payload.start).toBe('2030-06-15T10:30:45.123456+00:00');
    expect(payload.end).toBeNull();
  });

  it('uses the new value when the schedule was changed or cleared', () => {
    const changed = draftToPayload({ ...draftFromCampaign(campaign), start: '2031-01-02T09:15' }, campaign);
    expect(changed.start).toBe(fromLocalInput('2031-01-02T09:15'));
    expect(draftToPayload({ ...draftFromCampaign(campaign), start: '' }, campaign).start).toBeNull();
    expect(draftToPayload({ ...NEW_DRAFT, start: '2031-01-02T09:15' }).start).toBe(fromLocalInput('2031-01-02T09:15'));
  });
});

describe('filters', () => {
  const filters = (patch: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...patch });

  it('sends nothing for the default view', () => {
    expect(filtersToApiQuery(DEFAULT_FILTERS, null)).toBe('');
    expect(filtersToUrlQuery(DEFAULT_FILTERS)).toBe('');
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('builds the API query with trimmed search, non-default sort and cursor', () => {
    const params = new URLSearchParams(filtersToApiQuery(filters({ search: '  Promo ', status: 'draft', kind: 'banner', sort: 'updated_asc' }), 'abc'));
    expect(Object.fromEntries(params)).toEqual({ search: 'Promo', status: 'draft', kind: 'banner', sort: 'updated_asc', cursor: 'abc' });
  });

  it('turns inclusive end dates into an exclusive next-midnight bound', () => {
    const params = new URLSearchParams(filtersToApiQuery(filters({ createdFrom: '2026-11-01', createdTo: '2026-11-30', updatedFrom: '2026-12-31', updatedTo: '2026-12-31' }), null));
    expect(params.get('createdFrom')).toBe(dayStart(2026, 11, 1));
    expect(params.get('createdTo')).toBe(dayStart(2026, 12, 1));
    expect(params.get('updatedTo')).toBe(dayStart(2027, 1, 1));
  });

  it('omits impossible dates instead of sending them', () => {
    expect(filtersToApiQuery(filters({ createdFrom: '2026-02-31', createdTo: 'soon' }), null)).toBe('');
  });

  it('round-trips through the address bar and drops anything outside the allowlists', () => {
    const original = filters({ search: 'Promo', status: 'approved', kind: 'demo-credit', sort: 'created_asc', createdFrom: '2026-11-01', updatedTo: '2026-11-30' });
    expect(filtersFromSearchParams(new URLSearchParams(filtersToUrlQuery(original)))).toEqual(original);
    const hostile = filtersFromSearchParams(new URLSearchParams({
      status: 'published', kind: 'cash', sort: 'title; drop table x', createdFrom: '2026-02-31', updatedTo: 'x', cursor: 'abc', extra: '1',
      search: 'a'.repeat(200),
    }));
    expect(hostile).toEqual({ ...DEFAULT_FILTERS, search: 'a'.repeat(80) });
  });

  it('drops a reversed date range found in the URL instead of sending it to the API', () => {
    const parsed = filtersFromSearchParams(new URLSearchParams({
      createdFrom: '2026-05-01', createdTo: '2026-04-01', updatedFrom: '2026-01-01', updatedTo: '2026-02-01',
    }));
    expect(parsed).toMatchObject({ createdFrom: '', createdTo: '', updatedFrom: '2026-01-01', updatedTo: '2026-02-01' });
    expect(filterIssues(parsed)).toEqual([]);
  });

  it('reports invalid input and reversed ranges, but allows a single-day range', () => {
    expect(filterIssues(DEFAULT_FILTERS)).toEqual([]);
    expect(filterIssues(filters({ createdFrom: '2026-11-02', createdTo: '2026-11-02' }))).toEqual([]);
    expect(filterIssues(filters({ createdFrom: '2026-11-03', createdTo: '2026-11-02' }))).toHaveLength(1);
    expect(filterIssues(filters({ updatedFrom: '2026-13-01' }))).toHaveLength(1);
    expect(filterIssues(filters({ search: 'a'.repeat(81) }))).toHaveLength(1);
  });

  it('does not count a sort change as an active filter', () => {
    expect(hasActiveFilters(filters({ sort: 'updated_desc' }))).toBe(false);
    expect(hasActiveFilters(filters({ search: '  ' }))).toBe(false);
    expect(hasActiveFilters(filters({ status: 'draft' }))).toBe(true);
    expect(hasActiveFilters(filters({ updatedFrom: '2026-11-01' }))).toBe(true);
  });
});

describe('role-aware actions', () => {
  it('shows only the actions the database offered, in a stable order', () => {
    expect(visibleActions({ allowed_actions: ['duplicate', 'edit'] })).toEqual(['edit', 'duplicate']);
    expect(visibleActions({ allowed_actions: ['reject', 'approve', 'duplicate'] })).toEqual(['approve', 'reject', 'duplicate']);
  });

  it('fails closed: nothing is offered for an empty, missing or unknown set', () => {
    expect(visibleActions({ allowed_actions: [] })).toEqual([]);
    expect(visibleActions({ allowed_actions: undefined as unknown as [] })).toEqual([]);
    expect(visibleActions({ allowed_actions: ['delete', 'publish', 'archive'] as unknown as [] })).toEqual([]);
  });

  it('styles statuses', () => {
    expect(statusClass('approved')).toContain('admin-status-ok');
    expect(statusClass('rejected')).toContain('admin-status-blocked');
    expect(statusClass('draft')).toContain('admin-status-neutral');
    expect(statusClass('submitted')).toContain('admin-status-neutral');
  });
});

describe('history wording', () => {
  it('describes each kind of event', () => {
    expect(describeEvent(event({ action: 'created' }))).toBe('Created as a draft');
    expect(describeEvent(event({ action: 'submitted', previous_status: 'draft', new_status: 'submitted' }))).toBe('Status changed from draft to submitted');
    expect(describeEvent(event({ action: 'approved', previous_status: 'submitted', new_status: 'approved' }))).toBe('Status changed from submitted to approved');
    expect(describeEvent(event({ action: 'rejected', previous_status: null, new_status: 'rejected' }))).toBe('Status set to rejected');
    expect(describeEvent(event({ action: 'edited', changed_fields: ['title', 'credits', 'starts_at'] }))).toBe('Edited title, virtual credits, start date');
    expect(describeEvent(event({ action: 'edited', changed_fields: null }))).toBe('Edited');
    expect(describeEvent(event({ action: 'duplicated', related_campaign_id: '99999999-0000-4000-8000-000000000009' }))).toBe('Created as a copy of campaign 99999999');
    expect(describeEvent(event({ action: 'duplicated' }))).toBe('Created as a copy of another campaign');
  });

  it('labels actors honestly without inventing display names', () => {
    expect(actorLabel(event({ is_self: true }))).toBe('You');
    expect(actorLabel(event({}))).toBe('Administrator aaaaaaaa');
    expect(actorLabel(event({ actor_kind: 'system', actor_id: null }))).toBe('System');
    expect(actorLabel(event({ actor_id: null }))).toBe('Unknown actor');
  });

  it('formats timestamps and tolerates invalid ones', () => {
    expect(formatDateTime('2030-06-15T10:30:00Z')).toContain('2030');
    expect(formatDateTime('garbage')).toBe('Unknown time');
  });
});

describe('failure messages', () => {
  it('explains a stale edit in terms an administrator can act on', () => {
    expect(failureMessage('stale_version')).toMatch(/another administrator/i);
    expect(failureMessage('stale_version')).toMatch(/reload/i);
  });

  it.each(['forbidden', 'not_found', 'conflict', 'rate_limited', 'invalid', 'network', 'unavailable'] as const)(
    'has a clear message for %s',
    code => { expect(failureMessage(code).length).toBeGreaterThan(10); },
  );

  it('never echoes raw error text', () => {
    for (const code of ['forbidden', 'not_found', 'conflict', 'unavailable'] as const) {
      expect(failureMessage(code)).not.toMatch(/SQL|relation|postgres|stack/i);
    }
  });
});
