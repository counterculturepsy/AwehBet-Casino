import { BadgeCheck, CircleUserRound, Clock3, ShieldCheck, Wallet } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';

export default async function AdminPage() {
  const { service } = await requireAdmin();
  const [players, wallets, reviews, deposits, withdrawals] = await Promise.all([
    service.from('player_profiles').select('user_id,first_name,last_name,kyc_status,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(15),
    service.from('wallets').select('id', { count: 'exact', head: true }),
    service.from('player_profiles').select('user_id', { count: 'exact', head: true }).in('kyc_status', ['pending','under_review']),
    service.from('deposit_intents').select('id', { count: 'exact', head: true }).eq('simulated', true),
    service.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('simulated', true),
  ]);
  const errors = [players.error, wallets.error, reviews.error, deposits.error, withdrawals.error].filter(Boolean);
  return <>
    <header className="dashboard-head"><p className="account-eyebrow">AWEHBET · ADMINISTRATION</p><h1>Admin Centre</h1><p>Protected, read-only operational overview. Real-money processing and account decisions remain disabled.</p></header>
    <div className="demo-banner"><ShieldCheck aria-hidden="true"/><div><strong>Read-only administration</strong><p>Counts reflect stored records. No balance adjustments, KYC approvals or payouts are available here.</p></div></div>
    {errors.length > 0 && <p className="admin-error" role="alert">Some administration data could not be loaded. Counts may be unavailable.</p>}
    <section className="admin-stats" aria-label="Operational summary">
      <article><CircleUserRound aria-hidden="true"/><span>Player accounts</span><strong>{players.error ? '—' : players.count ?? 0}</strong></article>
      <article><Wallet aria-hidden="true"/><span>Wallets</span><strong>{wallets.error ? '—' : wallets.count ?? 0}</strong></article>
      <article><BadgeCheck aria-hidden="true"/><span>Verification queue</span><strong>{reviews.error ? '—' : reviews.count ?? 0}</strong></article>
      <article><Clock3 aria-hidden="true"/><span>Demo deposit requests</span><strong>{deposits.error ? '—' : deposits.count ?? 0}</strong></article>
      <article><ShieldCheck aria-hidden="true"/><span>Demo withdrawal requests</span><strong>{withdrawals.error ? '—' : withdrawals.count ?? 0}</strong></article>
    </section>
    <section className="dashboard-panel"><div className="panel-heading"><div><p className="account-eyebrow">PLAYER ACCOUNTS</p><h2>Recent registrations</h2></div></div>
      {players.error ? <p className="empty-copy">Player records are temporarily unavailable.</p> : !players.data?.length ? <p className="empty-copy">No player profiles have been created.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Player</th><th scope="col">Verification</th><th scope="col">Registered</th></tr></thead><tbody>
      {players.data.map(player => <tr key={player.user_id}><td>{player.first_name} {player.last_name}</td><td>{player.kyc_status.replace(/_/g, ' ')}</td><td>{new Date(player.created_at).toLocaleDateString('en-ZA')}</td></tr>)}
      </tbody></table></div>}
    </section>
  </>;
}
