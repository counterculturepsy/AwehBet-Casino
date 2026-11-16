import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { AdminHeader, LoadError, Pagination, ReadOnlyNotice, StatusBadge } from '@/components/admin/parts';
import { DEPOSIT_STATUSES, WITHDRAWAL_STATUSES, buildHref, formatDateTime, formatMinor, label, pageRange, parseEnum, parsePage, shortId } from '@/lib/admin/view';

type Search = Promise<Record<string, string | string[] | undefined>>;
type Row = { id: string; user_id: string; amount_minor: number; status: string; simulated: boolean; created_at: string; method?: string; reference?: string };
const TYPES = ['deposits', 'withdrawals'] as const;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Search }) {
  const { service } = await requireAdmin();
  const params = await searchParams;
  const type = parseEnum(params.type, TYPES) ?? 'deposits';
  const statuses: readonly string[] = type === 'deposits' ? DEPOSIT_STATUSES : WITHDRAWAL_STATUSES;
  const status = parseEnum(params.status, statuses);
  const page = parsePage(params.page);
  const { from, to } = pageRange(page);

  let query = type === 'deposits'
    ? service.from('deposit_intents').select('id,user_id,method,amount_minor,status,reference,simulated,created_at', { count: 'exact' })
    : service.from('withdrawal_requests').select('id,user_id,amount_minor,status,simulated,created_at', { count: 'exact' });
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  const rows = (data ?? []) as Row[];

  const ids = [...new Set(rows.map(row => row.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const profiles = await service.from('player_profiles').select('user_id,first_name,last_name').in('user_id', ids);
    for (const profile of profiles.data ?? []) names.set(profile.user_id, `${profile.first_name} ${profile.last_name}`);
  }
  const awaiting = type === 'withdrawals' ? ['pending', 'under_review'] : ['pending'];
  const queue = await (type === 'deposits' ? service.from('deposit_intents') : service.from('withdrawal_requests')).select('id', { count: 'exact', head: true }).in('status', awaiting);

  return <section className="admin-workspace">
    <AdminHeader eyebrow="OPERATIONS / PAYMENTS" title="Payments">Deposit and withdrawal requests, newest first.</AdminHeader>
    <ReadOnlyNotice>Requests cannot be approved, rejected or paid from here. Payments are simulated until a payment provider is live.</ReadOnlyNotice>
    <nav className="admin-tabs" aria-label="Payment type">{TYPES.map(item => <Link key={item} href={buildHref('/admin/payments', { type: item })} aria-current={item === type ? 'page' : undefined}>{label(item)}</Link>)}</nav>
    <form action="/admin/payments" method="get" className="admin-filters admin-panel" aria-label="Filter payments">
      <input type="hidden" name="type" value={type}/>
      <div className="admin-filters-grid"><label>Status<select name="status" defaultValue={status ?? ''}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{label(item)}</option>)}</select></label></div>
      <div className="admin-filters-actions"><button type="submit" className="admin-btn">Apply filter</button><Link href={buildHref('/admin/payments', { type })} className="admin-btn admin-btn-quiet">Clear</Link></div>
    </form>
    {error ? <LoadError what="Payment requests"/> : <div className="admin-panel">
      <p className="admin-muted" role="status">{count ?? 0} {type === 'deposits' ? 'deposit' : 'withdrawal'} {count === 1 ? 'request' : 'requests'}{status ? ` with status ${label(status)}` : ''}{queue.error ? '' : ` · ${queue.count ?? 0} awaiting a decision`}</p>
      {rows.length === 0 ? <p className="empty-copy">No {type} match this filter.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-sr-only">{label(type)}</caption><thead><tr><th scope="col">{type === 'deposits' ? 'Reference' : 'Request'}</th><th scope="col">Player</th>{type === 'deposits' && <th scope="col" className="admin-hide-small">Method</th>}<th scope="col">Amount</th><th scope="col">Status</th><th scope="col" className="admin-hide-small">Created</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}>
          <td className="admin-title-cell">{type === 'deposits' ? row.reference : shortId(row.id)}{row.simulated && <span className="admin-meta admin-muted">Demo</span>}</td>
          <td className="admin-title-cell"><Link className="admin-link" href={`/admin/players/${row.user_id}`}>{names.get(row.user_id) ?? shortId(row.user_id)}</Link></td>
          {type === 'deposits' && <td className="admin-hide-small">{label(row.method)}</td>}
          <td>{formatMinor(row.amount_minor)}</td>
          <td><StatusBadge status={row.status}/></td>
          <td className="admin-hide-small">{formatDateTime(row.created_at)}</td>
        </tr>)}
      </tbody></table></div>}
      <Pagination path="/admin/payments" params={{ type, status }} page={page} total={count}/>
    </div>}
  </section>;
}
