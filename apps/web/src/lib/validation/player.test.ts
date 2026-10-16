import { describe, expect, it } from 'vitest';
import { depositPreviewSchema, isAdult, isValidSouthAfricanId, registrationSchema } from './player';

const validRegistration = {
  firstName: 'Thandi', lastName: 'Mokoena', birthDate: '1980-01-01', documentType: 'sa-id' as const,
  documentNumber: '8001015009087', countryOfResidence: 'ZA', mobilePhone: '0821234567',
  email: 'thandi@example.com', password: 'VeryStrong!234', confirmPassword: 'VeryStrong!234',
  acceptedTerms: true as const, acknowledgedPrivacy: true as const, marketingConsent: false,
};

describe('South African player registration', () => {
  it('accepts a checksum-valid South African ID', () => {
    expect(isValidSouthAfricanId('8001015009087')).toBe(true);
  });

  it('rejects an invalid identity checksum', () => {
    expect(isValidSouthAfricanId('8001015009088')).toBe(false);
    expect(registrationSchema.safeParse({ ...validRegistration, documentNumber: '8001015009088' }).success).toBe(false);
  });

  it('rejects an ID number that does not match the supplied birth date', () => {
    expect(registrationSchema.safeParse({ ...validRegistration, birthDate: '1991-05-20' }).success).toBe(false);
  });

  it('rejects underage registration', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    expect(isAdult('2009-10-17', now)).toBe(false);
    expect(isAdult('2008-10-16', now)).toBe(true);
  });

  it('rejects weak and mismatched passwords', () => {
    expect(registrationSchema.safeParse({ ...validRegistration, password: 'password', confirmPassword: 'password' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...validRegistration, confirmPassword: 'Different!234' }).success).toBe(false);
  });

  it('rejects malformed email and phone values', () => {
    expect(registrationSchema.safeParse({ ...validRegistration, email: 'not-an-email' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...validRegistration, mobilePhone: '123' }).success).toBe(false);
  });

  it('keeps marketing consent opt-in and optional', () => {
    const parsed = registrationSchema.parse({ ...validRegistration, marketingConsent: undefined });
    expect(parsed.marketingConsent).toBe(false);
  });
});

describe('payment preview validation', () => {
  it('requires integer minor units and bounded amounts', () => {
    expect(depositPreviewSchema.safeParse({ method: 'fnb', amountMinor: 10_000, idempotencyKey: crypto.randomUUID() }).success).toBe(true);
    expect(depositPreviewSchema.safeParse({ method: 'fnb', amountMinor: 100.5, idempotencyKey: crypto.randomUUID() }).success).toBe(false);
    expect(depositPreviewSchema.safeParse({ method: 'fnb', amountMinor: 100, idempotencyKey: crypto.randomUUID() }).success).toBe(false);
  });
});
