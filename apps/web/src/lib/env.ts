import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PLAYER_DATA_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  PLAYER_IDENTITY_HASH_SECRET: z.string().min(32),
});

export function getPublicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export function getServerEnv() {
  return serverSchema.parse({
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PLAYER_DATA_ENCRYPTION_KEY: process.env.PLAYER_DATA_ENCRYPTION_KEY,
    PLAYER_IDENTITY_HASH_SECRET: process.env.PLAYER_IDENTITY_HASH_SECRET,
  });
}

export const featureFlags = {
  payments: process.env.PAYMENTS_ENABLED === 'true',
  withdrawals: process.env.WITHDRAWALS_ENABLED === 'true',
  kycUploads: process.env.KYC_UPLOADS_ENABLED === 'true',
} as const;
