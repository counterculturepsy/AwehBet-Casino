import type { CampaignPage, CampaignRow, HistoryEvent, PromotionErrorCode } from '@/lib/promotions/types';
import type { CampaignPayload } from './studio-logic';

export type ApiFailure = { ok: false; status: number; code: PromotionErrorCode | 'network' };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

const BASE = '/api/admin/promotions';
const KNOWN_CODES: readonly string[] = [
  'invalid', 'invalid_cursor', 'not_found', 'stale_version', 'conflict', 'rate_limited', 'unavailable', 'forbidden',
];

/** Prefers the server's machine-readable code, falling back to the HTTP status for older endpoints. */
function failureCode(body: unknown, status: number): PromotionErrorCode {
  const code = isObject(body) ? body.code : undefined;
  if (typeof code === 'string' && KNOWN_CODES.includes(code)) return code as PromotionErrorCode;
  if (status === 400) return 'invalid';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  return 'unavailable';
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// The server is trusted to authorise, not to be perfectly shaped: a malformed 200 is treated as a failure
// instead of crashing the page on first property access.
const isCampaignRow = (value: unknown) =>
  isObject(value) && typeof value.id === 'string' && typeof value.title === 'string'
  && typeof value.version === 'number' && Array.isArray(value.allowed_actions);
const isCampaignPage = (value: unknown) =>
  isObject(value) && Array.isArray(value.campaigns) && value.campaigns.every(isCampaignRow)
  && (value.nextCursor === null || typeof value.nextCursor === 'string');
const isHistory = (value: unknown) =>
  isObject(value) && Array.isArray(value.events)
  && value.events.every(event => isObject(event) && typeof event.id === 'number' && typeof event.action === 'string');
const hasString = (key: string) => (value: unknown) => isObject(value) && typeof value[key] === 'string';
const hasNumber = (key: string) => (value: unknown) => isObject(value) && typeof value[key] === 'number';
const isCampaignResponse = (value: unknown) => isObject(value) && isCampaignRow(value.campaign);

async function call<T>(url: string, init?: RequestInit, isValid?: (body: unknown) => boolean): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, { cache: 'no-store', ...init });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: response.status, code: failureCode(body, response.status) };
    if (isValid && !isValid(body)) return { ok: false, status: response.status, code: 'unavailable' };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, code: 'network' };
  }
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const fetchCampaignPage = (query: string) =>
  call<CampaignPage>(query ? `${BASE}?${query}` : BASE, undefined, isCampaignPage);

/** Looks one campaign up through the dedicated exact-id, authorised endpoint. */
export async function fetchCampaignById(id: string): Promise<ApiResult<CampaignRow | null>> {
  const result = await call<{ campaign: CampaignRow }>(`${BASE}/${id}`, undefined, isCampaignResponse);
  return result.ok ? { ok: true, data: result.data.campaign } : result;
}

export const createDraft = (payload: CampaignPayload & { idempotencyKey: string }) =>
  call<{ id: string; status: 'draft' }>(BASE, jsonInit('POST', payload), hasString('id'));

export const updateDraft = (id: string, payload: CampaignPayload, expectedVersion: number) =>
  call<{ id: string; version: number }>(`${BASE}/${id}`, jsonInit('PATCH', { ...payload, expectedVersion }), hasNumber('version'));

export const duplicateCampaign = (id: string, idempotencyKey: string) =>
  call<{ id: string; status: 'draft'; duplicatedFrom: string }>(`${BASE}/${id}/duplicate`, jsonInit('POST', { idempotencyKey }), hasString('id'));

export const transitionCampaign = (id: string, action: 'submit' | 'approve' | 'reject') =>
  call<{ ok: true }>(`${BASE}/transition`, jsonInit('POST', { id, action }));

export const fetchHistory = (id: string) => call<{ events: HistoryEvent[] }>(`${BASE}/${id}/history`, undefined, isHistory);
