'use client';

import { useMemo, useState, type Ref } from 'react';
import type { CampaignKind } from '@/lib/promotions/constants';
import { NEW_DRAFT, validateDraft, type CampaignDraft } from './studio-logic';

type Props = {
  mode: 'create' | 'edit';
  initial?: CampaignDraft;
  busy: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  /** Shown in edit mode, e.g. which version the editor is working from. */
  note?: string;
  onSubmit: (draft: CampaignDraft) => void;
  /** Called on every edit so the parent can retire a retry-stable idempotency key. */
  onChange?: () => void;
  onCancel?: () => void;
};

export function CampaignForm({ mode, initial = NEW_DRAFT, busy, headingRef, note, onSubmit, onChange, onCancel }: Props) {
  const [draft, setDraft] = useState<CampaignDraft>(initial);
  const [preview, setPreview] = useState<CampaignDraft | null>(null);
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const editing = mode === 'edit';

  function update(patch: Partial<CampaignDraft>) {
    setDraft(previous => ({ ...previous, ...patch }));
    onChange?.();
  }

  return <>
    <div className="panel-heading"><div>
      <p className="account-eyebrow">{editing ? 'EDIT DRAFT' : 'CAMPAIGN BUILDER'}</p>
      <h2 id="campaign-heading" ref={headingRef} tabIndex={-1}>{editing ? 'Edit draft' : 'Create a draft'}</h2>
      {note && <p className="admin-muted">{note}</p>}
    </div></div>
    <form className="admin-campaign-form" onSubmit={event => { event.preventDefault(); if (!errors.length) setPreview({ ...draft }); }}>
      <label>Campaign type
        <select value={draft.kind} onChange={event => update({ kind: event.target.value as CampaignKind })}>
          <option value="banner">Promotional banner</option>
          <option value="demo-credit">Virtual-credit concept</option>
        </select>
      </label>
      <label>Title<input maxLength={100} required value={draft.title} onChange={event => update({ title: event.target.value })} /></label>
      <label>Description<textarea maxLength={300} required rows={4} value={draft.description} onChange={event => update({ description: event.target.value })} /></label>
      <div className="admin-campaign-dates">
        <label>Proposed start<input type="datetime-local" value={draft.start} onChange={event => update({ start: event.target.value })} /></label>
        <label>Proposed end<input type="datetime-local" value={draft.end} onChange={event => update({ end: event.target.value })} /></label>
      </div>
      {draft.kind === 'demo-credit' && <label>Proposed virtual credits
        <input type="number" min={1} max={100000} step={1} value={draft.credits} onChange={event => update({ credits: Number(event.target.value) })} />
      </label>}
      {!editing && <label className="admin-campaign-check">
        <input type="checkbox" checked={draft.enabled} onChange={event => update({ enabled: event.target.checked })} /> Mark draft as ready for review (does not publish)
      </label>}
      {/* A polite status region, not an alert: an alert would be re-announced on every keystroke while a field is invalid. */}
      {errors.length > 0 && <div className="admin-error" role="status">{errors.map(error => <p key={error}>{error}</p>)}</div>}
      <div className="admin-form-actions">
        <button type="submit" disabled={errors.length > 0}>Preview draft</button>
        <button type="button" disabled={errors.length > 0 || busy} onClick={() => onSubmit(draft)}>
          {editing ? 'Save changes' : 'Save draft to Supabase'}
        </button>
        {editing && onCancel && <button type="button" disabled={busy} onClick={onCancel}>Cancel editing</button>}
      </div>
    </form>
    {preview && <section className="admin-campaign-preview" aria-label="Campaign preview">
      <p className="account-eyebrow">UNPUBLISHED PREVIEW · {preview.kind === 'banner' ? 'BANNER' : 'VIRTUAL CREDITS'}</p>
      <h3>{preview.title}</h3>
      <p>{preview.description}</p>
      {preview.kind === 'demo-credit' && <p>Proposed demo credits: {preview.credits.toLocaleString('en-ZA')}</p>}
      {!editing && <p>Review status: {preview.enabled ? 'Ready for review' : 'Draft'}</p>}
      {(preview.start || preview.end) && <p>Proposed window: {preview.start || 'Unspecified'} – {preview.end || 'Unspecified'}</p>}
    </section>}
  </>;
}
