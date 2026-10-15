'use client';
import { useState } from 'react';
import { CreditCard, Landmark, Ticket, X, ShieldCheck, Wallet } from 'lucide-react';
type Tab = 'online' | 'cards' | 'vouchers';
const methods: Record<Tab,string[]> = {
 online:['Instant EFT','Pay by Bank','Bank EFT'],
 cards:['Visa / Mastercard','Apple Pay','Google Pay'],
 vouchers:['1Voucher','OTT Voucher','Blu Voucher','EasyLoad']
};
export default function DepositCentre() {
 const [open,setOpen]=useState(false);
 const [tab,setTab]=useState<Tab>('online');
 const [method,setMethod]=useState('');
 const [amount,setAmount]=useState('200');
 const [message,setMessage]=useState('');
 const choose=(t:Tab)=>{setTab(t);setMethod('');setMessage('');};
 const close=()=>{setOpen(false);setMessage('');};
 return <>
  <button className="deposit-trigger" onClick={()=>setOpen(true)}><Wallet size={17}/> Deposit <span className="deposit-demo">DEMO</span></button>
  {open&&<div className="deposit-backdrop" onMouseDown={close}>
   <section className="deposit-panel" role="dialog" aria-modal="true" aria-labelledby="deposit-title" onMouseDown={e=>e.stopPropagation()}>
    <button className="deposit-close" onClick={close} aria-label="Close deposit centre"><X size={22}/></button>
    <div className="deposit-kicker">AWEHBET WALLET · PROTOTYPE</div>
    <h2 id="deposit-title">Deposit Centre</h2>
    <p className="deposit-muted">Explore planned South African payment options. No real deposits or voucher redemptions are available.</p>
    <div className="deposit-tabs" role="tablist" aria-label="Deposit type">
      {([['online','Online Deposit'],['cards','Cards & Wallets'],['vouchers','Vouchers']] as const).map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?'active':''} onClick={()=>choose(key)}>{label}</button>)}
    </div>
    <div className="deposit-methods">{methods[tab].map(m=><button key={m} className={method===m?'selected':''} aria-pressed={method===m} onClick={()=>{setMethod(m);setMessage('');}}>{tab==='vouchers'?<Ticket size={21}/>:tab==='cards'?<CreditCard size={21}/>:<Landmark size={21}/>}<span>{m}</span><small>Planned</small></button>)}</div>
    <label className="deposit-label" htmlFor="deposit-amount">Demo amount (ZAR)</label>
    <div className="deposit-amounts">{['100','200','500','1000'].map(n=><button key={n} className={amount===n?'active':''} onClick={()=>setAmount(n)}>R{n}</button>)}</div>
    <input id="deposit-amount" className="deposit-input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} aria-describedby="deposit-amount-help"/>
    <p id="deposit-amount-help" className="deposit-muted deposit-small">For illustration only. No card details, banking credentials, or voucher PINs are collected.</p>
    <button className="deposit-submit" onClick={()=>{const n=Number(amount);setMessage(!method?'Select a payment method to continue.':!Number.isFinite(n)||n<=0?'Enter a valid positive amount.':`Demo only: R${n.toFixed(2)} via ${method}. This payment method is not connected.`);}}>Preview deposit <span>→</span></button>
    {message&&<p className="deposit-feedback" role="status">{message}</p>}
    <p className="deposit-footer"><ShieldCheck size={15}/> 18+ · Prototype only · No payments, wagering, or cash prizes</p>
   </section>
  </div>}
 </>;
}
