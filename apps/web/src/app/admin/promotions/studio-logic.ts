import {
  CAMPAIGN_KINDS, CAMPAIGN_STATUSES, MAX_SEARCH_LENGTH, SORT_OPTIONS,
  type CampaignKind, type CampaignStatus, type SortOption,
} from '@/lib/promotions/constants';
import type { CampaignRow, EditedField, HistoryEvent, PromotionAction, PromotionErrorCode } from '@/lib/promotions/types';

// ---- Draft form ------------------------------------------------------------------------------------

export type CampaignDraft = {
  title: string;
  description: string;
  kind: CampaignKind;
  /** datetime-local value in the viewer's time zone, or '' */
  start: string;
  end: string;
  credits: number;
  /** Preview-only flag. Never persisted. */
  enabled: boolean;
};

export type CampaignPayload = {
  title: string;
  description: string;
  kind: CampaignKind;
  credits: number;
  start: string | null;
  end: string | null;
};

export const NEW_DRAFT: CampaignDraft = {
  title: 'Welcome to AwehBet',
  description: 'Explore our free-to-play demo experience.',
  kind: 'banner',
  start: '',
  end: '',
  credits: 0,
  enabled: false,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function draftFromCampaign(campaign: CampaignRow): CampaignDraft {
  return {
    title: campaign.title,
    description: campaign.description,
    kind: campaign.kind,
    start: toLocalInput(campaign.starts_at),
    end: toLocalInput(campaign.ends_at),
    credits: campaign.proposed_credits,
    enabled: false,
  };
}

export function validateDraft(draft: CampaignDraft): string[] {
  const issues: string[] = [];
  if (!draft.title.trim() || draft.title.length > 100) issues.push('Enter a title of 1–100 characters.');
  if (!draft.description.trim() || draft.description.length > 300) issues.push('Enter a description of 1–300 characters.');
  if (draft.start && draft.end && draft.end <= draft.start) issues.push('End date must be after the start date.');
  if (draft.kind === 'demo-credit' && (!Number.isSafeInteger(draft.credits) || draft.credits < 1 || draft.credits > 100000)) {
    issues.push('Virtual credit amount must be between 1 and 100,000.');
  }
  return issues;
}

/**
 * Builds the API payload. A schedule field the administrator did not touch keeps its stored value exactly,
 * so saving never rounds away precision that the datetime input cannot display.
 */
export function draftToPayload(draft: CampaignDraft, original?: CampaignRow): CampaignPayload {
  const keep = (local: string, stored: string | null | undefined) =>
    stored !== undefined && local === toLocalInput(stored) ? stored : fromLocalInput(local);
  return {
    title: draft.title,
    description: draft.description,
    kind: draft.kind,
    credits: draft.kind === 'banner' ? 0 : draft.credits,
    start: keep(draft.start, original?.starts_at),
    end: keep(draft.end, original?.ends_at),
  };
}

// ---- Filters and URL state ---------------------------------------------------------------------------

export type Filters = {
  search: string;
  status: CampaignStatus | '';
  kind: CampaignKind | '';
  sort: SortOption;
  /** Date-only values (YYYY-MM-DD) in the viewer's time zone. */
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
};

export const DEFAULT_FILTERS: Filters = {
  search: '', status: '', kind: '', sort: 'created_desc',
  createdFrom: '', createdTo: '', updatedFrom: '', updatedTo: '',
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function localDay(value: string, offsetDays = 0): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // Date rolls 2026-02-31 over into March, so confirm the parts survived the round trip.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setDate(date.getDate() + offsetDays);
  return date;
}

const isoDay = (value: string, offsetDays = 0) => localDay(value, offsetDays)?.toISOString() ?? null;

export function filterIssues(filters: Filters): string[] {
  const issues: string[] = [];
  if (filters.search.length > MAX_SEARCH_LENGTH) issues.push(`Search must be ${MAX_SEARCH_LENGTH} characters or fewer.`);
  const ranges = [['Created', filters.createdFrom, filters.createdTo], ['Updated', filters.updatedFrom, filters.updatedTo]] as const;
  for (const [label, from, to] of ranges) {
    if ((from && !localDay(from)) || (to && !localDay(to))) issues.push(`${label} dates must be valid dates.`);
    else if (from && to && to < from) issues.push(`${label} end date must be on or after the start date.`);
  }
  return issues;
}

/** Query string for the list API. The end date is inclusive for the user, so it becomes the next local midnight. */
export function filtersToApiQuery(filters: Filters, cursor: string | null): string {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  if (search) params.set('search', search);
  if (filters.status) params.set('status', filters.status);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  const dates: Array<[string, string | null]> = [
    ['createdFrom', isoDay(filters.createdFrom)],
    ['createdTo', isoDay(filters.createdTo, 1)],
    ['updatedFrom', isoDay(filters.updatedFrom)],
    ['updatedTo', isoDay(filters.updatedTo, 1)],
  ];
  for (const [key, value] of dates) if (value) params.set(key, value);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

/** Address-bar form of the filters (date-only, never a cursor) so a filtered view survives reload and sharing. */
export function filtersToUrlQuery(filters: Filters): string {
  const params = new URLSearchParams();
  const entries: Array<[string, string]> = [
    ['search', filters.search.trim()], ['status', filters.status], ['kind', filters.kind],
    ['sort', filters.sort === DEFAULT_FILTERS.sort ? '' : filters.sort],
    ['createdFrom', filters.createdFrom], ['createdTo', filters.createdTo],
    ['updatedFrom', filters.updatedFrom], ['updatedTo', filters.updatedTo],
  ];
  for (const [key, value] of entries) if (value) params.set(key, value);
  return params.toString();
}

/** Reads filters from untrusted URL parameters, dropping anything outside the allowlists. */
export function filtersFromSearchParams(params: URLSearchParams): Filters {
  const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
    value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
  const date = (value: string | null) => (value && localDay(value) ? value : '');
  const filters: Filters = {
    search: (params.get('search') ?? '').slice(0, MAX_SEARCH_LENGTH),
    status: pick(params.get('status'), CAMPAIGN_STATUSES) ?? '',
    kind: pick(params.get('kind'), CAMPAIGN_KINDS) ?? '',
    sort: pick(params.get('sort'), SORT_OPTIONS) ?? DEFAULT_FILTERS.sort,
    createdFrom: date(params.get('createdFrom')),
    createdTo: date(params.get('createdTo')),
    updatedFrom: date(params.get('updatedFrom')),
    updatedTo: date(params.get('updatedTo')),
  };
  // A reversed range from a hand-edited URL would only make the API refuse the request, so drop it here.
  if (filters.createdFrom && filters.createdTo && filters.createdTo < filters.createdFrom) {
    filters.createdFrom = '';
    filters.createdTo = '';
  }
  if (filters.updatedFrom && filters.updatedTo && filters.updatedTo < filters.updatedFrom) {
    filters.updatedFrom = '';
    filters.updatedTo = '';
  }
  return filters;
}

export function hasActiveFilters(filters: Filters): boolean {
  return Boolean(
    filters.search.trim() || filters.status || filters.kind
    || filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo,
  );
}

// ---- Row actions -----------------------------------------------------------------------------------

export const ACTION_LABELS: Record<PromotionAction, string> = {
  edit: 'Edit', submit: 'Submit for review', approve: 'Approve', reject: 'Reject', duplicate: 'Duplicate',
};
const ACTION_ORDER: readonly PromotionAction[] = ['edit', 'submit', 'approve', 'reject', 'duplicate'];

/** Actions to render for a row, in a stable order. Only what the database offered is ever shown. */
export function visibleActions(campaign: Pick<CampaignRow, 'allowed_actions'>): PromotionAction[] {
  const offered = new Set<string>(campaign.allowed_actions ?? []);
  return ACTION_ORDER.filter(action => offered.has(action));
}

export function statusClass(status: CampaignStatus): string {
  if (status === 'approved') return 'admin-status admin-status-ok';
  if (status === 'rejected') return 'admin-status admin-status-blocked';
  return 'admin-status admin-status-neutral';
}

// ---- History and messages --------------------------------------------------------------------------

const FIELD_LABELS: Record<EditedField, string> = {
  title: 'title', description: 'description', kind: 'campaign type', credits: 'virtual credits',
  starts_at: 'start date', ends_at: 'end date',
};

export const shortId = (id: string) => id.slice(0, 8);

export function describeEvent(event: HistoryEvent): string {
  switch (event.action) {
    case 'created':
      return 'Created as a draft';
    case 'duplicated':
      return event.related_campaign_id
        ? `Created as a copy of campaign ${shortId(event.related_campaign_id)}`
        : 'Created as a copy of another campaign';
    case 'edited': {
      const names = (event.changed_fields ?? []).map(field => FIELD_LABELS[field] ?? field);
      return names.length ? `Edited ${names.join(', ')}` : 'Edited';
    }
    default:
      return event.previous_status
        ? `Status changed from ${event.previous_status} to ${event.new_status}`
        : `Status set to ${event.new_status}`;
  }
}

/** Never invents a display name: an administrator is identified by a short id, the caller as "You". */
export function actorLabel(event: HistoryEvent): string {
  if (event.actor_kind === 'system') return 'System';
  if (event.is_self) return 'You';
  return event.actor_id ? `Administrator ${shortId(event.actor_id)}` : 'Unknown actor';
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

export function failureMessage(code: PromotionErrorCode | 'network'): string {
  switch (code) {
    case 'stale_version': return 'Another administrator changed this campaign. Reload the latest version before editing again.';
    case 'forbidden': return 'You do not have permission to do that.';
    case 'not_found': return 'This campaign is no longer available.';
    case 'conflict': return 'That action is not available for this campaign in its current state.';
    case 'rate_limited': return 'Too many requests. Please wait a minute and try again.';
    case 'invalid': return 'Some details are not valid. Check them and try again.';
    case 'network': return 'Unable to reach the campaign service.';
    default: return 'The campaign service is temporarily unavailable. Please try again.';
  }
}
