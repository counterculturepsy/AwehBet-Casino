'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gamepad2, Search, Play, RotateCcw } from 'lucide-react';
import styles from './demo.module.css';

type Game = { id: string; title: string; studio: string; category: string; thumbnailUrl?: string };
type Catalogue = { status: 'ready' | 'pending'; games: Game[]; message?: string };

export default function DemoLobby() {
  const [games, setGames] = useState<Game[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'pending' | 'error'>('loading');
  const [search, setSearch] = useState('');
  const [studio, setStudio] = useState('All studios');
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/demo/games', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Catalogue unavailable');
        return response.json() as Promise<Catalogue>;
      })
      .then(data => {
        if (!Array.isArray(data.games)) throw new Error('Invalid catalogue');
        setGames(data.games);
        setStatus(data.status === 'pending' ? 'pending' : 'ready');
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [reload]);

  const studios = useMemo(() => ['All studios', ...new Set(games.map(g => g.studio))], [games]);
  const visible = useMemo(() => games.filter(g =>
    (studio === 'All studios' || g.studio === studio) &&
    (g.title + ' ' + g.studio).toLowerCase().includes(search.trim().toLowerCase())
  ), [games, studio, search]);

  async function play(id: string) {
    if (active) return;
    setError('');
    setActive(id);
    // Open the window synchronously so popup blockers do not prevent a user-initiated launch.
    const popup = window.open('about:blank', '_blank');
    if (!popup) { setActive(null); setError('Allow pop-ups to launch this game in a new tab.'); return; }
    try {
      const response = await fetch('/api/demo/launch', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: id }), cache: 'no-store',
      });
      if (!response.ok) throw new Error('Demo is not available yet.');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('url' in data) ||
          typeof (data as {url: unknown}).url !== 'string') throw new Error('Invalid launch response');
      popup.opener = null;
      popup.location.replace((data as {url: string}).url);
    } catch (err) {
      popup.close();
      setError(err instanceof Error ? err.message : 'Unable to launch demo');
    } finally {
      setActive(null);
    }
  }

  return <main className={styles.page}>
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="AwehBet home"><ArrowLeft size={18}/> <img src="/assets/logo.webp" alt="AwehBet"/></Link>
        <span className={styles.label}>OFFICIAL PROVIDER DEMOS · 18+</span>
      </header>
      <section className={styles.hero}>
        <span className={styles.kicker}><Gamepad2 size={17}/> THE DEMO LOBBY</span>
        <h1>Professional <em>Games</em></h1>
        <p>Explore approved game-provider demos. No deposits, real-money wagers or cash prizes.</p>
      </section>
      <section aria-label="Available demo games">
        <div className={styles.toolbar}>
          <label className={styles.search}><Search size={18}/><input aria-label="Search demo games" placeholder="Search games or studios" value={search} onChange={e => setSearch(e.target.value)}/></label>
          <select aria-label="Filter by studio" value={studio} onChange={e => setStudio(e.target.value)}>{studios.map(p => <option key={p}>{p}</option>)}</select>
        </div>
        {status === 'loading' && <p className={styles.notice} role="status">Loading demo catalogue…</p>}
        {status === 'pending' && <div className={styles.notice} role="status"><h2>Provider access pending</h2><p>We are connecting authorised professional demo games. Titles will appear here after onboarding.</p></div>}
        {status === 'error' && <div className={styles.notice} role="alert"><p>The demo catalogue could not be loaded.</p><button onClick={() => {setStatus('loading');setReload(v=>v+1);}}><RotateCcw size={15}/> Try again</button></div>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {status === 'ready' && <>
          <p className={styles.count}>{visible.length} approved demo {visible.length === 1 ? 'game' : 'games'}</p>
          <div className={styles.grid}>{visible.map(game => <article key={game.id} className={styles.card}>
            <div className={styles.art}>{game.thumbnailUrl ? <img loading="lazy" src={game.thumbnailUrl} alt="" /> : <Gamepad2 size={55}/>}</div>
            <div className={styles.info}><span>{game.studio} · {game.category}</span><h2>{game.title}</h2>
              <button type="button" disabled={!!active} onClick={() => play(game.id)}>
                <Play size={16}/> {active === game.id ? 'Launching…' : 'Play free demo'}
              </button>
            </div>
          </article>)}</div>
          {visible.length === 0 && <p className={styles.notice}>No games match those filters.</p>}
        </>}
      </section>
      <footer className={styles.footer}>18+ · Demo only · Games launch through approved provider gateways. The Design 5 site and existing slots lobby remain unchanged.</footer>
    </div>
  </main>;
}
