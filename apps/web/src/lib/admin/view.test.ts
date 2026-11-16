import { describe, expect, it } from 'vitest';
import { ADMIN_PAGE_SIZE, KYC_STATUSES, buildHref, canSeeContactDetails, formatMinor, maskEmail, maskPhone, pageCount, pageRange,
  parseCursor, parseEnum, parseEventPrefix, parsePage, parseUuid, sanitizeSearch, statusTone } from './view';

describe('admin view helpers', () => {
  it('parses page numbers and rejects junk', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage(['4', '9'])).toBe(4);
    for (const bad of [undefined, '', '0', '-1', '1.5', 'abc', '1;drop', '999999999']) expect(parsePage(bad)).toBe(1);
    expect(parsePage('99999')).toBe(2000);
  });
  it('only accepts allowlisted filter values', () => {
    expect(parseEnum('pending', KYC_STATUSES)).toBe('pending');
    expect(parseEnum('verified); drop', KYC_STATUSES)).toBeNull();
    expect(parseEnum('toString', KYC_STATUSES)).toBeNull();
    expect(parseEnum(undefined, KYC_STATUSES)).toBeNull();
  });
  it('strips filter syntax from search text', () => {
    expect(sanitizeSearch('  Thandi  ')).toBe('Thandi');
    expect(sanitizeSearch('a%,b)(c*"\\:')).toBe('abc');
    expect(sanitizeSearch("o'brien@mail.co.za")).toBe("o'brien@mail.co.za");
    expect(sanitizeSearch('x'.repeat(200))).toHaveLength(80);
    expect(sanitizeSearch('name,email.ilike.%')).toBe('nameemail.ilike.');
  });
  it('validates uuids, cursors and event prefixes', () => {
    expect(parseUuid('AAAAAAAA-0000-4000-8000-000000000001')).toBe('aaaaaaaa-0000-4000-8000-000000000001');
    expect(parseUuid('not-a-uuid')).toBeNull();
    expect(parseUuid("aaaaaaaa-0000-4000-8000-000000000001' or 1=1")).toBeNull();
    expect(parseCursor('42')).toBe(42);
    for (const bad of ['0', '-3', '4.2', 'x', '']) expect(parseCursor(bad)).toBeNull();
    expect(parseEventPrefix('Deposit.demo_created')).toBe('deposit.demo_created');
    expect(parseEventPrefix('deposit%')).toBe('');
    expect(parseEventPrefix('.deposit')).toBe('');
  });
  it('computes ranges and page counts', () => {
    expect(pageRange(1)).toEqual({ from: 0, to: ADMIN_PAGE_SIZE - 1 });
    expect(pageRange(3)).toEqual({ from: 50, to: 74 });
    expect(pageCount(0)).toBe(1);
    expect(pageCount(null)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
  });
  it('formats money from minor units', () => {
    expect(formatMinor(123456).replace(/\s/g, ' ')).toMatch(/^R1[ ,]234[.,]56$/);
    expect(formatMinor('5000')).toMatch(/^R50[.,]00$/);
    expect(formatMinor(null)).toBe('—');
    expect(formatMinor('abc')).toBe('—');
  });
  it('masks contact details and limits them to admin and owner', () => {
    expect(maskEmail('thandi@example.co.za')).toBe('t•••@example.co.za');
    expect(maskEmail('bad')).toBe('•••');
    expect(maskEmail(null)).toBe('—');
    expect(maskPhone('+27711112222')).toBe('••••••••2222');
    expect(maskPhone('123')).toBe('••••');
    expect(canSeeContactDetails('viewer')).toBe(false);
    expect(canSeeContactDetails('admin')).toBe(true);
    expect(canSeeContactDetails('owner')).toBe(true);
  });
  it('maps statuses to tones and builds filter links', () => {
    expect(statusTone('verified')).toBe('ok');
    expect(statusTone('rejected')).toBe('blocked');
    expect(statusTone('pending')).toBe('neutral');
    expect(buildHref('/admin/players', { q: 'a b', kyc: null, page: 1 })).toBe('/admin/players?q=a+b');
    expect(buildHref('/admin/players', { q: '', page: 3 })).toBe('/admin/players?page=3');
    expect(buildHref('/admin/players', {})).toBe('/admin/players');
  });
});
