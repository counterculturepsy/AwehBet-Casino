import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { AdminHeader, ReadOnlyNotice } from '@/components/admin/parts';
import { buildHref, canSeeContactDetails, formatDateTime, label, parseCursor, parseEventPrefix, parseUuid, shortId } from '@/lib/admin/view';

type Search = Promise<Record<string, string | string[] | undefined>>;
type AuditRow = { id: number; occurred_at: string; event_type: string; entity_type: string | null; entity_id: string | null; actor_user_id: string | null; subject_user_id: string | null; metadata: Record<string, unknown> | null };
const LIMIT = 50;

function metadataSummary(metadata: AuditRow['metadata']): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const text = Object.entries(metadata).slice(0, 6).map(([key, value]) => `${key}: ${typeof value === 'object' ? '…' : String(value)}`).join(' · ');
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Search }) {
  const { service, user, role } = await requireAdmin();
  const params = await searchParams;
  const event = parseEventPrefix(params.event);
  const subject = parseUuid(params.subject);
  const before = parseCursor(params.before);
  const subjectRejected = Boolean(params.subject) && !subject;

  const { data, error } = await service.rpc('admin_list_audit_events', {
    p_actor: user.id, p_event_prefix: event || null, p_subject: subject, p_before_id: before, p_limit: LIMIT + 1,
  });
  const all = (data ?? []) as AuditRow[];
  const rows = all.slice(0, LIMIT);
  const hasMore = all.length > LIMIT;
  const showMetadata = canSeeContactDetails(role);

  return <section className="admin-workspace">
    <AdminHeader eyebrow="COMPLIANCE / AUDIT" title="Audit log">Sensitive account events, newest first.</AdminHeader>
    <ReadOnlyNotice>The audit log cannot be edited or deleted. {showMetadata ? '' : 'Event details are hidden for the viewer role.'}</ReadOnlyNotice>
    <form action="/admin/audit" method="get" className="admin-filters admin-panel" role="search" aria-label="Filter audit events">
      <div className="admin-filters-grid">
        <label>Event type starts with<input name="event" maxLength={60} defaultValue={event} placeholder="e.g. deposit." pattern="[A-Za-z][A-Za-z0-9_.]*" autoCapitalize="none"/></label>
        <label>Player ID<input name="subject" maxLength={36} defaultValue={subject ?? ''} placeholder="Full player UUID" aria-describedby={subjectRejected ? 'audit-subject-error' : undefined} aria-invalid={subjectRejected || undefined} autoCapitalize="none"/></label>
      </div>
      {subjectRejected && <p id="audit-subject-error" className="admin-error" role="alert">That is not a valid player ID, so the player filter was ignored.</p>}
      <div className="admin-filters-actions"><button type="submit" className="admin-btn">Apply filters</button><Link href="/admin/audit" className="admin-btn admin-btn-quiet">Clear</Link></div>
    </form>
    {error ? <p className="admin-error" role="alert">The audit log is unavailable. It needs the admin read-only database migration to be applied.</p> : <div className="admin-panel">
      {rows.length === 0 ? <p className="empty-copy">No audit events match these filters.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-sr-only">Audit events</caption><thead><tr><th scope="col">When</th><th scope="col">Event</th><th scope="col">Player</th><th scope="col" className="admin-hide-small">Actor</th>{showMetadata && <th scope="col" className="admin-hide-small">Details</th>}</tr></thead><tbody>
        {rows.map(row => <tr key={row.id}>
          <td>{formatDateTime(row.occurred_at)}</td>
          <td className="admin-title-cell"><strong>{row.event_type}</strong>{row.entity_type && <span className="admin-meta admin-muted">{label(row.entity_type)}</span>}</td>
          <td className="admin-title-cell">{row.subject_user_id ? <Link className="admin-link" href={`/admin/players/${row.subject_user_id}`}>{shortId(row.subject_user_id)}</Link> : '—'}</td>
          <td className="admin-title-cell admin-hide-small">{!row.actor_user_id ? 'System' : row.actor_user_id === row.subject_user_id ? 'Player' : shortId(row.actor_user_id)}</td>
          {showMetadata && <td className="admin-title-cell admin-hide-small">{metadataSummary(row.metadata) || '—'}</td>}
        </tr>)}
      </tbody></table></div>}
      <nav className="admin-pagination" aria-label="Pagination">
        {before ? <Link className="admin-btn admin-btn-quiet" href={buildHref('/admin/audit', { event, subject })}>Newest</Link> : <span/>}
        {hasMore ? <Link className="admin-btn admin-btn-quiet" rel="next" href={buildHref('/admin/audit', { event, subject, before: rows[rows.length - 1].id })}>Older events</Link> : <span className="admin-muted">End of log</span>}
      </nav>
    </div>}
  </section>;
}
