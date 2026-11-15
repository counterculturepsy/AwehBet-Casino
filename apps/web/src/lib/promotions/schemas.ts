import { z } from 'zod';
import {
  CAMPAIGN_KINDS, CAMPAIGN_STATUSES, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_SEARCH_LENGTH, SORT_OPTIONS,
  type CampaignKind, type CampaignStatus, type SortOption,
} from './constants';

// Re-exported so server code keeps a single import site. Client components import ./constants directly.
export {
  CAMPAIGN_KINDS, CAMPAIGN_STATUSES, DEFAULT_PAGE_SIZE, MAX_CURSOR_LENGTH, MAX_PAGE_SIZE, MAX_SEARCH_LENGTH, SORT_OPTIONS,
} from './constants';
export type { CampaignKind, CampaignStatus, SortOption };

type CampaignRuleInput = { kind: CampaignKind; credits: number; start: string | null; end: string | null };

/** Cross-field rules shared by create and update. The database re-enforces them as constraints. */
export function withCampaignRules<S extends z.ZodType<CampaignRuleInput>>(schema: S) {
  return schema
    .refine(v => (v.kind === 'banner' && v.credits === 0) || (v.kind === 'demo-credit' && v.credits >= 1), 'Invalid credit amount')
    .refine(v => !v.start || !v.end || Date.parse(v.end) > Date.parse(v.start), 'Invalid schedule');
}

const campaignFields = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(300),
  kind: z.enum(CAMPAIGN_KINDS),
  credits: z.number().int().min(0).max(100000),
  start: z.string().datetime({ offset: true }).nullable(),
  end: z.string().datetime({ offset: true }).nullable(),
});

export const createCampaignSchema = withCampaignRules(
  campaignFields.extend({ idempotencyKey: z.string().uuid() }).strict(),
);

export const updateCampaignSchema = withCampaignRules(
  campaignFields.extend({ expectedVersion: z.number().int().min(1).max(2_147_483_647) }).strict(),
);

export const duplicateCampaignSchema = z.object({ idempotencyKey: z.string().uuid() }).strict();

export const campaignIdSchema = z.string().uuid();

const isoDate = z.string().datetime({ offset: true });

const searchParamsSchema = z.object({
  search: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  kind: z.enum(CAMPAIGN_KINDS).optional(),
  createdBy: z.string().uuid().optional(),
  createdFrom: isoDate.optional(),
  createdTo: isoDate.optional(),
  updatedFrom: isoDate.optional(),
  updatedTo: isoDate.optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  // Length and shape are enforced by decodeCursor so every cursor failure reports the same invalid_cursor reason.
  cursor: z.string().optional(),
}).strict()
  .refine(v => !v.createdFrom || !v.createdTo || Date.parse(v.createdTo) > Date.parse(v.createdFrom), 'Invalid created range')
  .refine(v => !v.updatedFrom || !v.updatedTo || Date.parse(v.updatedTo) > Date.parse(v.updatedFrom), 'Invalid updated range');

/** Filters that define a result set. Pagination state is deliberately excluded. */
export type SearchFilters = {
  search?: string;
  status?: CampaignStatus;
  kind?: CampaignKind;
  createdBy?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sort: SortOption;
};
export type SearchQuery = SearchFilters & { limit: number; cursor?: string };

/**
 * Validates and normalises list query parameters. Empty values are treated as absent so a cleared form
 * field never reaches the database. Repeated or unknown parameters are rejected.
 */
export function parseSearchParams(params: URLSearchParams): { ok: true; value: SearchQuery } | { ok: false } {
  const raw: Record<string, string> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length > 1) return { ok: false };
    if (values[0].trim() !== '') raw[key] = values[0];
  }
  const parsed = searchParamsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { sort, limit, search, ...rest } = parsed.data;
  return {
    ok: true,
    value: { ...rest, ...(search ? { search } : {}), sort: sort ?? 'created_desc', limit: limit ?? DEFAULT_PAGE_SIZE },
  };
}
