// Zod-free constants shared by server and client code. Client components import from here, not from
// schemas.ts, so the validation library never ships to the browser.
export const CAMPAIGN_KINDS = ['banner', 'demo-credit'] as const;
export const CAMPAIGN_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
/** Allowlist mapped one-to-one onto the database sort options. Never interpolated into SQL. */
export const SORT_OPTIONS = ['created_desc', 'created_asc', 'updated_desc', 'updated_asc'] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 50;
export const MAX_SEARCH_LENGTH = 80;
export const MAX_CURSOR_LENGTH = 400;

export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];
