'use client';

import { useEffect, useMemo, useState } from 'react';

type CampaignKind = 'banner' | 'demo-credit';
type Campaign = { title: string; description: string; kind: CampaignKind; start: string; end: string; credits: number; enabled: boolean };

const initial: Campaign = { title: 'Welcome to AwehBet', description: 'Explore our free-to-play demo experience.', kind: 'banner', start: '', end: '', credits: 0, enabled: false };

export default function PromotionsPage() {
  const [campaign, setCampaign] = useState<Campaign>(initial);
  const [preview, setPreview] = useState<Campaign | null>(null);
  const [saved, setSaved] = useState<Array<{id:string;title:string;status:string;kind:string}>>([]);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const response = await fetch('/api/admin/promotions', { cache: 'no-store' });
      if (!response.ok) { setFeedback('Unable to load saved campaigns. Check admin access and migrations.'); return; }
      const result = await response.json();
      setSaved(result.campaigns ?? []);
    } catch { setFeedback('Unable to reach the campaign service.'); }
  }
  useEffect(() => { void refresh(); }, []);
  async function saveDraft() {
    if (errors.length || busy) return;
    setBusy(true); setFeedback('');
    try {
      const response = await fetch('/api/admin/promotions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: campaign.title, description: campaign.description, kind: campaign.kind,
          credits: campaign.kind === 'banner' ? 0 : campaign.credits,
          start: campaign.start ? new Date(campaign.start).toISOString() : null,
          end: campaign.end ? new Date(campaign.end).toISOString() : null }),
      });
      setFeedback(response.ok ? 'Draft saved for admin review.' : 'Draft could not be saved.');
      if (response.ok) await refresh();
    } catch { setFeedback('Unable to save draft.'); }
    finally { setBusy(false); }
  }
  async function transition(id: string, action: 'submit'|'approve'|'reject') {
    if (busy) return;
    setBusy(true); setFeedback('');
    try {
      const response = await fetch('/api/admin/promotions/transition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
      setFeedback(response.ok ? 'Campaign status updated.' : 'Action not permitted for this campaign or role.');
      if (response.ok) await refresh();
    } catch { setFeedback('Unable to update campaign.'); }
    finally { setBusy(false); }
  }
  const errors = useMemo(() => {
    const issues: string[] = [];
    if (!campaign.title.trim() || campaign.title.length > 100) issues.push('Enter a title of 1–100 characters.');
    if (!campaign.description.trim() || campaign.description.length > 300) issues.push('Enter a description of 1–300 characters.');
    if (campaign.start && campaign.end && campaign.end <= campaign.start) issues.push('End date must be after the start date.');
    if (campaign.kind === 'demo-credit' && (!Number.isSafeInteger(campaign.credits) || campaign.credits < 1 || campaign.credits > 100000)) issues.push('Virtual credit amount must be between 1 and 100,000.');
    return issues;
  }, [campaign]);

  return <div>
    <header className="dashboard-head"><p className="account-eyebrow">AWEHBET · ADMINISTRATION</p><h1>Promotion Studio</h1><p>Prepare and preview free-to-play campaigns without publishing or changing player balances.</p></header>
    <div className="demo-banner"><div><strong>Draft-only workspace</strong><p>Drafts can be saved for review. Approval does not publish campaigns, schedule delivery, or award credits. Real-money bonuses are unavailable.</p></div></div>
    <section className="dashboard-panel" aria-labelledby="campaign-heading">
      <div className="panel-heading"><div><p className="account-eyebrow">CAMPAIGN BUILDER</p><h2 id="campaign-heading">Create a draft</h2></div></div>
      <form className="admin-campaign-form" onSubmit={event => { event.preventDefault(); if (!errors.length) setPreview({ ...campaign }); }}>
        <label>Campaign type<select value={campaign.kind} onChange={event => setCampaign({ ...campaign, kind: event.target.value as CampaignKind })}><option value="banner">Promotional banner</option><option value="demo-credit">Virtual-credit concept</option></select></label>
        <label>Title<input maxLength={100} required value={campaign.title} onChange={event => setCampaign({ ...campaign, title: event.target.value })}/></label>
        <label>Description<textarea maxLength={300} required rows={4} value={campaign.description} onChange={event => setCampaign({ ...campaign, description: event.target.value })}/></label>
        <div className="admin-campaign-dates"><label>Proposed start<input type="datetime-local" value={campaign.start} onChange={event => setCampaign({ ...campaign, start: event.target.value })}/></label><label>Proposed end<input type="datetime-local" value={campaign.end} onChange={event => setCampaign({ ...campaign, end: event.target.value })}/></label></div>
        {campaign.kind === 'demo-credit' && <label>Proposed virtual credits<input type="number" min={1} max={100000} step={1} value={campaign.credits} onChange={event => setCampaign({ ...campaign, credits: Number(event.target.value) })}/></label>}
        <label className="admin-campaign-check"><input type="checkbox" checked={campaign.enabled} onChange={event => setCampaign({ ...campaign, enabled: event.target.checked })}/> Mark draft as ready for review (does not publish)</label>
        {errors.length > 0 && <div className="admin-error" role="alert">{errors.map(error => <p key={error}>{error}</p>)}</div>}
        <button type="submit" disabled={errors.length > 0}>Preview draft</button><button type="button" disabled={errors.length > 0 || busy} onClick={() => void saveDraft()}>Save draft to Supabase</button>
      </form>
    </section>
    {feedback && <p role="status" className="admin-error">{feedback}</p>}
    <section className="dashboard-panel" aria-label="Saved campaigns"><h2>Saved campaigns</h2>
      {saved.length === 0 ? <p>No campaigns available.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Campaign</th><th>Type</th><th>Status</th><th>Review</th></tr></thead><tbody>
      {saved.map(item => <tr key={item.id}><td>{item.title}</td><td>{item.kind}</td><td>{item.status}</td><td>
        {item.status === 'draft' && <button type="button" disabled={busy} onClick={() => void transition(item.id,'submit')}>Submit</button>}
        {item.status === 'submitted' && <><button type="button" disabled={busy} onClick={() => void transition(item.id,'approve')}>Approve</button>{' '}<button type="button" disabled={busy} onClick={() => void transition(item.id,'reject')}>Reject</button></>}
      </td></tr>)}
      </tbody></table></div>}
      <p>Approvals require a separate owner account. Creators cannot approve their own campaigns. No campaign is publicly published.</p>
    </section>
    {preview && <section className="dashboard-panel admin-campaign-preview" aria-label="Campaign preview"><p className="account-eyebrow">UNPUBLISHED PREVIEW · {preview.kind === 'banner' ? 'BANNER' : 'VIRTUAL CREDITS'}</p><h2>{preview.title}</h2><p>{preview.description}</p>{preview.kind === 'demo-credit' && <p>Proposed demo credits: {preview.credits.toLocaleString('en-ZA')}</p>}<p>Review status: {preview.enabled ? 'Ready for review' : 'Draft'}</p>{(preview.start || preview.end) && <p>Proposed window: {preview.start || 'Unspecified'} – {preview.end || 'Unspecified'}</p>}</section>}
  </div>;
}
