'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { demoGames } from '@/lib/demo-catalogue';

export default function DemoGamesPage() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('All providers');
  const providers = ['All providers', ...Array.from(new Set(demoGames.map(game => game.provider))).sort()];
  const filtered = useMemo(() => demoGames.filter(game =>
    (provider === 'All providers' || game.provider === provider) &&
    (game.title + ' ' + game.provider).toLowerCase().includes(query.trim().toLowerCase())
  ), [provider, query]);

  return <main style={{ minHeight: '100vh', background: '#0b090d', color: '#f7f0e8', padding: 'clamp(24px,5vw,64px)', fontFamily: 'Arial,sans-serif' }}>
    <div style={{ maxWidth: 1150, margin: 'auto' }}>
      <Link href="/slots" style={{ color: '#f1c77a' }}>← Back to Slots Masters</Link>
      <p style={{ color: '#f1c77a', marginTop: 32, letterSpacing: 3 }}>AWEHBET · DEVELOPMENT PREVIEW</p>
      <h1 style={{ fontSize: 'clamp(32px,5vw,58px)', marginBottom: 12 }}>Demo Game Catalogue</h1>
      <p style={{ color: '#d6c5c5', maxWidth: 740, lineHeight: 1.7 }}>Explore the planned provider catalogue. Provider game sessions are not yet authorised or connected. No real-money wagering or redeemable credits are available.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '28px 0' }}>
        <input aria-label="Search demo games" placeholder="Search games or providers" value={query} onChange={e => setQuery(e.target.value)} style={{ padding: 14, borderRadius: 8, background: '#20131b', color: '#fff', border: '1px solid #5a2830', flex: '1 1 230px' }} />
        <select aria-label="Filter provider" value={provider} onChange={e => setProvider(e.target.value)} style={{ padding: 14, borderRadius: 8, background: '#20131b', color: '#fff', border: '1px solid #5a2830' }}>
          {providers.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>
      <section aria-label="Demo games" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>
        {filtered.map(game => <article key={game.slug} style={{ background: '#180e15', border: '1px solid #5a2830', borderRadius: 16, padding: 22 }}>
          <div style={{ minHeight: 110, display: 'grid', placeItems: 'center', fontSize: 42, color: '#f1c77a' }} aria-hidden="true">♠</div>
          <h2 style={{ fontSize: 21, marginBottom: 8 }}>{game.title}</h2>
          <p style={{ color: '#c8b7b7' }}>{game.provider}</p>
          <p style={{ color: '#f1c77a', fontSize: 13 }}>Demo access pending approval</p>
          <Link href={`/demo-games/${game.slug}`} style={{ display: 'inline-block', padding: '11px 16px', marginTop: 8, border: '1px solid #f1c77a', borderRadius: 8, color: '#f1c77a', textDecoration: 'none' }}>View game →</Link>
        </article>)}
      </section>
      {filtered.length === 0 && <p role="status">No matching games found.</p>}
    </div>
  </main>;
}
