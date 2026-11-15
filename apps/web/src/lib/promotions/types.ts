import type { CampaignKind, CampaignStatus } from './schemas';

/** Actions the database offers the current administrator for one campaign. Authoritative: derived server-side. */
export type PromotionAction = 'edit' | 'submit' | 'approve' | 'reject' | 'duplicate';

/** One row of public.admin_search_promotions. Property names mirror the database columns. */
export type CampaignRow = {
  id: string;
  title: string;
  description: string;
  kind: CampaignKind;
  proposed_credits: number;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  duplicated_from: string | null;
  allowed_actions: PromotionAction[];
};

export type CampaignPage = {
  campaigns: CampaignRow[];
  nextCursor: string | null;
  pageSize: number;
};

export type HistoryAction = 'created' | 'submitted' | 'approved' | 'rejected' | 'edited' | 'duplicated';
export type EditedField = 'title' | 'description' | 'kind' | 'credits' | 'starts_at' | 'ends_at';

/** One row of public.admin_promotion_history. Contains no emails, names or free-form payloads. */
export type HistoryEvent = {
  id: number;
  action: HistoryAction;
  occurred_at: string;
  previous_status: CampaignStatus | null;
  new_status: CampaignStatus;
  campaign_version: number | null;
  changed_fields: EditedField[] | null;
  related_campaign_id: string | null;
  actor_id: string | null;
  actor_kind: 'administrator' | 'system';
  is_self: boolean;
};

/** Machine-readable failure reasons returned alongside the neutral error text. */
export type PromotionErrorCode =
  | 'invalid' | 'invalid_cursor' | 'not_found' | 'stale_version' | 'conflict'
  | 'rate_limited' | 'unavailable' | 'forbidden';
