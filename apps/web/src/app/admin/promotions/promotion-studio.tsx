'use client';

import { useEffect, useRef, useState } from 'react';
import type { CampaignRow, PromotionAction } from '@/lib/promotions/types';
import { CampaignForm } from './campaign-form';
import { CampaignList } from './campaign-list';
import { HistoryPanel } from './history-panel';
import { createDraft, duplicateCampaign, fetchCampaignById, transitionCampaign, updateDraft } from './studio-api';
import { draftFromCampaign, draftToPayload, failureMessage, filtersFromSearchParams, type CampaignDraft } from './studio-logic';
import { usePromotionList } from './use-promotion-list';

type Feedback = { tone: 'success' | 'error'; text: string } | null;
type Props = { role: 'owner' | 'admin' | 'viewer'; viewerId: string; initialQuery: string };

const DISCARD_PROMPT = 'You have unsaved changes. Discard them?';

export function PromotionStudio({ role, viewerId, initialQuery }: Props) {
  const list = usePromotionList(filtersFromSearchParams(new URLSearchParams(initialQuery)));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<CampaignRow | null>(null);
  const busyRef = useRef(false);
  const dirty = useRef(false);
  const createKey = useRef<string | null>(null);
  const duplicateKeys = useRef<Record<string, string>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasEditing = useRef(false);

  // Role is only used to decide what to render. The database and API authorise every action independently.
  const canWrite = role === 'owner' || role === 'admin';
  // Prefer the freshest copy from the list, falling back to the row captured when history was opened so the
  // panel survives a filter change that moves its campaign off the visible page.
  const historyRow = historyTarget ? list.rows.find(row => row.id === historyTarget.id) ?? historyTarget : null;

  useEffect(() => { if (editing) headingRef.current?.focus(); }, [editing?.id, editKey]);
  // Leaving edit mode unmounts the focused form, so hand focus to the form that replaces it.
  useEffect(() => {
    if (wasEditing.current && !editing) headingRef.current?.focus();
    wasEditing.current = Boolean(editing);
  }, [editing]);

  const succeed = (text: string) => setFeedback({ tone: 'success', text });
  const fail = (text: string) => setFeedback({ tone: 'error', text });

  /** Runs one mutation at a time. The ref closes the gap between two clicks landing before React re-renders. */
  async function perform(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback(null);
    try { await work(); } finally { busyRef.current = false; setBusy(false); }
  }

  /** False when the administrator chooses to keep their unsaved changes. */
  function allowDiscard(): boolean {
    if (!dirty.current) return true;
    if (!window.confirm(DISCARD_PROMPT)) return false;
    dirty.current = false;
    return true;
  }

  function startEditing(row: CampaignRow) {
    // The create form is about to unmount. Retire its key so it can never be reused for different content.
    createKey.current = null;
    dirty.current = false;
    setEditing(row);
    setEditKey(key => key + 1);
    setConflict(false);
  }

  function stopEditing() {
    createKey.current = null;
    dirty.current = false;
    setEditing(null);
    setConflict(false);
  }

  const handleCreate = (draft: CampaignDraft) => perform(async () => {
    const idempotencyKey = (createKey.current ??= crypto.randomUUID());
    const result = await createDraft({ ...draftToPayload(draft), idempotencyKey });
    if (!result.ok) return fail(failureMessage(result.code));
    createKey.current = null;
    dirty.current = false;
    setCreateFormKey(key => key + 1);
    succeed('Draft saved for admin review.');
    await list.reload();
  });

  const handleSave = (draft: CampaignDraft) => perform(async () => {
    if (!editing) return;
    const target = editing;
    const result = await updateDraft(target.id, draftToPayload(draft, target), target.version);
    if (!result.ok) {
      // 409 means someone else changed the campaign (a newer version) or it has left draft. Reloading resolves both.
      if (result.code === 'stale_version' || result.code === 'conflict') setConflict(true);
      else fail(failureMessage(result.code));
      return;
    }
    stopEditing();
    succeed(`Draft saved (version ${result.data.version}).`);
    // The edit can change updated-date ordering or move the row outside an active date filter.
    // Reload page one instead of patching the visible row into a result set it may no longer belong to.
    await list.reload();
  });

  const reloadLatest = () => perform(async () => {
    if (!editing) return;
    const result = await fetchCampaignById(editing.id);
    if (!result.ok) return fail(failureMessage(result.code));
    const latest = result.data;
    if (latest?.allowed_actions.includes('edit')) {
      startEditing(latest);
      await list.reload();
      return succeed('Loaded the latest version. Review it and re-apply your changes.');
    }
    stopEditing();
    await list.reload();
    fail('This campaign can no longer be edited.');
  });

  const handleDuplicate = (row: CampaignRow) => perform(async () => {
    // One key per source until it succeeds, so a retry after a network failure cannot create a second copy.
    const key = (duplicateKeys.current[row.id] ??= crypto.randomUUID());
    const result = await duplicateCampaign(row.id, key);
    if (!result.ok) return fail(failureMessage(result.code));
    delete duplicateKeys.current[row.id];
    succeed(`Created a draft copy of "${row.title}".`);
    await list.reload();
    const copy = await fetchCampaignById(result.data.id);
    // Never replace a form the administrator is still working in.
    if (!dirty.current && copy.ok && copy.data?.allowed_actions.includes('edit')) startEditing(copy.data);
  });

  const handleTransition = (action: 'submit' | 'approve' | 'reject', row: CampaignRow) => perform(async () => {
    // Submit names the version this row was loaded at, so a draft edited by someone else is not submitted unseen.
    const result = action === 'submit'
      ? await transitionCampaign(row.id, 'submit', row.version)
      : await transitionCampaign(row.id, action);
    if (!result.ok) {
      fail(result.code === 'stale_version'
        ? 'This campaign changed after you loaded it. The list has been refreshed; review the latest version, then submit again.'
        : failureMessage(result.code));
    } else succeed('Campaign status updated.');
    if (editing?.id === row.id) stopEditing();
    // Status and updated-time filters may no longer include this row after the transition.
    await list.reload();
  });

  function handleAction(action: PromotionAction, row: CampaignRow) {
    if (action === 'edit') {
      if (!allowDiscard()) return;
      setFeedback(null);
      return startEditing(row);
    }
    if (action === 'duplicate') return void handleDuplicate(row);
    if (editing?.id === row.id && !allowDiscard()) return;
    void handleTransition(action, row);
  }

  return <div className="admin-promotions">
    <header className="dashboard-head"><p className="account-eyebrow">AWEHBET · ADMINISTRATION</p><h1>Promotion Studio</h1>
      <p>Prepare and preview free-to-play campaigns without publishing or changing player balances.</p></header>
    <div className="demo-banner"><div><strong>Draft-only workspace</strong>
      <p>Drafts can be saved for review. Approval does not publish campaigns, schedule delivery, or award credits. Real-money bonuses are unavailable.</p></div></div>

    <section className="dashboard-panel" aria-labelledby="campaign-heading">
      {!canWrite && <><h2 id="campaign-heading">Campaign builder</h2>
        <p>You have view-only access. You can search campaigns and read their history, but not create or change them.</p></>}
      {canWrite && editing && <>
        {conflict && <div className="admin-error" role="alert">
          <p>{failureMessage('stale_version')}</p>
          <button type="button" className="admin-btn" disabled={busy} onClick={() => void reloadLatest()}>Reload latest version</button>
        </div>}
        <CampaignForm key={`edit-${editing.id}-${editKey}`} mode="edit" initial={draftFromCampaign(editing)} busy={busy} headingRef={headingRef}
          note={`Editing version ${editing.version}. Saving is refused if another administrator changes this campaign first.`}
          onSubmit={draft => void handleSave(draft)} onChange={() => { dirty.current = true; }}
          onCancel={() => { if (allowDiscard()) stopEditing(); }} />
      </>}
      {canWrite && !editing && <CampaignForm key={`create-${createFormKey}`} mode="create" busy={busy} headingRef={headingRef}
        onSubmit={draft => void handleCreate(draft)} onChange={() => { createKey.current = null; dirty.current = true; }} />}
    </section>

    {/* Always mounted so assistive technology announces the text when it appears. */}
    <div role="status" aria-live="polite">{feedback?.tone === 'success' && <p className="admin-notice">{feedback.text}</p>}</div>
    {feedback?.tone === 'error' && <p role="alert" className="admin-error">{feedback.text}</p>}

    <CampaignList rows={list.rows} state={list.state} filters={list.filters} viewerId={viewerId} busy={busy}
      hasMore={Boolean(list.nextCursor)} loadingMore={list.loadingMore} moreFailed={list.moreFailed}
      activeId={editing?.id ?? historyTarget?.id ?? null} onApplyFilters={list.applyFilters} onRetry={() => void list.reload()}
      onLoadMore={() => void list.loadMore()} onAction={handleAction} onShowHistory={row => setHistoryTarget(row)} />

    {historyRow && <HistoryPanel campaign={historyRow} onClose={() => setHistoryTarget(null)} />}
  </div>;
}
