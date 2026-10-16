import Link from 'next/link';

export const metadata = {
  title: 'Professional Slot Demos | AwehBet',
  description: 'Professional slot demo catalogue — provider integration pending.',
};

const providers = [
  { name: 'Pragmatic Play', games: ['Gates of Olympus', 'Sweet Bonanza', 'Big Bass Bonanza'], url: 'https://www.pragmaticplay.com/en/', slug: 'gates-of-olympus' },
  { name: "Play'n GO", games: ['Book of Dead'], url: 'https://www.playngo.com/', slug: 'book-of-dead' },
  { name: 'Hacksaw Gaming', games: ['Wanted Dead or a Wild'], url: 'https://www.hacksawgaming.com/', slug: 'wanted-dead-or-a-wild' },
];

export default function DemoPage() {
  return (
    <main style={{minHeight:'100vh',background:'radial-gradient(circle at top,#321329,#100b16 65%)',color:'#fff',padding:'32px 20px'}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
        <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:20,flexWrap:'wrap'}}>
          <Link href="/" aria-label="AwehBet homepage"><img src="/assets/logo.webp" alt="AwehBet" style={{width:165,maxWidth:'100%'}}/></Link>
          <Link href="/slots" style={{color:'#ffd46b'}}>Back to Slots Masters</Link>
        </header>
        <section style={{textAlign:'center',margin:'48px auto 36px',maxWidth:750}}>
          <p style={{color:'#ffd46b',fontWeight:700}}>AWEHBET GAME LOBBY</p>
          <h1 style={{fontSize:'clamp(2rem,5vw,3.5rem)',margin:'12px 0'}}>PROFESSIONAL SLOT DEMOS</h1>
          <p>We are arranging approved demo access to original games from professional studios. No homemade games, deposits or real-money wagering.</p>
        </section>
        <section aria-label="Professional game providers" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:18}}>
          {providers.map(provider=>(
            <article key={provider.name} style={{border:'1px solid #80542b',borderRadius:16,padding:24,background:'linear-gradient(150deg,#321326,#140d17)'}}>
              <h2 style={{color:'#ffd46b',fontSize:24}}>{provider.name}</h2>
              <p style={{lineHeight:1.7}}>{provider.games.join(' · ')}</p>
              <p style={{fontSize:13,color:'#c9bac7'}}>AwehBet demo integration pending provider authorization.</p>
              <Link href={`/demo/play/${provider.slug}`} style={{display:"inline-block",color:"#ffd46b",border:"1px solid #80542b",padding:"10px 14px",borderRadius:8}}>Open game player</Link>
            </article>
          ))}
        </section>
        <p style={{marginTop:32,textAlign:'center',fontSize:13,color:'#bfb0bc'}}>18+ · Catalogue preview only. Provider-hosted games are not yet connected. No simulated substitutes.</p>
      </div>
    </main>
  );
}
