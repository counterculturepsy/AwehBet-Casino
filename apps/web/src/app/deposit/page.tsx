'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, CreditCard, Ticket, ShieldCheck } from 'lucide-react';

type Tab = 'bank' | 'cards' | 'vouchers';
const methods: Record<Tab, string[]> = {
  bank: ['Instant EFT', 'Pay by Bank', 'Bank transfer'],
  cards: ['Visa / Mastercard', 'Apple Pay', 'Google Pay'],
  vouchers: ['1Voucher', 'OTT Voucher', 'Blu Voucher', 'EasyLoad'],
};
export default function DepositDemo() {
  const [tab, setTab] = useState<Tab>('bank');
  const [method, setMethod] = useState('Instant EFT');
  const [amount, setAmount] = useState(200);
  const [notice, setNotice] = useState('');
  function chooseTab(next: Tab) { setTab(next); setMethod(methods[next][0]); setNotice(''); }
  return <main className="deposit-demo">
    <div className="deposit-panel">
      <Link href="/" className="back"><ArrowLeft size={17}/> Back to lobby</Link>
      <p className="eyebrow">AWEHBET WALLET · PROTOTYPE</p>
      <h1>Deposit Centre</h1>
      <p className="disclaimer"><ShieldCheck size={18}/> Interface demonstration only. No money, voucher PINs or payment credentials are collected. No deposit is processed.</p>
      <div className="deposit-tabs" role="tablist" aria-label="Deposit method category">
        {([['bank','Online banking'],['cards','Cards & wallets'],['vouchers','Vouchers']] as const).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>chooseTab(id)}>{label}</button>)}
      </div>
      <h2>Choose a method</h2>
      <div className="method-grid">{methods[tab].map(name=><button key={name} className={method===name?'selected':''} aria-pressed={method===name} onClick={()=>{setMethod(name);setNotice('');}}>{tab==='bank'?<Building2/>:tab==='cards'?<CreditCard/>:<Ticket/>}<span>{name}</span><small>Pending provider approval</small></button>)}</div>
      <h2>Example amount (ZAR)</h2>
      <div className="amount-grid">{[50,100,200,500,1000].map(n=><button key={n} className={amount===n?'selected':''} aria-pressed={amount===n} onClick={()=>setAmount(n)}>R{n.toLocaleString('en-ZA')}</button>)}</div>
      <div className="deposit-summary"><span>Selected method</span><strong>{method}</strong><span>Example amount</span><strong>R{amount.toLocaleString('en-ZA')}</strong></div>
      <button className="demo-submit" onClick={()=>setNotice('Demo only: '+method+' for R'+amount.toLocaleString('en-ZA')+'. No payment was initiated.')}>Simulate deposit</button>
      {notice&&<p role="status" className="notice">{notice}</p>}
      <p className="fineprint">18+ concept interface. Actual processing requires applicable authorisation, merchant underwriting, identity verification and approved provider integrations. Never enter a real voucher PIN on this demo.</p>
    </div>
    <style jsx>{`
      .deposit-demo{min-height:100vh;padding:40px 16px;background:#08090f;color:#f8f8fa}
      .deposit-panel{max-width:880px;margin:auto;background:#11131e;border:1px solid #36313a;border-radius:18px;padding:32px}
      .back{display:inline-flex;gap:8px;align-items:center;color:#ddd;font-size:14px;margin-bottom:30px}
      .eyebrow{font-size:12px;color:#f2c14e;letter-spacing:2px;font-weight:800}
      h1{font-size:clamp(30px,5vw,48px);margin:10px 0 20px}h2{font-size:17px;margin:30px 0 14px}
      .disclaimer{display:flex;gap:12px;align-items:start;padding:16px;background:#24202a;border:1px solid #645035;border-radius:10px;color:#f3dca5;line-height:1.5}
      .deposit-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:28px;border-bottom:1px solid #353644;padding-bottom:10px}
      button{font:inherit;cursor:pointer;color:white}
      .deposit-tabs button{border:0;border-radius:8px;background:#202330;padding:12px 16px}
      .deposit-tabs button[aria-selected=true]{background:#e00037}
      .method-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .method-grid button{display:flex;flex-direction:column;align-items:start;gap:9px;background:#1b1d29;border:1px solid #41414d;border-radius:10px;padding:20px;text-align:left;min-height:125px}
      .method-grid button.selected,.amount-grid button.selected{border-color:#f1bf49;background:#332a22}
      .method-grid svg{color:#f1bf49}.method-grid small{color:#a8a9b3;font-size:11px}
      .amount-grid{display:flex;flex-wrap:wrap;gap:10px}
      .amount-grid button{background:#1b1d29;border:1px solid #41414d;border-radius:8px;padding:12px 18px}
      .deposit-summary{display:grid;grid-template-columns:1fr auto;gap:12px;margin:26px 0;padding:20px;background:#191b25;border-radius:10px}
      .deposit-summary span{color:#a8a9b3}.demo-submit{width:100%;padding:17px;background:#df0039;border:0;border-radius:10px;font-weight:800}
      .notice{background:#213329;padding:15px;border-radius:8px;color:#b5efc3}.fineprint{font-size:12px;color:#a8a9b3;line-height:1.6;margin-top:24px}
      @media(max-width:650px){.deposit-panel{padding:20px}.method-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:400px){.method-grid{grid-template-columns:1fr}}
    `}</style>
  </main>;
}
