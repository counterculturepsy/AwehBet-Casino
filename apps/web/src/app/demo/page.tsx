'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Search, Gamepad2 } from 'lucide-react';
import styles from '../professional-demos/professional-demos.module.css';

type Game = {title:string; provider:'BGaming'|'Pragmatic Play'|'Slotmill'; url:string; genre:string; icon:string; detail:string};
const games:Game[] = [
  {title:'Aztec Clusters',provider:'BGaming',url:'https://bgaming.com/games/aztec-clusters',genre:'Cluster Pays',icon:'◆',detail:'Cluster wins and multipliers'},
  {title:'Aztec Irwin',provider:'BGaming',url:'https://bgaming.com/games/aztec-irwin',genre:'Cluster Pays',icon:'◇',detail:'Aztec-themed cascading reels'},
  {title:'Elvis Frog in Vegas',provider:'BGaming',url:'https://bgaming.com/games/elvis-frog-in-vegas',genre:'Classic',icon:'♛',detail:'Free spins and coin respins'},
  {title:'Lady Wolf Moon',provider:'BGaming',url:'https://bgaming.com/games/lady-wolf-moon',genre:'Adventure',icon:'☾',detail:'Wilds and free spins'},
  {title:'Lady Wolf Moon MEGAWAYS',provider:'BGaming',url:'https://bgaming.com/games/lady-wolf-moon-megaways',genre:'Megaways',icon:'✦',detail:'Expanding ways to win'},
  {title:'Aloha King Elvis',provider:'BGaming',url:'https://bgaming.com/games/aloha-king-elvis',genre:'Adventure',icon:'★',detail:'Island-themed slot'},
  {title:'Bonanza Billion X-mas',provider:'BGaming',url:'https://bgaming.com/games/bonanza-billion-xmas',genre:'Cascades',icon:'❖',detail:'Festive cascading reels'},
  {title:'Gates of Olympus',provider:'Pragmatic Play',url:'https://www.pragmaticplay.fun/en/playlists/flagships/',genre:'Popular',icon:'⚡',detail:'Find the title in the official demo collection'},
  {title:'Sweet Bonanza',provider:'Pragmatic Play',url:'https://www.pragmaticplay.fun/en/',genre:'Popular',icon:'✿',detail:'Find the title in the official demo collection'},
  {title:'Big Bass Bonanza',provider:'Pragmatic Play',url:'https://www.pragmaticplay.fun/en/',genre:'Popular',icon:'♠',detail:'Find the title in the official demo collection'},
  {title:'Ragnarök Gold',provider:'Slotmill',url:'https://slotmill.com/games',genre:'Adventure',icon:'⚔',detail:'Find the title in the official demo collection'},
  {title:'Dead Man\'s Crew',provider:'Slotmill',url:'https://slotmill.com/games',genre:'Adventure',icon:'☠',detail:'Find the title in the official demo collection'},
];
const providers=['All providers','BGaming','Pragmatic Play','Slotmill'] as const;
export default function ProfessionalDemos() {
 const [provider,setProvider]=useState<string>('All providers');
 const [search,setSearch]=useState('');
 const filtered=useMemo(()=>games.filter(game=>(provider==='All providers'||game.provider===provider)&&game.title.toLowerCase().includes(search.trim().toLowerCase())),[provider,search]);
 return <main className={styles.page}>
   <div className={styles.container}>
     <header className={styles.header}><Link href="/" className={styles.back}><ArrowLeft size={17}/> AWEH<span>BET</span></Link><span className={styles.pill}>FREE DEMOS · 18+</span></header>
     <section className={styles.hero}><div className={styles.kicker}><Gamepad2 size={16}/> REAL GAMES. FREE DEMOS.</div><h1>Professional <em>Slots</em></h1><p>Explore genuine slot games from established providers. Select a game to launch its official free-play demo. No deposits, withdrawals or cash prizes on this page.</p></section>
     <div className={styles.toolbar}><div className={styles.filters}>{providers.map(p=><button key={p} type="button" aria-pressed={p===provider} className={p===provider?styles.active:styles.filter} onClick={()=>setProvider(p)}>{p}</button>)}</div><label className={styles.search}><Search size={17}/><span className={styles.sr}>Search titles</span><input placeholder="Search games..." value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
     <div className={styles.meta}>{filtered.length} professional demo titles</div>
     <div className={styles.grid}>{filtered.map((game,index)=><article className={styles.card} key={game.title}><div className={styles.art} style={{'--hue':String((index*32+25)%360)} as React.CSSProperties}><span aria-hidden="true">{game.icon}</span><small>{game.provider}</small></div><div className={styles.info}><div className={styles.genre}>{game.genre}</div><h2>{game.title}</h2><p>{game.detail}</p><a href={game.url} target="_blank" rel="noopener noreferrer" className={styles.play} aria-label={`Open official demo for ${game.title} (new tab)`}>Play official demo <ArrowUpRight size={17}/></a></div></article>)}</div>
     {filtered.length===0&&<p className={styles.empty}>No titles found. Try another provider or search.</p>}
     <p className={styles.note}>Games are hosted by their respective providers. Some links open a provider catalogue where you select the named title. AwehBet does not host, sublicense or embed these third-party games.</p>
   </div>
 </main>;
}
