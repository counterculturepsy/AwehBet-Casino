import Link from 'next/link';

const catalogue: Record<string, { name: string; provider: string }> = {
  'gates-of-olympus': { name: 'Gates of Olympus', provider: 'Pragmatic Play' },
  'sweet-bonanza': { name: 'Sweet Bonanza', provider: 'Pragmatic Play' },
  'big-bass-bonanza': { name: 'Big Bass Bonanza', provider: 'Pragmatic Play' },
  'book-of-dead': { name: 'Book of Dead', provider: "Play'n GO" },
  'wanted-dead-or-a-wild': { name: 'Wanted Dead or a Wild', provider: 'Hacksaw Gaming' },
};

export default async function DemoPlayer({params}: {params: Promise<{game: string}>}) {
  const {game} = await params;
  const entry = catalogue[game];
  if (!entry) {
    return <main style={{minHeight:'100vh',background:'#100b16',color:'white',padding:32}}><h1>Game not found</h1><Link href="/demo" style={{color:'#ffd46b'}}>Back to demo games</Link></main>;
  }
  return (
    <main style={{minHeight:'100vh',background:'#09070d',color:'white',display:'flex',flexDirection:'column'}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',gap:16,flexWrap:'wrap',background:'#1b101b',borderBottom:'1px solid #80542b'}}>
        <Link href="/demo" style={{color:'#ffd46b'}}>← Back to Games</Link>
        <strong>{entry.name} — Demo</strong>
        <span style={{fontSize:12,color:'#c9bac7'}}>{entry.provider}</span>
      </header>
      <section aria-label="Provider demo game player" style={{flex:1,minHeight:'80vh',display:'grid',placeItems:'center',padding:24,textAlign:'center'}}>
        <div style={{maxWidth:540}}>
          <h1 style={{fontSize:'clamp(1.7rem,4vw,3rem)'}}>{entry.name}</h1>
          <p style={{color:'#ffd46b'}}>Provider demo connection pending</p>
          <p>We're waiting for an authorized demo launch URL from {entry.provider}. The original game will open here when integration is approved and configured.</p>
          <p style={{fontSize:13,color:'#c9bac7'}}>No simulated game, deposit, or real-money wagering is available.</p>
          <Link href="/demo" style={{display:'inline-block',marginTop:18,padding:'12px 20px',border:'1px solid #ffd46b',borderRadius:10,color:'#ffd46b'}}>Return to Game Lobby</Link>
        </div>
      </section>
    </main>
  );
}
