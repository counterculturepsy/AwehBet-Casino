'use client';

import Link from 'next/link';
import DepositCentre from '../deposit-centre';
import {slotGames} from '@/lib/slots-lobby-games';
import {officialDemoLink} from '@/lib/official-demo-links';
import {useEffect,useMemo,useState} from 'react';
import {Home,Search,Heart,Gamepad2,X,Club,Gift,Spade,Star,Crown,Sparkles,Coins,ArrowRight,ShieldCheck,Zap,Gem,Menu,Trophy,Plane,Wallet,ExternalLink} from 'lucide-react';

const games=slotGames;
const categories=['All Slots','New Games','Popular','Jackpots','Bonus Buy','Providers'] as const;
type Category=typeof categories[number];
const providers=[...new Set(games.map(game=>game.provider))].sort((a,b)=>a.localeCompare(b));
export default function SlotsLobby(){
 const [menu,setMenu]=useState(false);

 const [category,setCategory]=useState<Category>('All Slots');
 const [sort,setSort]=useState('popular');
 const [provider,setProvider]=useState('All Providers');
 const [visibleCount,setVisibleCount]=useState(20);
 const [query,setQuery]=useState('');
 const [favourites,setFavourites]=useState<string[]>([]);
 const [favouritesReady,setFavouritesReady]=useState(false);
 const [gameType,setGameType]=useState('All types');
 useEffect(()=>{try{const saved=JSON.parse(window.localStorage.getItem('awehbet:slot-favourites:v1')||'[]');if(Array.isArray(saved))setFavourites(saved.filter((name):name is string=>typeof name==='string'&&games.some(g=>g.name===name)));}catch{}setFavouritesReady(true)},[]);
 useEffect(()=>{if(favouritesReady){try{window.localStorage.setItem('awehbet:slot-favourites:v1',JSON.stringify(favourites))}catch{}}},[favourites,favouritesReady]);
 const [onlyFavourites,setOnlyFavourites]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const selectedGame=selected?games.find(game=>game.name===selected)??null:null;
 const selectedDemoUrl=selectedGame?officialDemoLink(selectedGame.name,selectedGame.provider):null;
 useEffect(()=>{if(!selected)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelected(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[selected]);
 const visible=useMemo(()=>games.filter(game=>
   (category==='All Slots'||category==='Providers'||(category==='Popular'&&game.popular)||(category==='New Games'&&game.newGame)||(category==='Jackpots'&&game.jackpot)||(category==='Bonus Buy'&&game.bonusBuy))&&
   (provider==='All Providers'||game.provider===provider)&&
   (gameType==='All types'||(gameType==='Crash'&&game.category==='Crash')||(gameType==='Slots'&&game.category!=='Crash'))&&
   (game.name.toLowerCase().includes(query.trim().toLowerCase())||game.provider.toLowerCase().includes(query.trim().toLowerCase())||game.category.toLowerCase().includes(query.trim().toLowerCase()))&&
   (!onlyFavourites||favourites.includes(game.name))
 ).sort((a,b)=>sort==='az'?a.name.localeCompare(b.name):sort==='za'?b.name.localeCompare(a.name):sort==='provider'?a.provider.localeCompare(b.provider)||a.name.localeCompare(b.name):games.indexOf(a)-games.indexOf(b)),[category,provider,gameType,query,onlyFavourites,favourites,sort]);
 const displayed=visible.slice(0,visibleCount);
 const toggleFavourite=(name:string)=>setFavourites(previous=>previous.includes(name)?previous.filter(item=>item!==name):[...previous,name]);
 return <main className="slots-lobby" id="top">
  <header className="header"><Link href="/" className="brand" aria-label="AwehBet home"><img src="/assets/logo.webp" alt="AwehBet official logo"/></Link><button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} aria-controls="slots-navigation">{menu?<X/>:<Menu/>}</button><nav id="slots-navigation" className={menu?'navigation expanded':'navigation'} aria-label="Main navigation">{['Home','Casino','Live Casino','Sports','Aviator','Promotions','Tournaments','VIP'].map((n,i)=>{const Icon=[Home,Gamepad2,Club,Trophy,Plane,Gift,Trophy,Crown][i];return <Link key={n} className={n==='Casino'?'nav-item selected':'nav-item'} href={n==='Home'?'/':n==='Casino'?'/slots':n==='Live Casino'?'/#live':n==='Promotions'||n==='Tournaments'?'/#promotions':'/#games'}><Icon size={18}/><span>{n}</span></Link>})}</nav><label className="top-search"><Search size={18}/><input aria-label="Search slot games" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search games..."/></label><div className="account"><DepositCentre/><Link className="outline" href="/login">Login</Link><Link className="red" href="/register">Register</Link></div><Link className="player-entry" href="/account"><Wallet size={17}/> My Dashboard</Link></header>
  <section className="slots-masters-hero" aria-label="Slots Masters Cape Town hero">
   <div className="slots-masters-hero-content">
    <span className="slots-masters-kicker">SOUTH AFRICA’S PREMIUM CASINO</span>
    <h1><span>SLOTS</span><strong>MASTERS</strong></h1>
    <p>Spin into a world of premium slots,<br/>big jackpots and non-stop entertainment.</p>
    <div className="slots-masters-actions"><a href="#featured-slots" className="slots-masters-primary">Play Now <ArrowRight size={19}/></a><a href="#slots-catalogue" className="slots-masters-secondary">View All Slots <ArrowRight size={19}/></a></div>
   </div>
  </section>
  <section className="trust" aria-label="Lobby highlights"><span><Gift/> Promotions</span><span><ShieldCheck/> Security focused</span><span><Crown/> Local experience</span><span><Star/> Top providers</span><span><Wallet/> Payment integrations planned</span></section>
  <section className="categories" aria-label="Game categories">{[{name:"Slots",icon:Gamepad2},{name:"Live Casino",icon:Club},{name:"Sports",icon:Trophy},{name:"Aviator",icon:Plane},{name:"Table Games",icon:Spade},{name:"Jackpots",icon:Crown},{name:"All Games",icon:Gamepad2}].map(({name,icon:Icon})=><Link key={name} href={name==="Slots"||name==="All Games"?"/slots":"/#games"} className={name==="Slots"?"category active":"category"}><Icon size={27}/><span>{name}</span></Link>)}</section>
  <section className="slots-lobby-content" id="slots-catalogue" aria-label="Slots catalogue">
   <div className="slots-lobby-tools">
    <label className="slots-lobby-search"><Search size={21}/><input aria-label="Search slot games" placeholder="Search slots, providers or games..." value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <button type="button" className={onlyFavourites?'slots-lobby-favourites active':'slots-lobby-favourites'} aria-pressed={onlyFavourites} onClick={()=>setOnlyFavourites(value=>!value)}><Heart size={19} fill={onlyFavourites?'currentColor':'none'}/> My Favourites ({favourites.length})</button>
   </div>
   <div className="slots-lobby-categories" aria-label="Filter games by category">
    {categories.map((item,index)=>{const Icon=[Gamepad2,Star,Sparkles,Crown,Coins,Club][index];return <button key={item} type="button" aria-pressed={category===item} className={category===item?'active':''} onClick={()=>{setCategory(item);setVisibleCount(20)}}><Icon size={16}/>{item}</button>})}
   </div>
   <div className="slots-masters-provider-filter"><label htmlFor="slots-provider-select">Game provider</label><select id="slots-provider-select" value={provider} onChange={event=>{setProvider(event.target.value);setCategory('All Slots');setGameType('All types');setQuery('');setOnlyFavourites(false);setVisibleCount(20)}}><option value="All Providers">All Providers ({providers.length})</option>{providers.map(name=><option key={name} value={name}>{name}</option>)}</select><label htmlFor="slots-game-type">Game type</label><select id="slots-game-type" value={gameType} onChange={event=>{const nextType=event.target.value;setGameType(nextType);setProvider('All Providers');setCategory('All Slots');setQuery('');setOnlyFavourites(false);setVisibleCount(20)}}><option>All types</option><option>Slots</option><option>Crash</option></select><span>{provider==='All Providers'?'Showing all providers':`Showing ${provider} games`} · {visible.length} matching previews</span></div>
   <section className="slots-originals" aria-labelledby="slots-originals-title"><div><span className="slots-originals-kicker">Playable now on AwehBet</span><h2 id="slots-originals-title">AwehBet <span>Originals</span></h2><p>Reel Rush is our own five-reel demo slot. It runs right here on AwehBet with free demo credits. No deposit, no real-money prizes.</p></div><Link href="/slots/reel-rush" className="slots-originals-play">Play Reel Rush <ArrowRight size={19} aria-hidden="true"/></Link></section>
   <div className="slots-masters-featured" id="featured-slots"><h2>Featured <span>Slots</span></h2><span>Explore our games</span></div>
   <div className="slots-lobby-toolbar"><div className="slots-lobby-count">{visible.length} {visible.length===1?'game':'games'} found</div><label className="slots-lobby-sort">Sort by: <select aria-label="Sort games" value={sort} onChange={event=>setSort(event.target.value)}><option value="popular">Most Popular</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option><option value="provider">Provider A–Z</option></select></label></div>
   {visible.length>0?<div className="slots-lobby-grid">{displayed.map(game=><article className="slots-lobby-card" key={game.name}>
    <button type="button" className="slots-lobby-image" onClick={()=>setSelected(game.name)} aria-label={`View ${game.name}`}>{game.image?<img src={`/assets/slot-${game.image}.webp`} alt={game.name}/>:<span className="slots-masters-placeholder"><Gamepad2 size={32}/><strong>{game.name}</strong><small>{game.provider}</small></span>}<span>GAME DETAILS</span></button>
    <button type="button" className={favourites.includes(game.name)?'slots-lobby-heart saved':'slots-lobby-heart'} onClick={()=>toggleFavourite(game.name)} aria-label={`${favourites.includes(game.name)?'Remove from':'Add to'} favourites: ${game.name}`} aria-pressed={favourites.includes(game.name)}><Heart size={18} fill={favourites.includes(game.name)?'currentColor':'none'}/></button>
    <div className="slots-lobby-card-details"><strong>{game.name}</strong><small>{game.provider}</small><small aria-label="Game status">{officialDemoLink(game.name,game.provider)?'Free demo on provider site':'Awaiting provider integration'}</small></div>
   </article>)}</div>:<div className="slots-lobby-empty"><h2>No games found</h2><p>{onlyFavourites&&favourites.length===0?'Save a game using its heart icon to see it here.':'Try another search, category or turn off the favourites filter.'}</p><button type="button" onClick={()=>{setQuery('');setCategory('All Slots');setOnlyFavourites(false);setProvider('All Providers');setGameType('All types');setVisibleCount(20)}}>Clear filters</button></div>}
   {visible.length>displayed.length&&<button type="button" className="slots-masters-load-more" onClick={()=>setVisibleCount(count=>count+20)}>Load More Games ({visible.length-displayed.length} remaining)</button>}
  </section>
  <footer className="slots-lobby-footer">18+ · AwehBet visual frontend preview · Titles are catalogue previews without licensed game artwork or provider integration. Free demos open on each provider’s own website and are not operated by AwehBet. No real-money wagering or payment processing.</footer>


  {selectedGame&&<div className="slots-lobby-overlay" onMouseDown={()=>setSelected(null)}><div className="slots-lobby-dialog" role="dialog" aria-modal="true" aria-label={selectedGame.name} onMouseDown={event=>event.stopPropagation()}><button type="button" className="slots-lobby-close" onClick={()=>setSelected(null)} aria-label="Close game preview"><X/></button><img src="/assets/logo.webp" alt="AwehBet"/><h2>{selectedGame.name}</h2><p><strong>Provider:</strong> {selectedGame.provider}</p><p><strong>Category:</strong> {selectedGame.category}</p>
   {selectedDemoUrl?<><a href={selectedDemoUrl} target="_blank" rel="noopener noreferrer" className="slots-lobby-dismiss slots-lobby-demo-link">Play free demo on {selectedGame.provider} <ExternalLink size={16} aria-hidden="true"/><span className="slots-lobby-sr-only"> (opens the provider’s website in a new tab)</span></a><p className="slots-lobby-demo-note">Opens {selectedGame.provider}’s own website in a new tab. The demo is hosted and operated by {selectedGame.provider}, not AwehBet. Play money only. 18+.</p></>:<p><strong>Demo:</strong> No official provider demo page is linked for this title yet.</p>}
   <p><strong>Play on AwehBet:</strong> Awaiting authorised provider integration. No playable demo is connected on AwehBet for this title.</p><Link href={`/game-launcher?game=${encodeURIComponent(selectedGame.name)}`} className="slots-lobby-dismiss slots-lobby-secondary">Open game launcher</Link><button type="button" className="slots-lobby-dismiss slots-lobby-secondary" onClick={()=>setSelected(null)}>Back to slots</button></div></div>}
 </main>;
}
