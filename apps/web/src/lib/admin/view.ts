/** Pure helpers for the read-only admin pages: input parsing, masking and display formatting. */
import type { AdminRole } from '@/lib/admin';

export const ADMIN_PAGE_SIZE = 25;
const MAX_PAGE = 2000;

export const KYC_STATUSES = ['not_started', 'pending', 'under_review', 'verified', 'rejected'] as const;
export const DEPOSIT_STATUSES = ['pending', 'completed', 'failed', 'cancelled', 'reversed'] as const;
export const WITHDRAWAL_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'cancelled', 'paid'] as const;

type Param = string | string[] | undefined;
const first = (value: Param): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '');

export function parsePage(value: Param): number {
  const raw = first(value);
  if (!/^\d{1,5}$/.test(raw)) return 1;
  return Math.min(Math.max(Number(raw), 1), MAX_PAGE);
}

/** Returns the value only when it is in the allowlist; anything else means "no filter". */
export function parseEnum<T extends string>(value: Param, allowed: readonly T[]): T | null {
  const raw = first(value);
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** Keeps only characters that are safe inside a PostgREST filter value. */
export function sanitizeSearch(value: Param): string {
  return first(value).normalize('NFKC').replace(/[^\p{L}\p{N} @._'-]/gu, '').trim().slice(0, 80);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseUuid(value: Param): string | null {
  const raw = first(value);
  return UUID.test(raw) ? raw.toLowerCase() : null;
}

export function parseEventPrefix(value: Param): string {
  const raw = first(value).toLowerCase();
  return /^[a-z][a-z0-9_.]{0,59}$/.test(raw) ? raw : '';
}

export function parseCursor(value: Param): number | null {
  const raw = first(value);
  if (!/^\d{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  return { from, to: from + ADMIN_PAGE_SIZE - 1 };
}

/** Never advertises a page that parsePage would refuse; see pagesAreCapped for telling the admin. */
export function pageCount(total: number | null | undefined): number {
  return Math.min(MAX_PAGE, Math.max(1, Math.ceil((total ?? 0) / ADMIN_PAGE_SIZE)));
}

export const pagesAreCapped = (total: number | null | undefined): boolean => (total ?? 0) > MAX_PAGE * ADMIN_PAGE_SIZE;

export function formatMinor(amountMinor: number | string | null | undefined): string {
  if (amountMinor === null || amountMinor === undefined || amountMinor === '') return '—';
  const value = Number(amountMinor);
  if (!Number.isFinite(value)) return '—';
  return `R${(value / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' });
}

export const label = (value: string | null | undefined): string => (value ? value.replace(/[_-]/g, ' ') : '—');
export const shortId = (id: string | null | undefined): string => (id ? `${id.slice(0, 8)}…` : '—');

/** Viewers see contact details masked; admins and owners see them in full. */
export const canSeeContactDetails = (role: AdminRole): boolean => role === 'owner' || role === 'admin';

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  return `${email[0]}•••@${email.slice(at + 1)}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  return phone.length <= 4 ? '••••' : `${'•'.repeat(Math.min(phone.length - 4, 8))}${phone.slice(-4)}`;
}

export function statusTone(status: string | null | undefined): 'ok' | 'blocked' | 'neutral' {
  if (!status) return 'neutral';
  if (['verified', 'completed', 'approved', 'paid', 'active'].includes(status)) return 'ok';
  if (['rejected', 'failed', 'reversed', 'restricted', 'closed'].includes(status)) return 'blocked';
  return 'neutral';
}

/** Builds a same-page href from the current filters, dropping empty values. */
export function buildHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || (key === 'page' && Number(value) <= 1)) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
