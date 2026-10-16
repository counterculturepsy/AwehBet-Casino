import Link from 'next/link';
import {Gamepad2, ShieldCheck, ArrowLeft} from 'lucide-react';

export default function ProviderGameLauncher() {
  return <main style={{minHeight:'100vh',background:'#0b090d',color:'#f7f0e8',padding:'clamp(24px,5vw,64px)',fontFamily:'Arial,sans-serif'}}>
    <div style={{maxWidth:860,margin:'0 auto'}}>
      <Link href="/slots" style={{color:'#f1c77a',display:'inline-flex',alignItems:'center',gap:8,textDecoration:'none'}}><ArrowLeft size={18}/> Back to Slots Masters</Link>
      <section style={{marginTop:42,border:'1px solid #5a2830',borderRadius:18,padding:'clamp(24px,5vw,48px)',background:'#160e14',textAlign:'center'}}>
        <Gamepad2 size={44} color="#f1c77a" aria-hidden="true"/>
        <h1 style={{fontSize:'clamp(28px,4vw,44px)',margin:'20px 0 12px'}}>Official Game Launcher</h1>
        <p style={{color:'#d9c6c6',lineHeight:1.7}}>Genuine provider-hosted games will open here after authorised API integration. No game session is available yet.</p>
        <p style={{color:'#f1c77a',fontWeight:700}}>Status: Awaiting provider sandbox credentials</p>
        <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'center',marginTop:28,color:'#c6b8b8',fontSize:14}}><ShieldCheck size={18}/> Demo-only development stage · No real-money wagering</div>
      </section>
    </div>
  </main>;
}
