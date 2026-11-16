import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { AdminHeader, LoadError, Pagination, ReadOnlyNotice, StatusBadge } from '@/components/admin/parts';
import { buildHref, formatDateTime, label, pageRange, parseEnum, parsePage, shortId } from '@/lib/admin/view';

type Search = Promise<Record<string, string | string[] | undefined>>;
type QueueRow = { user_id: string; first_name: string; last_name: string; kyc_status: string; created_at: string; updated_at: string };
type ReviewRow = { id: string; user_id: string; status: string; provider: string | null; reason_code: string | null; created_at: string; decided_at: string | null };
const QUEUE = ['pending', 'under_review'] as const;

export default async function AdminVerificationPage({ searchParams }: { searchParams: Search }) {
  const { service, user } = await requireAdmin();
  const params = await searchParams;
  const status = parseEnum(params.status, QUEUE);
  const page = parsePage(params.page);
  const { from, to } = pageRange(page);

  const [queue, reviews] = await Promise.all([
    service.from('player_profiles').select('user_id,first_name,last_name,kyc_status,created_at,updated_at', { count: 'exact' })
      .in('kyc_status', status ? [status] : [...QUEUE]).order('created_at', { ascending: true }).range(from, to),
    service.rpc('admin_list_kyc_reviews', { p_actor: user.id, p_limit: 20 }),
  ]);
  const rows = (queue.data ?? []) as QueueRow[];
  const recent = (reviews.data ?? []) as ReviewRow[];

  return <section className="admin-workspace">
    <AdminHeader eyebrow="COMPLIANCE / VERIFICATION" title="Verification queue">Players waiting for identity verification, earliest registration first.</AdminHeader>
    <ReadOnlyNotice>Verification decisions cannot be made here. Identity documents and ID numbers are never shown in the admin panel.</ReadOnlyNotice>
    <nav className="admin-tabs" aria-label="Queue status">
      <Link href="/admin/verification" aria-current={!status ? 'page' : undefined}>All waiting</Link>
      {QUEUE.map(item => <Link key={item} href={buildHref('/admin/verification', { status: item })} aria-current={status === item ? 'page' : undefined}>{label(item)}</Link>)}
    </nav>
    {queue.error ? <LoadError what="The verification queue"/> : <div className="admin-panel">
      <p className="admin-muted" role="status">{queue.count ?? 0} {queue.count === 1 ? 'player' : 'players'} waiting</p>
      {rows.length === 0 ? <p className="empty-copy">Nobody is waiting for verification.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-sr-only">Players waiting for verification</caption><thead><tr><th scope="col">Player</th><th scope="col">Status</th><th scope="col">Registered</th><th scope="col" className="admin-hide-small">Profile last changed</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.user_id}><td className="admin-title-cell"><Link className="admin-link" href={`/admin/players/${row.user_id}`}>{row.first_name} {row.last_name}</Link></td><td><StatusBadge status={row.kyc_status}/></td><td>{formatDateTime(row.created_at)}</td><td className="admin-hide-small">{formatDateTime(row.updated_at)}</td></tr>)}
      </tbody></table></div>}
      <p className="admin-muted">The database does not yet record when a player entered the verification queue, so the list is ordered by registration date. A profile edit does not move a player in this list.</p>
      <Pagination path="/admin/verification" params={{ status }} page={page} total={queue.count}/>
    </div>}
    <section className="admin-panel" aria-labelledby="recent-reviews"><h2 id="recent-reviews">Latest review records</h2>
      {reviews.error ? <p className="admin-muted" role="status">Review records are unavailable until the admin read-only database migration is applied.</p> : recent.length === 0 ? <p className="empty-copy">No review records yet.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Player</th><th scope="col">Outcome</th><th scope="col" className="admin-hide-small">Provider</th><th scope="col" className="admin-hide-small">Reason</th><th scope="col">Recorded</th></tr></thead><tbody>
        {recent.map(row => <tr key={row.id}><td className="admin-title-cell"><Link className="admin-link" href={`/admin/players/${row.user_id}`}>{shortId(row.user_id)}</Link></td><td><StatusBadge status={row.status}/></td><td className="admin-hide-small">{row.provider ?? '—'}</td><td className="admin-hide-small">{label(row.reason_code)}</td><td>{formatDateTime(row.created_at)}</td></tr>)}
      </tbody></table></div>}
    </section>
  </section>;
}
