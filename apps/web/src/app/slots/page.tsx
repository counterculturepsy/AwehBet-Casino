'use client';

import Link from 'next/link';
import DepositCentre from '../deposit-centre';
import AuthDemo from '../auth-demo';
import PlayerDashboard from '../player-dashboard';
import {useMemo,useState} from 'react';
import {Home,Search,Heart,Gamepad2,X,Club,Gift,Spade,Star,Crown,Sparkles,Coins,ArrowRight,ShieldCheck,Zap,Gem,Menu,Trophy,Plane,Wallet} from 'lucide-react';

const games=[
 {name:'Gates of Olympus 1000',category:'Fantasy',image:1},
 {name:'Sweet Bonanza',category:'Sweets',image:2},
 {name:'Big Bass Splash',category:'Adventure',image:3},
 {name:'Sugar Rush',category:'Sweets',image:4},
 {name:'Buffalo King',category:'Adventure',image:5},
 {name:'Book of Dead',category:'Adventure',image:6},
 {name:'Aviator',category:'Other',image:7},
 {name:'Zeus vs Hades',category:'Fantasy',image:8},
 {name:'Starlight Princess',category:'Fantasy',image:9},
 {name:'Majestic King',category:'Adventure',image:10},
] as const;
const categories=['All Slots','New Games','Popular','Jackpots','Bonus Buy','Providers'] as const;
type Category=typeof categories[number];

export default function SlotsLobby(){
 const [menu,setMenu]=useState(false);
 const [modal,setModal]=useState('');
 const [category,setCategory]=useState<Category>('All Slots');
 const [sort,setSort]=useState('popular');
 const [query,setQuery]=useState('');
 const [favourites,setFavourites]=useState<string[]>([]);
 const [onlyFavourites,setOnlyFavourites]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const visible=useMemo(()=>games.filter(game=>
   (category==='All Slots'||category==='Providers'||category==='Popular'||(category==='New Games'&&game.image>=6)||(category==='Jackpots'&&[1,5,8,10].includes(game.image))||(category==='Bonus Buy'&&[1,2,4,8].includes(game.image)))&&
   game.name.toLowerCase().includes(query.trim().toLowerCase())&&
   (!onlyFavourites||favourites.includes(game.name))
 ).sort((a,b)=>sort==='az'?a.name.localeCompare(b.name):sort==='za'?b.name.localeCompare(a.name):a.image-b.image),[category,query,onlyFavourites,favourites,sort]);
 const toggleFavourite=(name:string)=>setFavourites(previous=>previous.includes(name)?previous.filter(item=>item!==name):[...previous,name]);
 return <main className="slots-lobby" id="top">
  <header className="header"><Link href="/" className="brand" aria-label="AwehBet home"><img src="/assets/logo.webp" alt="AwehBet official logo"/></Link><button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} aria-controls="slots-navigation">{menu?<X/>:<Menu/>}</button><nav id="slots-navigation" className={menu?'navigation expanded':'navigation'} aria-label="Main navigation">{['Home','Casino','Live Casino','Sports','Aviator','Promotions','Tournaments','VIP'].map((n,i)=>{const Icon=[Home,Gamepad2,Club,Trophy,Plane,Gift,Trophy,Crown][i];return <Link key={n} className={n==='Casino'?'nav-item selected':'nav-item'} href={n==='Home'?'/':n==='Casino'?'/slots':n==='Live Casino'?'/#live':n==='Promotions'||n==='Tournaments'?'/#promotions':'/#games'}><Icon size={18}/><span>{n}</span></Link>})}</nav><label className="top-search"><Search size={18}/><input aria-label="Search slot games" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search games..."/></label><div className="account"><DepositCentre/><button className="outline" onClick={()=>setModal('login')}>Login</button><button className="red" onClick={()=>setModal('register')}>Register</button></div><button className="player-entry" onClick={()=>setModal('dashboard')}><Wallet size={17}/> My Dashboard</button></header>
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
    {categories.map((item,index)=>{const Icon=[Gamepad2,Star,Sparkles,Crown,Coins,Club][index];return <button key={item} type="button" aria-pressed={category===item} className={category===item?'active':''} onClick={()=>setCategory(item)}><Icon size={16}/>{item}</button>})}
   </div>
   <div className="slots-masters-featured" id="featured-slots"><h2>Featured <span>Slots</span></h2><span>Explore our games</span></div>
   <div className="slots-lobby-toolbar"><div className="slots-lobby-count">{visible.length} {visible.length===1?'game':'games'} found</div><label className="slots-lobby-sort">Sort by: <select aria-label="Sort games" value={sort} onChange={event=>setSort(event.target.value)}><option value="popular">Most Popular</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select></label></div>
   {visible.length>0?<div className="slots-lobby-grid">{visible.map(game=><article className="slots-lobby-card" key={game.name}>
    <button type="button" className="slots-lobby-image" onClick={()=>setSelected(game.name)} aria-label={`View ${game.name}`}><img src={`/assets/slot-${game.image}.webp`} alt={game.name}/><span>VIEW GAME</span></button>
    <button type="button" className={favourites.includes(game.name)?'slots-lobby-heart saved':'slots-lobby-heart'} onClick={()=>toggleFavourite(game.name)} aria-label={`${favourites.includes(game.name)?'Remove from':'Add to'} favourites: ${game.name}`} aria-pressed={favourites.includes(game.name)}><Heart size={18} fill={favourites.includes(game.name)?'currentColor':'none'}/></button>
    <div className="slots-lobby-card-details"><strong>{game.name}</strong><small>Preview game</small></div>
   </article>)}</div>:<div className="slots-lobby-empty"><h2>No games found</h2><p>{onlyFavourites&&favourites.length===0?'Save a game using its heart icon to see it here.':'Try another search, category or turn off the favourites filter.'}</p><button type="button" onClick={()=>{setQuery('');setCategory('All Slots');setOnlyFavourites(false)}}>Clear filters</button></div>}
  </section>
  <footer className="slots-lobby-footer">18+ · AwehBet visual frontend preview · Game artwork is illustrative and not a licensed game integration. No real-money wagering or payment processing.</footer>
  {modal==='dashboard'&&<PlayerDashboard onClose={()=>setModal('')}/>}
  {(modal==='login'||modal==='register')&&<AuthDemo mode={modal} onClose={()=>setModal('')} onModeChange={setModal}/>}
  {selected&&<div className="slots-lobby-overlay" onMouseDown={()=>setSelected(null)}><div className="slots-lobby-dialog" role="dialog" aria-modal="true" aria-label={selected} onMouseDown={event=>event.stopPropagation()}><button type="button" className="slots-lobby-close" onClick={()=>setSelected(null)} aria-label="Close game preview"><X/></button><img src="/assets/logo.webp" alt="AwehBet"/><h2>{selected}</h2><p>This is a visual game preview. Game-provider integration is not connected.</p><button type="button" className="slots-lobby-dismiss" onClick={()=>setSelected(null)}>Back to slots</button></div></div>}
 </main>;
}
