import Link from 'next/link';
import { BadgeCheck, Clock3, ShieldCheck, Wallet } from 'lucide-react';
import { formatZar, requirePlayer, type TransactionRecord } from '@/lib/account';

export default async function AccountPage() {
  const { supabase, profile, wallet } = await requirePlayer();
  const { data: transactions } = wallet ? await supabase.from('wallet_transactions').select('*').eq('wallet_id', wallet.id).order('created_at', { ascending: false }).limit(5) : { data: [] };
  return <><header className="dashboard-head"><p className="account-eyebrow">PLAYER DASHBOARD</p><h1>Welcome{profile ? `, ${profile.first_name}` : ''}</h1><p>Your account, wallet, verification, and safety controls in one secure place.</p></header><div className="demo-banner"><ShieldCheck/><div><strong>Development environment</strong><p>All balances and transactions are simulated. No deposits, withdrawals, or wagering can move real money.</p></div></div><section className="dashboard-stats"><article><Wallet/><span>Available demo balance</span><strong>{formatZar(wallet?.available_minor)}</strong><small>ZAR · Simulated</small></article><article><Clock3/><span>Pending</span><strong>{formatZar(wallet?.pending_minor)}</strong><small>No real funds</small></article><article><BadgeCheck/><span>Verification</span><strong className="status-text">{profile?.kyc_status.replace('_', ' ') || 'Not started'}</strong><small><Link href="/account/verification">View requirements</Link></small></article></section><section className="dashboard-panel"><div className="panel-heading"><div><p className="account-eyebrow">RECENT ACTIVITY</p><h2>Wallet transactions</h2></div><Link href="/account/transactions">View all</Link></div><TransactionList transactions={(transactions || []) as TransactionRecord[]}/></section></>;
}

function TransactionList({ transactions }: { transactions: TransactionRecord[] }) {
  if (!transactions.length) return <div className="empty-state"><Wallet/><h3>No wallet activity yet</h3><p>Simulated payment references and future provider transactions will appear here.</p></div>;
  return <div className="transaction-list">{transactions.map((item) => <article key={item.id}><div><strong>{item.transaction_type}</strong><span>{new Date(item.created_at).toLocaleDateString('en-ZA')} · {item.status}</span></div><strong>{item.direction === 'credit' ? '+' : '-'}{formatZar(item.amount_minor)}</strong></article>)}</div>;
}
