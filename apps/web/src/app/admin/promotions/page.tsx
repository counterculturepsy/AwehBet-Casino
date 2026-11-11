'use client';

import { useMemo, useState } from 'react';

type CampaignKind = 'banner' | 'demo-credit';
type Campaign = { title: string; description: string; kind: CampaignKind; start: string; end: string; credits: number; enabled: boolean };

const initial: Campaign = { title: 'Welcome to AwehBet', description: 'Explore our free-to-play demo experience.', kind: 'banner', start: '', end: '', credits: 0, enabled: false };

export default function PromotionsPage() {
  const [campaign, setCampaign] = useState<Campaign>(initial);
  const [preview, setPreview] = useState<Campaign | null>(null);
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
    <div className="demo-banner"><div><strong>Draft-only workspace</strong><p>Changes are held in this browser tab only. No campaign is saved, published, scheduled or awarded to a player. Real-money bonuses are unavailable.</p></div></div>
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
        <button type="submit" disabled={errors.length > 0}>Preview draft</button>
      </form>
    </section>
    {preview && <section className="dashboard-panel admin-campaign-preview" aria-label="Campaign preview"><p className="account-eyebrow">UNPUBLISHED PREVIEW · {preview.kind === 'banner' ? 'BANNER' : 'VIRTUAL CREDITS'}</p><h2>{preview.title}</h2><p>{preview.description}</p>{preview.kind === 'demo-credit' && <p>Proposed demo credits: {preview.credits.toLocaleString('en-ZA')}</p>}<p>Review status: {preview.enabled ? 'Ready for review' : 'Draft'}</p>{(preview.start || preview.end) && <p>Proposed window: {preview.start || 'Unspecified'} – {preview.end || 'Unspecified'}</p>}</section>}
  </div>;
}
