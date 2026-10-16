import 'server-only';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type PlayerProfile = {
  user_id: string; first_name: string; last_name: string; date_of_birth: string;
  country_of_residence: string; mobile_phone: string; email: string;
  kyc_status: 'not_started' | 'pending' | 'under_review' | 'verified' | 'rejected';
};
export type WalletRecord = { id: string; available_minor: number; pending_minor: number; currency: string; status: string; simulated: boolean };
export type TransactionRecord = { id: string; direction: string; amount_minor: number; transaction_type: string; status: string; provider: string; simulated: boolean; created_at: string };
export type PayoutAccount = { id: string; bank_code: string; account_holder: string; account_last_four: string; verified_at: string | null };

export async function requirePlayer() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');
  const [{ data: profile }, { data: wallet }, { data: payoutAccounts }] = await Promise.all([
    supabase.from('player_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.rpc('list_own_payout_accounts'),
  ]);
  return { supabase, user, profile: profile as PlayerProfile | null, wallet: wallet as WalletRecord | null, payoutAccounts: (payoutAccounts || []) as PayoutAccount[] };
}

export function formatZar(minor = 0) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(minor / 100);
}
