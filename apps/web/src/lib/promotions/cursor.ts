import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MAX_CURSOR_LENGTH, SORT_OPTIONS, type SearchFilters } from './schemas';

// A cursor only records a position in an ordered result set. It is not a security token: the database
// re-authorises every request, and forging a cursor can only move the caller within rows they may already see.
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

const payloadSchema = z.object({
  v: z.literal(1),
  s: z.enum(SORT_OPTIONS),
  f: z.string().regex(/^[0-9a-f]{16}$/),
  t: z.string().regex(TIMESTAMP),
  i: z.string().uuid(),
}).strict();

export type CursorPosition = {
  /** Sort timestamp exactly as the database returned it. It keeps microseconds, so never round-trip it through Date. */
  timestamp: string;
  id: string;
};

function isValidTimestamp(value: string): boolean {
  const match = TIMESTAMP.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1
    && calendar.getUTCDate() === day && calendar.getUTCHours() === hour
    && calendar.getUTCMinutes() === minute && calendar.getUTCSeconds() === second;
}

/** Fingerprint of the active filters and sort, so a cursor cannot be replayed against a different result set. */
export function filterSignature(filters: SearchFilters): string {
  const canonical = JSON.stringify([
    filters.sort,
    filters.search?.toLowerCase() ?? null,
    filters.status ?? null,
    filters.kind ?? null,
    filters.createdBy ?? null,
    filters.createdFrom ?? null,
    filters.createdTo ?? null,
    filters.updatedFrom ?? null,
    filters.updatedTo ?? null,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function encodeCursor(filters: SearchFilters, position: CursorPosition): string {
  const payload = { v: 1, s: filters.sort, f: filterSignature(filters), t: position.timestamp, i: position.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Returns null for anything malformed, oversized, or issued for a different sort or filter set. */
export function decodeCursor(token: string, filters: SearchFilters): CursorPosition | null {
  if (token.length === 0 || token.length > MAX_CURSOR_LENGTH || !BASE64URL.test(token)) return null;
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return null;
  if (!isValidTimestamp(parsed.data.t)) return null;
  if (parsed.data.s !== filters.sort || parsed.data.f !== filterSignature(filters)) return null;
  return { timestamp: parsed.data.t, id: parsed.data.i };
}
