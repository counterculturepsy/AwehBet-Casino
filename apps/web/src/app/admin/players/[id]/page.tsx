import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { AdminHeader, LoadError, ReadOnlyNotice, StatusBadge } from '@/components/admin/parts';
import { canSeeContactDetails, formatDateTime, formatMinor, label, maskEmail, maskPhone, parseUuid, shortId } from '@/lib/admin/view';

type AuditRow = { id: number; occurred_at: string; event_type: string; entity_type: string | null };
type KycRow = { id: string; status: string; provider: string | null; reason_code: string | null; created_at: string; decided_at: string | null };

export default async function AdminPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { service, role, user } = await requireAdmin();
  const id = parseUuid((await params).id);
  if (!id) notFound();

  const [profile, wallet, limits, deposits, withdrawals, audit, reviews] = await Promise.all([
    service.from('player_profiles').select('user_id,first_name,last_name,email,mobile_phone,country_of_residence,kyc_status,marketing_consent,created_at,updated_at').eq('user_id', id).maybeSingle(),
    service.from('wallets').select('available_minor,pending_minor,status,simulated,currency').eq('user_id', id).maybeSingle(),
    service.from('responsible_gaming_settings').select('daily_deposit_limit_minor,weekly_deposit_limit_minor,monthly_deposit_limit_minor,cooling_off_until,self_excluded_at,self_exclusion_until').eq('user_id', id).maybeSingle(),
    service.from('deposit_intents').select('id,method,amount_minor,status,reference,simulated,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    service.from('withdrawal_requests').select('id,amount_minor,status,simulated,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    service.rpc('admin_list_audit_events', { p_actor: user.id, p_subject: id, p_limit: 15 }),
    service.rpc('admin_list_kyc_reviews', { p_actor: user.id, p_subject: id, p_limit: 10 }),
  ]);
  if (profile.error) return <section className="admin-workspace"><AdminHeader eyebrow="OPERATIONS / PLAYERS" title="Player"/><LoadError what="This player"/></section>;
  if (!profile.data) notFound();
  const player = profile.data;
  const showContact = canSeeContactDetails(role);
  const rg = limits.data;
  const excluded = Boolean(rg?.self_excluded_at) && (!rg?.self_exclusion_until || new Date(rg.self_exclusion_until) > new Date());
  const coolingOff = Boolean(rg?.cooling_off_until) && new Date(rg!.cooling_off_until!) > new Date();

  return <section className="admin-workspace">
    <p><Link className="admin-link" href="/admin/players">← All players</Link></p>
    <AdminHeader eyebrow="OPERATIONS / PLAYERS" title={`${player.first_name} ${player.last_name}`}>Player ID {shortId(player.user_id)} · registered {formatDateTime(player.created_at)}</AdminHeader>
    <ReadOnlyNotice>No verification decisions, balance changes or payouts can be made from this page.</ReadOnlyNotice>
    {(excluded || coolingOff) && <p className="admin-error" role="status">{excluded ? 'This player is self-excluded.' : 'This player is in a cooling-off period.'}</p>}
    <div className="admin-detail-grid">
      <section className="admin-panel" aria-labelledby="player-profile"><h2 id="player-profile">Profile</h2><dl className="admin-dl">
        <div><dt>Email</dt><dd>{showContact ? player.email : maskEmail(player.email)}</dd></div>
        <div><dt>Mobile</dt><dd>{showContact ? player.mobile_phone : maskPhone(player.mobile_phone)}</dd></div>
        <div><dt>Country</dt><dd>{player.country_of_residence}</dd></div>
        <div><dt>Verification</dt><dd><StatusBadge status={player.kyc_status}/></dd></div>
        <div><dt>Marketing consent</dt><dd>{player.marketing_consent ? 'Yes' : 'No'}</dd></div>
        <div><dt>Profile updated</dt><dd>{formatDateTime(player.updated_at)}</dd></div>
      </dl></section>
      <section className="admin-panel" aria-labelledby="player-wallet"><h2 id="player-wallet">Wallet</h2>
        {wallet.error ? <LoadError what="Wallet"/> : !wallet.data ? <p className="empty-copy">No wallet exists for this player.</p> : <dl className="admin-dl">
          <div><dt>Available</dt><dd>{formatMinor(wallet.data.available_minor)}</dd></div>
          <div><dt>Pending</dt><dd>{formatMinor(wallet.data.pending_minor)}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge status={wallet.data.status}/></dd></div>
          <div><dt>Funds</dt><dd>{wallet.data.simulated ? 'Simulated (demo)' : 'Real money'}</dd></div>
        </dl>}
      </section>
      <section className="admin-panel" aria-labelledby="player-limits"><h2 id="player-limits">Responsible gaming</h2>
        {limits.error ? <LoadError what="Limits"/> : !rg ? <p className="empty-copy">No limits recorded.</p> : <dl className="admin-dl">
          <div><dt>Daily deposit limit</dt><dd>{rg.daily_deposit_limit_minor === null ? 'Not set' : formatMinor(rg.daily_deposit_limit_minor)}</dd></div>
          <div><dt>Weekly deposit limit</dt><dd>{rg.weekly_deposit_limit_minor === null ? 'Not set' : formatMinor(rg.weekly_deposit_limit_minor)}</dd></div>
          <div><dt>Monthly deposit limit</dt><dd>{rg.monthly_deposit_limit_minor === null ? 'Not set' : formatMinor(rg.monthly_deposit_limit_minor)}</dd></div>
          <div><dt>Cooling off until</dt><dd>{formatDateTime(rg.cooling_off_until)}</dd></div>
          <div><dt>Self-excluded</dt><dd>{rg.self_excluded_at ? `${formatDateTime(rg.self_excluded_at)}${rg.self_exclusion_until ? ` until ${formatDateTime(rg.self_exclusion_until)}` : ' (no end date)'}` : 'No'}</dd></div>
        </dl>}
      </section>
    </div>
    <section className="admin-panel" aria-labelledby="player-deposits"><h2 id="player-deposits">Recent deposit requests</h2>
      {deposits.error ? <LoadError what="Deposit requests"/> : !deposits.data?.length ? <p className="empty-copy">No deposit requests.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Reference</th><th scope="col">Method</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead><tbody>
        {deposits.data.map(row => <tr key={row.id}><td className="admin-title-cell">{row.reference}{row.simulated && <span className="admin-meta admin-muted">Demo</span>}</td><td>{label(row.method)}</td><td>{formatMinor(row.amount_minor)}</td><td><StatusBadge status={row.status}/></td><td>{formatDateTime(row.created_at)}</td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="admin-panel" aria-labelledby="player-withdrawals"><h2 id="player-withdrawals">Recent withdrawal requests</h2>
      {withdrawals.error ? <LoadError what="Withdrawal requests"/> : !withdrawals.data?.length ? <p className="empty-copy">No withdrawal requests.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Request</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead><tbody>
        {withdrawals.data.map(row => <tr key={row.id}><td className="admin-title-cell">{shortId(row.id)}{row.simulated && <span className="admin-meta admin-muted">Demo</span>}</td><td>{formatMinor(row.amount_minor)}</td><td><StatusBadge status={row.status}/></td><td>{formatDateTime(row.created_at)}</td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="admin-panel" aria-labelledby="player-kyc"><h2 id="player-kyc">Verification history</h2>
      {reviews.error ? <p className="admin-muted" role="status">Verification history is unavailable until the admin read-only database migration is applied.</p> : !(reviews.data as KycRow[] | null)?.length ? <p className="empty-copy">No verification reviews recorded.</p> :
      <ul className="admin-timeline">{(reviews.data as KycRow[]).map(row => <li key={row.id}><strong><StatusBadge status={row.status}/></strong><span>{row.provider ? `Provider: ${row.provider}` : 'No provider recorded'}{row.reason_code ? ` · reason: ${label(row.reason_code)}` : ''}</span><time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time></li>)}</ul>}
    </section>
    <section className="admin-panel" aria-labelledby="player-audit"><h2 id="player-audit">Recent account events</h2>
      {audit.error ? <p className="admin-muted" role="status">Account events are unavailable until the admin read-only database migration is applied.</p> : !(audit.data as AuditRow[] | null)?.length ? <p className="empty-copy">No events recorded for this player.</p> :
      <ul className="admin-timeline">{(audit.data as AuditRow[]).map(row => <li key={row.id}><strong>{row.event_type}</strong>{row.entity_type && <span>{label(row.entity_type)}</span>}<time dateTime={row.occurred_at}>{formatDateTime(row.occurred_at)}</time></li>)}</ul>}
      <p><Link className="admin-link" href={`/admin/audit?subject=${player.user_id}`}>Open full audit log for this player</Link></p>
    </section>
  </section>;
}
