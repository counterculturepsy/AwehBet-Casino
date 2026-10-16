import Link from 'next/link';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, BadgeCheck, CircleUserRound, Clock3, History, LockKeyhole, ShieldCheck, Wallet } from 'lucide-react';
import { formatZar, requirePlayer, type TransactionRecord } from '@/lib/account';

const statusDescriptions: Record<string, string> = {
  not_started: 'Identity verification has not started.',
  pending: 'Your verification is pending.',
  under_review: 'Your details are under review.',
  verified: 'Your identity verification is complete.',
  rejected: 'Verification needs further attention.',
};

function displayStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export default async function AccountPage() {
  const { supabase, profile, wallet, user } = await requirePlayer();
  const { data: transactions, error } = wallet
    ? await supabase.from('wallet_transactions').select('id,direction,amount_minor,transaction_type,status,provider,simulated,created_at').eq('wallet_id', wallet.id).order('created_at', { ascending: false }).limit(5)
    : { data: [], error: null };
  const rows = (transactions || []) as TransactionRecord[];
  const status = profile?.kyc_status || 'not_started';
  const displayName = profile?.first_name?.trim() || 'Player';

  return (
    <>
      <header className="dashboard-head dashboard-welcome">
        <div>
          <p className="account-eyebrow">AWEHBET · PLAYER DASHBOARD</p>
          <h1>Welcome back, {displayName}</h1>
          <p>Manage your demo wallet, review account activity and keep your profile secure.</p>
        </div>
        <Link className="dashboard-profile-link" href="/account/profile"><CircleUserRound size={18}/> My profile <ArrowRight size={16}/></Link>
      </header>

      <div className="demo-banner" role="note"><ShieldCheck aria-hidden="true"/><div><strong>Development environment · Simulated funds only</strong><p>Balances and transaction records are demonstrations. Deposits, withdrawals and real-money wagering are disabled.</p></div></div>

      <section className="dashboard-stats" aria-label="Account summary">
        <article><Wallet aria-hidden="true"/><span>Available demo balance</span><strong>{formatZar(wallet?.available_minor)}</strong><small>ZAR · Simulated funds</small></article>
        <article><Clock3 aria-hidden="true"/><span>Pending demo balance</span><strong>{formatZar(wallet?.pending_minor)}</strong><small>Not withdrawable</small></article>
        <article><BadgeCheck aria-hidden="true"/><span>Identity verification</span><strong className="status-text">{displayStatus(status)}</strong><small><Link href="/account/verification">View verification status <ArrowRight size={12}/></Link></small></article>
      </section>

      <section className="dashboard-panel" aria-labelledby="account-actions-heading">
        <div className="panel-heading"><div><p className="account-eyebrow">QUICK ACCESS</p><h2 id="account-actions-heading">Manage your account</h2></div></div>
        <div className="dashboard-quick-actions">
          <Link href="/account/deposit"><ArrowDownToLine aria-hidden="true"/><span><strong>Deposit centre</strong><small>Explore available demo methods</small></span><ArrowRight aria-hidden="true"/></Link>
          <Link href="/account/withdraw"><ArrowUpFromLine aria-hidden="true"/><span><strong>Withdrawals</strong><small>Review withdrawal readiness</small></span><ArrowRight aria-hidden="true"/></Link>
          <Link href="/account/security"><LockKeyhole aria-hidden="true"/><span><strong>Account security</strong><small>Password and session controls</small></span><ArrowRight aria-hidden="true"/></Link>
          <Link href="/account/transactions"><History aria-hidden="true"/><span><strong>Transaction history</strong><small>View recorded demo activity</small></span><ArrowRight aria-hidden="true"/></Link>
        </div>
      </section>

      <div className="dashboard-overview-grid">
        <section className="dashboard-panel" aria-labelledby="activity-heading">
          <div className="panel-heading"><div><p className="account-eyebrow">RECENT ACTIVITY</p><h2 id="activity-heading">Wallet transactions</h2></div><Link href="/account/transactions">View all <ArrowRight size={14}/></Link></div>
          {error ? <p className="empty-copy" role="status">Transaction history is temporarily unavailable. Please try again later.</p> : <TransactionList transactions={rows}/>}
        </section>
        <section className="dashboard-panel dashboard-account-health" aria-labelledby="account-health-heading">
          <p className="account-eyebrow">ACCOUNT STATUS</p>
          <h2 id="account-health-heading">Your account at a glance</h2>
          <div className="dashboard-health-row"><span>Verification</span><strong>{displayStatus(status)}</strong></div>
          <p>{statusDescriptions[status] || 'Check your current verification status.'}</p>
          <div className="dashboard-health-row"><span>Account email</span><strong className="dashboard-email">{user.email || profile?.email || 'Not available'}</strong></div>
          <div className="dashboard-health-row"><span>Wallet mode</span><strong>{wallet?.simulated === false ? 'Unavailable' : 'Demo only'}</strong></div>
          <Link className="dashboard-health-link" href="/account/verification">View verification details <ArrowRight size={15}/></Link>
          <Link className="dashboard-health-link" href="/account/responsible-gaming">Responsible gaming settings <ArrowRight size={15}/></Link>
        </section>
      </div>
    </>
  );
}

function TransactionList({ transactions }: { transactions: TransactionRecord[] }) {
  if (!transactions.length) return <div className="empty-state"><Wallet aria-hidden="true"/><h3>No wallet activity yet</h3><p>When demo transactions are recorded, they will appear here.</p></div>;
  return <div className="transaction-list">{transactions.map((item) => <article key={item.id}><div><strong>{displayStatus(item.transaction_type)}</strong><span>{new Date(item.created_at).toLocaleDateString('en-ZA')} · {displayStatus(item.status)}{item.simulated ? ' · Demo' : ''}</span></div><strong>{item.direction === 'credit' ? '+' : '-'}{formatZar(item.amount_minor)}</strong></article>)}</div>;
}
