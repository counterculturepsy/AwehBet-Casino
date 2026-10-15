'use client';
import {useState} from 'react';
import {ArrowLeft,CalendarDays,ChevronRight,CircleUserRound,CreditCard,History,LockKeyhole,Settings,ShieldCheck,Wallet,X} from 'lucide-react';
type Tab='overview'|'transactions'|'profile'|'settings';
const history=[{date:'15 Oct 2026',name:'Welcome preview',type:'Demo activity',amount:'R0.00',status:'Illustrative'},{date:'14 Oct 2026',name:'Wallet preview',type:'Demo balance',amount:'R0.00',status:'Illustrative'}];
export default function PlayerDashboard({onClose}:{onClose:()=>void}){
 const [tab,setTab]=useState<Tab>('overview');
 const [nickname,setNickname]=useState('AwehBet Guest');
 const [editName,setEditName]=useState('AwehBet Guest');
 const [saved,setSaved]=useState('');
 const nav:[Tab,string,typeof Wallet][]=[['overview','Overview',Wallet],['transactions','History',History],['profile','Profile',CircleUserRound],['settings','Settings',Settings]];
 return <div className="player-backdrop" onMouseDown={onClose}><section className="player-panel" role="dialog" aria-modal="true" aria-labelledby="player-title" onMouseDown={e=>e.stopPropagation()}>
  <header className="player-head"><div><div className="player-kicker">AWEHBET · PLAYER AREA PREVIEW</div><h2 id="player-title">My Dashboard</h2><p>Welcome, {nickname}</p></div><button onClick={onClose} aria-label="Close player dashboard"><X/></button></header>
  <div className="player-tabs" role="tablist" aria-label="Dashboard sections">{nav.map(([id,name,Icon])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setSaved('')}}><Icon size={17}/>{name}</button>)}</div>
  {tab==='overview'&&<div className="player-body">
    <div className="player-balance"><div><span>DEMO WALLET</span><strong>R0.00</strong><small>No real funds or wagering</small></div><Wallet size={35}/></div>
    <div className="player-stat-grid"><div><span>Demo deposits</span><strong>R0.00</strong></div><div><span>Demo withdrawals</span><strong>R0.00</strong></div><div><span>Available rewards</span><strong>0</strong></div></div>
    <h3>Account shortcuts</h3><div className="player-shortcuts"><button onClick={()=>setTab('transactions')}><History size={19}/> Transaction history <ChevronRight size={17}/></button><button onClick={()=>setTab('profile')}><CircleUserRound size={19}/> Profile settings <ChevronRight size={17}/></button><button onClick={()=>setTab('settings')}><ShieldCheck size={19}/> Safety controls <ChevronRight size={17}/></button></div>
   </div>}
  {tab==='transactions'&&<div className="player-body"><h3>Transaction history</h3><p className="player-muted">Sample entries only. No real transactions have occurred.</p><div className="player-history">{history.map(item=><div key={item.name}><CalendarDays size={19}/><div><strong>{item.name}</strong><small>{item.date} · {item.type}</small></div><div className="player-history-right"><strong>{item.amount}</strong><small>{item.status}</small></div></div>)}</div></div>}
  {tab==='profile'&&<div className="player-body"><h3>Profile preview</h3><p className="player-muted">Changes below are temporary and reset when the dashboard is reopened.</p><form className="player-form" onSubmit={e=>{e.preventDefault();setNickname(editName.trim()||'AwehBet Guest');setSaved('Display name updated in this preview only.')}}><label>Display name<input value={editName} onChange={e=>setEditName(e.target.value)} maxLength={40} minLength={2} required/></label><label>Account status<input value="Demo visitor · Not registered" disabled/></label><button className="player-primary" type="submit">Save demo profile</button></form>{saved&&<p className="player-success" role="status">{saved}</p>}</div>}
  {tab==='settings'&&<div className="player-body"><h3>Account & safety settings</h3><p className="player-muted">These are illustrative settings. They do not create enforceable account limits.</p><div className="player-setting"><LockKeyhole size={19}/><div><strong>Account security</strong><small>Real authentication and verification are not connected.</small></div></div><div className="player-setting"><ShieldCheck size={19}/><div><strong>Responsible play</strong><small>Deposit limits, time-outs and self-exclusion require a licensed operational system.</small></div></div><div className="player-setting"><CreditCard size={19}/><div><strong>Payment methods</strong><small>Payment integrations are planned, not active.</small></div></div></div>}
  <footer className="player-foot"><span><ShieldCheck size={14}/> 18+ · Prototype only · No personal or financial data stored</span><button onClick={onClose}><ArrowLeft size={14}/> Back to website</button></footer>
 </section></div>
}
