'use client';
import { useMemo, useState } from 'react';
import DepositCentre from './deposit-centre';
import { Search, Menu, Heart, ShieldCheck, Gamepad2, Sparkles, ArrowRight } from 'lucide-react';

type Game = { id: string; name: string; category: string; accent: string; symbol: string };
const games: Game[] = [
  { id: '1', name: 'Golden Safari', category: 'Adventure', accent: '#d8a540', symbol: '◆' },
  { id: '2', name: 'Neon Nights', category: 'Modern', accent: '#9e67ed', symbol: '✦' },
  { id: '3', name: 'Ocean Treasure', category: 'Adventure', accent: '#30c7d6', symbol: '◈' },
  { id: '4', name: 'Royal Fortune', category: 'Classic', accent: '#e4b65c', symbol: '♛' },
  { id: '5', name: 'Cosmic Reels', category: 'Modern', accent: '#7f9dff', symbol: '✧' },
  { id: '6', name: 'Lucky Sevens', category: 'Classic', accent: '#ef667b', symbol: '7' },
  { id: '7', name: 'Savanna Gems', category: 'Adventure', accent: '#7dc98c', symbol: '◇' },
  { id: '8', name: 'Starlight Spin', category: 'Modern', accent: '#d38bf2', symbol: '★' },
];
const categories = ['All Games', 'Adventure', 'Modern', 'Classic'];
export default function Home() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All Games');
  const [favourites, setFavourites] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Game | null>(null);
  const filtered = useMemo(() => games.filter(game =>
    (category === 'All Games' || game.category === category) &&
    game.name.toLowerCase().includes(query.toLowerCase().trim())), [category, query]);
  const toggleFavourite = (id: string) => setFavourites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  return <div className="shell">
    <header className="topbar">
      <a className="logo" href="/" aria-label="AwehBet homepage">AWEH<span>BET</span><small>CASINO</small></a>
      <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Main navigation">
        <a href="#games">Slots</a><a href="/professional-demos">Professional Demos</a><a href="#about">About</a><a href="#responsible">Responsible Play</a>
      </nav>
      <div className="header-actions"><DepositCentre/><span className="demo-pill">DEMO PLATFORM</span><button className="menu" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu" aria-expanded={menuOpen}><Menu size={22}/></button></div>
    </header>
    <main>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-content">
        <div className="eyebrow"><Sparkles size={16}/> BUILT FOR MZANSI</div>
        <h1 id="hero-title">BIG ENERGY.<br/><em>EPIC REELS.</em></h1>
        <p>Welcome to AwehBet — a fresh South African slots experience. Explore our concept lobby while we build.</p>
        <a className="primary-button" href="/professional-demos">Play professional demos <ArrowRight size={18}/></a>
        <p className="hero-note"><ShieldCheck size={15}/> Concept preview only. No deposits, wagers or cash prizes.</p>
      </div><div className="hero-art" aria-hidden="true"><div className="orb"><span>7</span><span>★</span><span>7</span></div><div className="art-caption">AWESOME STARTS HERE</div></div></section>
      <section className="games-section" id="games" aria-labelledby="games-title">
        <div className="section-heading"><div><div className="eyebrow">THE LOBBY</div><h2 id="games-title">Explore Slots</h2><p>Explore our original concepts here, or play professional games in the demo lobby.</p></div><a className="game-count" href="/professional-demos">Play professional demos →</a></div>
        <div className="filters"><div className="categories" aria-label="Filter by category">{categories.map(c => <button key={c} className={category === c ? 'chip active' : 'chip'} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div><label className="search"><Search size={18}/><span className="sr-only">Search games</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search games..."/></label></div>
        <div className="game-grid">{filtered.map(game => <article className="game-card" key={game.id}><div className="game-cover" style={{'--accent': game.accent} as React.CSSProperties}><div className="game-symbol" aria-hidden="true">{game.symbol}</div><button className="favourite" onClick={() => toggleFavourite(game.id)} aria-label={favourites.includes(game.id) ? 'Remove ' + game.name + ' from favourites' : 'Add ' + game.name + ' to favourites'} aria-pressed={favourites.includes(game.id)}><Heart size={19} fill={favourites.includes(game.id) ? 'currentColor' : 'none'}/></button><button className="play-overlay" onClick={() => setSelected(game)}>View concept</button></div><div className="game-info"><strong>{game.name}</strong><span>{game.category} · Concept</span></div></article>)}</div>
        {filtered.length === 0 && <p className="empty">No games match your search. Try another title or category.</p>}
      </section>
      <section className="info-strip" id="about"><div><Gamepad2/><h3>Slots First</h3><p>A streamlined catalogue and discovery experience.</p></div><div><ShieldCheck/><h3>Designed Responsibly</h3><p>Demo-only until the required authorizations are confirmed.</p></div><div><Sparkles/><h3>Made for South Africa</h3><p>Built with local players and mobile usability in mind.</p></div></section>
    </main>
    <footer id="responsible"><strong>AWEH<span>BET</span></strong><p>Prototype website. No real-money gambling, payments, or prizes are available. Intended for adults 18+.</p><small>© {new Date().getFullYear()} AwehBet. All rights reserved.</small></footer>
    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close dialog">×</button><div className="modal-symbol" style={{color:selected.accent}}>{selected.symbol}</div><h2 id="modal-title">{selected.name}</h2><p>This is a visual game concept. No playable game engine or real-money wagering is connected.</p><button className="primary-button" onClick={() => setSelected(null)}>Back to lobby</button></div></div>}
  </div>;
}
