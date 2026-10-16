import Link from 'next/link';
import { demoGames } from '../../lib/games/catalogue';

export const metadata = {
  title: 'Professional Slot Demos | AwehBet',
  description: 'Explore professional slot titles in AwehBet’s demo catalogue.',
};

const providers = ['All providers', ...Array.from(new Set(demoGames.map(game => game.provider)))];

export default async function DemoPage({searchParams}: {searchParams: Promise<{q?: string; provider?: string}>}) {
  const {q = '', provider = 'All providers'} = await searchParams;
  const query = q.trim().toLowerCase();
  const visible = demoGames.filter(game =>
    (provider === 'All providers' || game.provider === provider) &&
    (!query || (game.title + ' ' + game.provider).toLowerCase().includes(query))
  );
  return (
    <main style={{minHeight:'100vh',background:'radial-gradient(circle at top,#321329,#100b16 65%)',color:'#fff',padding:'32px 20px'}}>
      <div style={{maxWidth:1150,margin:'0 auto'}}>
        <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:20,flexWrap:'wrap'}}>
          <Link href="/" aria-label="AwehBet homepage"><img src="/assets/logo.webp" alt="AwehBet" style={{width:165,maxWidth:'100%'}}/></Link>
          <Link href="/slots" style={{color:'#ffd46b'}}>Back to Slots Masters</Link>
        </header>
        <section style={{textAlign:'center',margin:'48px auto 30px'}}>
          <p style={{color:'#ffd46b',fontWeight:700}}>AWEHBET GAME LOBBY</p>
          <h1 style={{fontSize:'clamp(2rem,5vw,3.5rem)',margin:'12px 0'}}>PROFESSIONAL SLOT DEMOS</h1>
          <p>Original provider games. Demo launch access is pending approval; no simulated substitutes.</p>
        </section>
        <form action="/demo" style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:24}}>
          <input type="search" name="q" defaultValue={q} placeholder="Search games or providers" aria-label="Search games" style={{flex:'1 1 240px',padding:14,borderRadius:10,border:'1px solid #80542b',background:'#211322',color:'white'}}/>
          <select name="provider" defaultValue={provider} aria-label="Filter by provider" style={{padding:14,borderRadius:10,border:'1px solid #80542b',background:'#211322',color:'white'}}>
            {providers.map(name=><option key={name} value={name}>{name}</option>)}
          </select>
          <button type="submit" style={{padding:'12px 24px',background:'#e1ab43',color:'#170b16',border:0,borderRadius:10,fontWeight:700,cursor:'pointer'}}>Filter games</button>
        </form>
        <p style={{color:'#c9bac7'}}>{visible.length} games · Provider integration pending</p>
        <section aria-label="Professional game catalogue" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(235px,1fr))',gap:18}}>
          {visible.map(game=>(
            <article key={game.id} style={{border:'1px solid #80542b',borderRadius:16,padding:24,background:'linear-gradient(150deg,#321326,#140d17)',minHeight:230,display:'flex',flexDirection:'column'}}>
              <p style={{color:'#ffd46b',fontSize:12,letterSpacing:1,textTransform:'uppercase'}}>{game.provider}</p>
              <h2 style={{fontSize:24,margin:'8px 0'}}>{game.title}</h2>
              <p style={{color:'#c9bac7',fontSize:13}}>{game.category} · Demo access pending</p>
              <div style={{flex:1}}/>
              <Link href={`/demo/play/${game.id}`} style={{display:'inline-block',alignSelf:'flex-start',color:'#ffd46b',border:'1px solid #80542b',padding:'10px 14px',borderRadius:8}}>View game player</Link>
            </article>
          ))}
        </section>
        {visible.length===0&&<p>No games match your filters. <Link href="/demo" style={{color:'#ffd46b'}}>Clear filters</Link></p>}
        <p style={{marginTop:32,textAlign:'center',fontSize:13,color:'#bfb0bc'}}>18+ · Catalogue preview only. No provider game launch is connected yet.</p>
      </div>
    </main>
  );
}
