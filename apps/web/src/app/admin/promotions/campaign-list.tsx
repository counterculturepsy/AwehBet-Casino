'use client';

import { useState } from 'react';
import type { CampaignRow, PromotionAction } from '@/lib/promotions/types';
import {
  ACTION_LABELS, DEFAULT_FILTERS, filterIssues, formatDateTime, hasActiveFilters, shortId, statusClass, visibleActions,
  type Filters,
} from './studio-logic';
import type { ListState } from './use-promotion-list';

type Props = {
  rows: CampaignRow[];
  state: ListState;
  filters: Filters;
  viewerId: string;
  busy: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  activeId: string | null;
  onApplyFilters: (filters: Filters) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onAction: (action: PromotionAction, row: CampaignRow) => void;
  onShowHistory: (row: CampaignRow) => void;
};

function FilterForm({ filters, onApply }: { filters: Filters; onApply: (filters: Filters) => void }) {
  const [draft, setDraft] = useState<Filters>(filters);
  const issues = filterIssues(draft);
  const set = (patch: Partial<Filters>) => setDraft(previous => ({ ...previous, ...patch }));
  return <form className="admin-filters" aria-label="Filter campaigns" onSubmit={event => { event.preventDefault(); if (!issues.length) onApply(draft); }}>
    <div className="admin-filters-grid">
      <label>Search<input type="search" maxLength={80} value={draft.search} placeholder="Title, description or id" onChange={event => set({ search: event.target.value })} /></label>
      <label>Status<select value={draft.status} onChange={event => set({ status: event.target.value as Filters['status'] })}>
        <option value="">Any status</option><option value="draft">Draft</option><option value="submitted">Submitted</option>
        <option value="approved">Approved</option><option value="rejected">Rejected</option>
      </select></label>
      <label>Type<select value={draft.kind} onChange={event => set({ kind: event.target.value as Filters['kind'] })}>
        <option value="">Any type</option><option value="banner">Promotional banner</option><option value="demo-credit">Virtual-credit concept</option>
      </select></label>
      <label>Sort<select value={draft.sort} onChange={event => set({ sort: event.target.value as Filters['sort'] })}>
        <option value="created_desc">Newest created</option><option value="created_asc">Oldest created</option>
        <option value="updated_desc">Recently updated</option><option value="updated_asc">Least recently updated</option>
      </select></label>
      <label>Created from<input type="date" value={draft.createdFrom} onChange={event => set({ createdFrom: event.target.value })} /></label>
      <label>Created to<input type="date" value={draft.createdTo} onChange={event => set({ createdTo: event.target.value })} /></label>
      <label>Updated from<input type="date" value={draft.updatedFrom} onChange={event => set({ updatedFrom: event.target.value })} /></label>
      <label>Updated to<input type="date" value={draft.updatedTo} onChange={event => set({ updatedTo: event.target.value })} /></label>
    </div>
    {issues.length > 0 && <div className="admin-error" role="status">{issues.map(issue => <p key={issue}>{issue}</p>)}</div>}
    <div className="admin-filters-actions">
      <button type="submit" className="admin-btn" disabled={issues.length > 0}>Apply filters</button>
      <button type="button" className="admin-btn admin-btn-quiet" onClick={() => { setDraft(DEFAULT_FILTERS); onApply(DEFAULT_FILTERS); }}>Clear filters</button>
    </div>
  </form>;
}

export function CampaignList(props: Props) {
  const { rows, state, filters, viewerId, busy, hasMore, loadingMore, moreFailed, activeId } = props;
  const filtered = hasActiveFilters(filters);
  const summary = state === 'loading' && rows.length === 0
    ? 'Loading campaigns…'
    : `Showing ${rows.length} campaign${rows.length === 1 ? '' : 's'}${hasMore ? ' — more available' : ''}.`;

  return <section className="dashboard-panel admin-results" aria-labelledby="campaigns-heading">
    <h2 id="campaigns-heading">Campaigns</h2>
    {/* Remounting on apply keeps the form in step with filters restored from the URL or cleared elsewhere. */}
    <FilterForm key={JSON.stringify(filters)} filters={filters} onApply={props.onApplyFilters} />
    <p role="status" aria-live="polite" className="admin-muted">{state === 'ready' || rows.length > 0 || state === 'loading' ? summary : ''}</p>

    {state === 'forbidden' && <div className="admin-error" role="alert"><p>You do not have access to campaigns.</p></div>}
    {state === 'error' && <div className="admin-error" role="alert">
      <p>Unable to load campaigns. Check admin access and migrations.</p>
      <button type="button" className="admin-btn admin-btn-quiet" onClick={props.onRetry}>Try again</button>
    </div>}
    {state === 'ready' && rows.length === 0 && <p>{filtered ? 'No campaigns match these filters.' : 'No campaigns available.'}</p>}

    {rows.length > 0 && <div className="admin-table-wrap"><table className="admin-table" aria-busy={state === 'loading'}>
      <thead><tr><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col" className="admin-hide-small">Updated</th><th scope="col">Actions</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} aria-current={row.id === activeId ? 'true' : undefined}>
        <td className="admin-title-cell">
          <strong>{row.title}</strong>
          <span className="admin-muted admin-meta">
            {row.kind === 'banner' ? 'Banner' : 'Virtual credits'} · {row.created_by === viewerId ? 'Created by you' : `Created by ${shortId(row.created_by)}`}
            {row.duplicated_from && ` · Copy of ${shortId(row.duplicated_from)}`} · v{row.version}
          </span>
        </td>
        <td><span className={statusClass(row.status)}>{row.status}</span></td>
        <td className="admin-hide-small"><time dateTime={row.updated_at}>{formatDateTime(row.updated_at)}</time></td>
        <td><div className="admin-row-actions">
          {visibleActions(row).map(action => <button key={action} type="button" className="admin-btn" disabled={busy}
            aria-label={`${ACTION_LABELS[action]}: ${row.title}`} onClick={() => props.onAction(action, row)}>{ACTION_LABELS[action]}</button>)}
          <button type="button" className="admin-btn admin-btn-quiet" aria-label={`History: ${row.title}`} onClick={() => props.onShowHistory(row)}>History</button>
        </div></td>
      </tr>)}</tbody>
    </table></div>}

    {hasMore && <div className="admin-filters-actions">
      <button type="button" className="admin-btn admin-btn-quiet" disabled={loadingMore} onClick={props.onLoadMore}>{loadingMore ? 'Loading…' : 'Load more campaigns'}</button>
    </div>}
    {moreFailed && <div className="admin-error" role="alert"><p>Unable to load more campaigns. Try again.</p></div>}
    <p className="admin-muted">Approvals require a separate owner account. Creators cannot approve their own campaigns. No campaign is publicly published.</p>
  </section>;
}
