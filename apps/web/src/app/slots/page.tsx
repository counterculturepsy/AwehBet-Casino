'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {ArrowLeft,Search,Heart,Gamepad2,X,SlidersHorizontal} from 'lucide-react';

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
const categories=['All Games','Fantasy','Sweets','Adventure','Other'] as const;
type Category=typeof categories[number];

export default function SlotsLobby(){
 const [category,setCategory]=useState<Category>('All Games');
 const [query,setQuery]=useState('');
 const [favourites,setFavourites]=useState<string[]>([]);
 const [onlyFavourites,setOnlyFavourites]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const visible=useMemo(()=>games.filter(game=>
   (category==='All Games'||game.category===category)&&
   game.name.toLowerCase().includes(query.trim().toLowerCase())&&
   (!onlyFavourites||favourites.includes(game.name))
 ),[category,query,onlyFavourites,favourites]);
 const toggleFavourite=(name:string)=>setFavourites(previous=>previous.includes(name)?previous.filter(item=>item!==name):[...previous,name]);
 return <main className="slots-lobby" id="top">
  <header className="slots-lobby-header">
   <Link href="/" className="slots-lobby-logo" aria-label="AwehBet homepage"><img src="/assets/logo.webp" alt="AwehBet"/></Link>
   <Link href="/#games" className="slots-back"><ArrowLeft size={17}/> Back to casino</Link>
  </header>
  <section className="slots-lobby-intro">
   <span className="slots-eyebrow"><Gamepad2 size={16}/> AWEHBET GAME DISCOVERY</span>
   <h1>SLOTS <span>LOBBY</span></h1>
   <p>Explore the game collection, filter by theme and save your favourites. Visual previews only — no real-money play.</p>
  </section>
  <section className="slots-lobby-content" aria-label="Slots catalogue">
   <div className="slots-lobby-tools">
    <label className="slots-lobby-search"><Search size={19}/><input aria-label="Search slot games" placeholder="Search slots..." value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <button type="button" className={onlyFavourites?'slots-lobby-favourites active':'slots-lobby-favourites'} aria-pressed={onlyFavourites} onClick={()=>setOnlyFavourites(value=>!value)}><Heart size={17} fill={onlyFavourites?'currentColor':'none'}/> Favourites ({favourites.length})</button>
   </div>
   <div className="slots-lobby-categories" aria-label="Filter games by category">
    {categories.map(item=><button key={item} type="button" aria-pressed={category===item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}
   </div>
   <div className="slots-lobby-count"><SlidersHorizontal size={16}/>{visible.length} {visible.length===1?'game':'games'} found</div>
   {visible.length>0?<div className="slots-lobby-grid">{visible.map(game=><article className="slots-lobby-card" key={game.name}>
    <button type="button" className="slots-lobby-image" onClick={()=>setSelected(game.name)} aria-label={`View ${game.name}`}><img src={`/assets/slot-${game.image}.webp`} alt={game.name}/><span>VIEW GAME</span></button>
    <button type="button" className={favourites.includes(game.name)?'slots-lobby-heart saved':'slots-lobby-heart'} onClick={()=>toggleFavourite(game.name)} aria-label={`${favourites.includes(game.name)?'Remove from':'Add to'} favourites: ${game.name}`} aria-pressed={favourites.includes(game.name)}><Heart size={18} fill={favourites.includes(game.name)?'currentColor':'none'}/></button>
    <div className="slots-lobby-card-details"><strong>{game.name}</strong><small>{game.category}</small></div>
   </article>)}</div>:<div className="slots-lobby-empty"><h2>No games found</h2><p>{onlyFavourites&&favourites.length===0?'Save a game using its heart icon to see it here.':'Try another search, category or turn off the favourites filter.'}</p><button type="button" onClick={()=>{setQuery('');setCategory('All Games');setOnlyFavourites(false)}}>Clear filters</button></div>}
  </section>
  <footer className="slots-lobby-footer">18+ · AwehBet visual frontend preview · Game artwork is illustrative and not a licensed game integration. No real-money wagering or payment processing.</footer>
  {selected&&<div className="slots-lobby-overlay" onMouseDown={()=>setSelected(null)}><div className="slots-lobby-dialog" role="dialog" aria-modal="true" aria-label={selected} onMouseDown={event=>event.stopPropagation()}><button type="button" className="slots-lobby-close" onClick={()=>setSelected(null)} aria-label="Close game preview"><X/></button><img src="/assets/logo.webp" alt="AwehBet"/><h2>{selected}</h2><p>This is a visual game preview. Game-provider integration is not connected.</p><button type="button" className="slots-lobby-dismiss" onClick={()=>setSelected(null)}>Back to slots</button></div></div>}
 </main>;
}
