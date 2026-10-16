import { z } from 'zod';

const SA_PHONE = /^(?:\+27|0)[6-8][0-9]{8}$/;
const PASSPORT = /^[A-Z0-9]{5,20}$/;

export function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, '');
}

export function isAdult(dateValue: string, now = new Date()) {
  const birthDate = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > now) return false;
  const threshold = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return birthDate <= threshold;
}

export function isValidSouthAfricanId(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const yy = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const currentYear = new Date().getUTCFullYear() % 100;
  const year = (yy <= currentYear ? 2000 : 1900) + yy;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;

  let total = 0;
  for (let index = 0; index < 12; index += 1) {
    let digit = Number(value[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
  }
  const checksum = (10 - (total % 10)) % 10;
  return checksum === Number(value[12]);
}

export const passwordSchema = z.string()
  .min(12, 'Use at least 12 characters.')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a number.')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol.');

export const registrationSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  birthDate: z.string().refine((value) => isAdult(value), 'You must be at least 18 years old.'),
  documentType: z.enum(['sa-id', 'passport']),
  documentNumber: z.string().trim().transform((value) => value.replace(/\s+/g, '').toUpperCase()),
  countryOfResidence: z.string().trim().length(2),
  issuingCountry: z.string().trim().length(2).optional(),
  mobilePhone: z.string().transform(normalizePhone).refine((value) => SA_PHONE.test(value), 'Enter a valid South African mobile number.'),
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptedTerms: z.literal(true),
  acknowledgedPrivacy: z.literal(true),
  marketingConsent: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
  }
  if (value.documentType === 'sa-id' && !isValidSouthAfricanId(value.documentNumber)) {
    context.addIssue({ code: 'custom', path: ['documentNumber'], message: 'Enter a valid South African ID number.' });
  }
  if (value.documentType === 'passport' && !PASSPORT.test(value.documentNumber)) {
    context.addIssue({ code: 'custom', path: ['documentNumber'], message: 'Enter a valid passport number.' });
  }
  if (value.documentType === 'passport' && !value.issuingCountry) {
    context.addIssue({ code: 'custom', path: ['issuingCountry'], message: 'Select the passport issuing country.' });
  }
});

export type RegistrationInput = z.input<typeof registrationSchema>;

export const loginSchema = z.object({
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

export const depositPreviewSchema = z.object({
  method: z.enum(['instant-eft', 'fnb', 'capitec', 'nedbank', 'absa', 'card', 'voucher', 'apple-pay', 'google-pay']),
  amountMinor: z.number().int().min(1000).max(500_000),
  idempotencyKey: z.uuid(),
});

export const withdrawalPreviewSchema = z.object({
  amountMinor: z.number().int().min(5000).max(1_000_000),
  idempotencyKey: z.uuid(),
  payoutAccountId: z.uuid(),
});

export const payoutAccountSchema = z.object({
  bankCode: z.enum(['fnb', 'capitec', 'nedbank', 'absa']),
  accountHolder: z.string().trim().min(3).max(120),
  accountNumber: z.string().trim().regex(/^\d{6,16}$/, 'Enter a valid account number.'),
});

export const responsibleGamingSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cool-off'), days: z.union([z.literal(1), z.literal(7), z.literal(30)]) }),
  z.object({ action: z.literal('self-exclude'), months: z.union([z.literal(6), z.literal(12), z.literal(60)]) }),
  z.object({
    action: z.literal('limits'),
    dailyMinor: z.number().int().min(0).max(10_000_000).nullable(),
    weeklyMinor: z.number().int().min(0).max(50_000_000).nullable(),
    monthlyMinor: z.number().int().min(0).max(100_000_000).nullable(),
  }),
]);
