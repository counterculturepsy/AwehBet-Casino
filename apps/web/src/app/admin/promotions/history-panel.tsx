'use client';

import { useEffect, useRef, useState } from 'react';
import type { CampaignRow, HistoryEvent } from '@/lib/promotions/types';
import { fetchHistory } from './studio-api';
import { actorLabel, describeEvent, failureMessage, formatDateTime } from './studio-logic';

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; events: HistoryEvent[] };

const HISTORY_CAP = 200;

/** Read-only timeline. Re-reads whenever the campaign's version changes, so it never shows a stale story. */
export function HistoryPanel({ campaign, onClose }: { campaign: CampaignRow; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The panel renders below the list, so bring it into view and move focus to it when it opens for a campaign.
  useEffect(() => {
    headingRef.current?.scrollIntoView?.({ block: 'nearest' });
    headingRef.current?.focus();
  }, [campaign.id]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void fetchHistory(campaign.id).then(result => {
      if (cancelled) return;
      setState(result.ok
        ? { status: 'ready', events: result.data.events }
        : { status: 'error', message: failureMessage(result.code) });
    });
    return () => { cancelled = true; };
  }, [campaign.id, campaign.version, attempt]);

  return <section className="dashboard-panel admin-history" aria-labelledby="history-heading">
    <div className="panel-heading">
      <div><p className="account-eyebrow">IMMUTABLE HISTORY</p><h2 id="history-heading" ref={headingRef} tabIndex={-1}>{campaign.title}</h2></div>
      <button type="button" className="admin-btn admin-btn-quiet" onClick={onClose}>Close history</button>
    </div>
    {state.status === 'loading' && <p role="status">Loading history…</p>}
    {state.status === 'error' && <div className="admin-error" role="alert">
      <p>{state.message}</p>
      <button type="button" className="admin-btn admin-btn-quiet" onClick={() => setAttempt(n => n + 1)}>Try again</button>
    </div>}
    {state.status === 'ready' && state.events.length === 0 && <p>No history has been recorded for this campaign yet.</p>}
    {state.status === 'ready' && state.events.length > 0 && <>
      <ol className="admin-timeline" aria-label={`History of ${campaign.title}, newest first`}>
        {state.events.map(event => <li key={event.id}>
          <time dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time>
          <strong>{describeEvent(event)}</strong>
          <span className="admin-muted">{actorLabel(event)}{event.campaign_version ? ` · version ${event.campaign_version}` : ''}</span>
        </li>)}
      </ol>
      {state.events.length >= HISTORY_CAP && <p className="admin-muted">Showing the {HISTORY_CAP} most recent events.</p>}
    </>}
    <p className="admin-muted">History is read-only: events cannot be edited or deleted.</p>
  </section>;
}
