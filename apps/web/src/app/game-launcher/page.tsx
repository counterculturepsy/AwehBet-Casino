'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Gamepad2, ShieldCheck, ArrowLeft } from 'lucide-react';

const gameIds: Record<string, { id: string; provider: string }> = {
  'aviator': { id: 'aviator', provider: 'SPRIBE' },
  'sweet bonanza': { id: 'sweet-bonanza', provider: 'Pragmatic Play' },
  'gates of olympus': { id: 'gates-of-olympus', provider: 'Pragmatic Play' },
  'gates of olympus 1000': { id: 'gates-of-olympus', provider: 'Pragmatic Play' },
};

type LaunchState = 'idle' | 'checking' | 'unavailable' | 'error';

function ProviderGameLauncherContent() {
  const params = useSearchParams();
  const requestedGame = params.get('game')?.trim() ?? '';
  const game = Object.prototype.hasOwnProperty.call(gameIds, requestedGame.toLowerCase())
    ? gameIds[requestedGame.toLowerCase()]
    : null;
  const [state, setState] = useState<LaunchState>('idle');
  const [message, setMessage] = useState('');

  async function checkDemoAvailability() {
    if (!game) return;
    setState('checking');
    setMessage('');
    try {
      const response = await fetch('/api/game-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, mode: 'demo' }),
        cache: 'no-store',
      });
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('status' in result)) {
        throw new Error('Invalid provider response');
      }
      if ('reason' in result && result.reason === 'provider_not_configured') {
        setState('unavailable');
        setMessage('This game is awaiting authorised provider sandbox credentials.');
      } else if ('reason' in result && result.reason === 'unknown_game') {
        setState('unavailable');
        setMessage('This game is not available in the configured provider catalogue.');
      } else {
        // Never navigate to a provider URL without a reviewed, allowlisted adapter.
        setState('unavailable');
        setMessage('A playable provider session has not been enabled.');
      }
    } catch {
      setState('error');
      setMessage('Could not check game availability. Please try again later.');
    }
  }

  return <main style={{minHeight:'100vh',background:'#0b090d',color:'#f7f0e8',padding:'clamp(24px,5vw,64px)',fontFamily:'Arial,sans-serif'}}>
    <div style={{maxWidth:860,margin:'0 auto'}}>
      <Link href="/slots" style={{color:'#f1c77a',display:'inline-flex',alignItems:'center',gap:8,textDecoration:'none'}}><ArrowLeft size={18}/> Back to Slots Masters</Link>
      <section style={{marginTop:42,border:'1px solid #5a2830',borderRadius:18,padding:'clamp(24px,5vw,48px)',background:'#160e14',textAlign:'center'}}>
        <Gamepad2 size={44} color="#f1c77a" aria-hidden="true"/>
        <h1 style={{fontSize:'clamp(28px,4vw,44px)',margin:'20px 0 12px'}}>Official Game Launcher</h1>
        {game && <p style={{color:'#f1c77a',fontWeight:700}}>{requestedGame} · {game.provider}</p>}
        <p style={{color:'#d9c6c6',lineHeight:1.7}}>Genuine provider-hosted games will open here after authorised API integration. No game session is available yet.</p>
        <p style={{color:'#f1c77a',fontWeight:700}}>Status: Awaiting provider sandbox credentials</p>
        {game ? <button type="button" onClick={checkDemoAvailability} disabled={state==='checking'} style={{marginTop:12,padding:'12px 20px',border:'1px solid #f1c77a',borderRadius:8,background:'#30151c',color:'#f1c77a',cursor:state==='checking'?'wait':'pointer'}}>{state==='checking'?'Checking availability…':'Check demo availability'}</button> : <p style={{color:'#d9c6c6'}}>Choose a supported game from Slots Masters to check its availability.</p>}
        {message && <p role="status" aria-live="polite" style={{color:'#d9c6c6',marginTop:16}}>{message}</p>}
        <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'center',marginTop:28,color:'#c6b8b8',fontSize:14}}><ShieldCheck size={18}/> Demo-only development stage · No real-money wagering</div>
      </section>
    </div>
  </main>;
}

export default function ProviderGameLauncher() {
  return <Suspense fallback={<main style={{minHeight:'100vh',background:'#0b090d',color:'#f7f0e8',padding:48}}>Loading game launcher…</main>}><ProviderGameLauncherContent /></Suspense>;
}
