import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { AdminHeader, LoadError, Pagination, ReadOnlyNotice, StatusBadge } from '@/components/admin/parts';
import { KYC_STATUSES, buildHref, canSeeContactDetails, formatDateTime, label, maskEmail, pageRange, parseEnum, parsePage, sanitizeSearch } from '@/lib/admin/view';

type Search = Promise<Record<string, string | string[] | undefined>>;
type PlayerRow = { user_id: string; first_name: string; last_name: string; email: string; kyc_status: string; country_of_residence: string; created_at: string };

export default async function AdminPlayersPage({ searchParams }: { searchParams: Search }) {
  const { service, role } = await requireAdmin();
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const kyc = parseEnum(params.kyc, KYC_STATUSES);
  const page = parsePage(params.page);
  const { from, to } = pageRange(page);

  let query = service.from('player_profiles')
    .select('user_id,first_name,last_name,email,kyc_status,country_of_residence,created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).range(from, to);
  if (kyc) query = query.eq('kyc_status', kyc);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, count, error } = await query;
  const players = (data ?? []) as PlayerRow[];
  const showContact = canSeeContactDetails(role);
  const filters = { q, kyc };

  return <section className="admin-workspace">
    <AdminHeader eyebrow="OPERATIONS / PLAYERS" title="Players">Search registered players and open a player to see their account.</AdminHeader>
    <ReadOnlyNotice>Player records cannot be edited here. {showContact ? '' : 'Contact details are masked for the viewer role.'}</ReadOnlyNotice>
    <form action="/admin/players" method="get" className="admin-filters admin-panel" role="search" aria-label="Filter players">
      <div className="admin-filters-grid">
        <label>Name or email<input name="q" maxLength={80} defaultValue={q} placeholder="e.g. Thandi"/></label>
        <label>Verification status<select name="kyc" defaultValue={kyc ?? ''}><option value="">All statuses</option>{KYC_STATUSES.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
      </div>
      <div className="admin-filters-actions"><button type="submit" className="admin-btn">Apply filters</button><Link href="/admin/players" className="admin-btn admin-btn-quiet">Clear</Link></div>
    </form>
    {error ? <LoadError what="Player records"/> : <div className="admin-panel">
      <p className="admin-muted" role="status">{count ?? 0} {count === 1 ? 'player' : 'players'} found</p>
      {players.length === 0 ? <p className="empty-copy">No players match these filters.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-sr-only">Players</caption><thead><tr><th scope="col">Player</th><th scope="col">Email</th><th scope="col" className="admin-hide-small">Country</th><th scope="col">Verification</th><th scope="col" className="admin-hide-small">Registered</th></tr></thead><tbody>
        {players.map(player => <tr key={player.user_id}>
          <td className="admin-title-cell"><Link className="admin-link" href={`/admin/players/${player.user_id}`}>{player.first_name} {player.last_name}</Link></td>
          <td className="admin-title-cell">{showContact ? player.email : maskEmail(player.email)}</td>
          <td className="admin-hide-small">{player.country_of_residence}</td>
          <td><StatusBadge status={player.kyc_status}/></td>
          <td className="admin-hide-small">{formatDateTime(player.created_at)}</td>
        </tr>)}
      </tbody></table></div>}
      <Pagination path="/admin/players" params={filters} page={page} total={count}/>
    </div>}
    <p className="admin-muted"><Link className="admin-link" href={buildHref('/admin/verification', {})}>Go to the verification queue</Link></p>
  </section>;
}
