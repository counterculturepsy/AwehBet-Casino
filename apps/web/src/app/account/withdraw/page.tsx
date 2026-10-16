import { WithdrawalForm } from '@/components/account/withdrawal-form';
import { requirePlayer } from '@/lib/account';

export default async function WithdrawPage() { const { payoutAccounts } = await requirePlayer(); return <><header className="dashboard-head"><p className="account-eyebrow">WITHDRAWAL CENTRE · DISABLED</p><h1>Withdrawal readiness</h1><p>Bank accounts, KYC, balance review, and operational approval are required. Real payouts are disabled.</p></header><WithdrawalForm accounts={payoutAccounts}/></>; }
