import Link from 'next/link';
import { ArrowLeft, History, ShieldCheck } from 'lucide-react';
import { formatZar, requirePlayer, type TransactionRecord } from '@/lib/account';

const label = (value: string) => value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

export default async function TransactionsPage() {
  const { supabase, wallet } = await requirePlayer();
  const { data, error } = wallet
    ? await supabase.from('wallet_transactions')
        .select('id,direction,amount_minor,transaction_type,status,provider,simulated,created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [], error: null };
  const rows = (data || []) as TransactionRecord[];
  return <>
    <header className="dashboard-head">
      <p className="account-eyebrow">MY WALLET · ACCOUNT ACTIVITY</p>
      <h1>Transaction history</h1>
      <p>Review your latest 100 recorded wallet entries. All available transactions are simulated while payments remain disabled.</p>
    </header>
    <div className="demo-banner" role="note"><ShieldCheck aria-hidden="true"/><div><strong>Demo transactions only</strong><p>These entries do not represent real deposits, withdrawals or winnings.</p></div></div>
    <section className="dashboard-panel" aria-labelledby="transaction-history-title">
      <div className="panel-heading"><h2 id="transaction-history-title">Recent transactions</h2><Link href="/account"><ArrowLeft size={14}/> Dashboard</Link></div>
      {error ? <p className="empty-copy" role="status">Unable to load transaction history. Please try again later.</p> : rows.length
        ? <div className="transaction-table" role="table" aria-label="Wallet transaction history">
            <div className="table-row table-head" role="row"><span role="columnheader">Date</span><span role="columnheader">Type</span><span role="columnheader">Status</span><span role="columnheader">Amount</span></div>
            {rows.map(row => <div className="table-row" role="row" key={row.id}>
              <span role="cell" data-label="Date">{new Date(row.created_at).toLocaleString('en-ZA')}</span>
              <span role="cell" data-label="Type">{label(row.transaction_type)}{row.simulated ? ' · Demo' : ''}</span>
              <span role="cell" data-label="Status">{label(row.status)}</span>
              <strong role="cell" data-label="Amount">{row.direction === 'credit' ? '+' : '-'}{formatZar(row.amount_minor)}</strong>
            </div>)}
          </div>
        : <div className="empty-state"><History aria-hidden="true"/><h3>No transactions recorded</h3><p>Your simulated wallet activity will appear here when available.</p></div>}
    </section>
  </>;
}
