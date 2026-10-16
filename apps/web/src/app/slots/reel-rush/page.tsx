'use client';

import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,RotateCcw,Volume2,VolumeX} from 'lucide-react';

const symbols=['🍒','🍋','🍇','🔔','💎','7️⃣','⭐'];
const weights=[26,24,20,14,9,5,2];
const payouts=[2,3,4,6,10,18,25];
const bets=[1,2,5,10,20];
const START=1000;
function pick():number{
 const value=Math.random()*weights.reduce((a,b)=>a+b,0);
 let sum=0;
 for(let i=0;i<weights.length;i++){sum+=weights[i];if(value<sum)return i;}
 return 0;
}
function spinGrid():number[][]{return Array.from({length:3},()=>Array.from({length:5},pick));}
function evaluate(grid:number[][],bet:number){
 let total=0;const wins:number[][]=[];
 for(let row=0;row<3;row++){
  const line=grid[row];let count=1;
  while(count<5&&line[count]===line[0])count++;
  if(count>=3){total+=Math.round(bet*payouts[line[0]]*({3:1,4:2,5:4} as Record<number,number>)[count]);wins.push(Array.from({length:count},(_,col)=>row*5+col));}
 }
 return {total,wins};
}
export default function ReelRush(){
 const [grid,setGrid]=useState<number[][]>([[0,1,2,3,4],[4,5,6,0,1],[2,3,4,5,6]]);
 const [balance,setBalance]=useState(START);
 const [betIndex,setBetIndex]=useState(1);
 const [spinning,setSpinning]=useState(false);
 const [win,setWin]=useState(0);
 const [winCells,setWinCells]=useState<number[]>([]);
 const [message,setMessage]=useState('Ready to spin — demo credits only');
 const [sound,setSound]=useState(false);
 const timer=useRef<ReturnType<typeof setInterval>|null>(null);
 const finish=useRef<ReturnType<typeof setTimeout>|null>(null);
 const balanceRef=useRef(START);
 const bet=bets[betIndex];
 useEffect(()=>()=>{if(timer.current)clearInterval(timer.current);if(finish.current)clearTimeout(finish.current);},[]);
 const updateBalance=(n:number)=>{balanceRef.current=n;setBalance(n);};
 const spin=()=>{
  if(spinning||balanceRef.current<bet)return;
  updateBalance(balanceRef.current-bet);setSpinning(true);setWin(0);setWinCells([]);setMessage('Spinning…');
  const outcome=spinGrid();
  timer.current=setInterval(()=>setGrid(spinGrid()),85);
  finish.current=setTimeout(()=>{
   if(timer.current)clearInterval(timer.current);timer.current=null;
   const result=evaluate(outcome,bet);
   setGrid(outcome);setWin(result.total);setWinCells(result.wins.flat());
   updateBalance(balanceRef.current+result.total);setSpinning(false);
   setMessage(result.total>0?'You won '+result.total+' demo credits!':'No win this spin — try again');
  },1250);
 };
 const reset=()=>{if(spinning)return;updateBalance(START);setWin(0);setWinCells([]);setMessage('Demo balance reset');};
 return <main className="rr-shell">
 <div className="rr-top"><Link href="/slots"><ArrowLeft size={18}/> Back to Slots Masters</Link><span>AWEHBET · ORIGINAL DEMO GAME</span><button type="button" onClick={()=>setSound(s=>!s)} aria-label={sound?'Mute sound':'Enable sound'} title="Sound effects are not available yet">{sound?<Volume2/>:<VolumeX/>}</button></div>
 <div className="rr-stage"><div className="rr-eyebrow">AWEHBET PRESENTS</div><h1>REEL <em>RUSH</em></h1><p className="rr-sub">Five reels · Three rows · Three horizontal paylines</p>
 <div className="rr-reels" role="group" aria-label="Five reel slot machine">{grid.flatMap((row,r)=>row.map((symbol,c)=><div className={'rr-cell '+(winCells.includes(r*5+c)?'rr-winning':'')} key={r+'-'+c} aria-label={'Row '+(r+1)+', reel '+(c+1)+': '+symbols[symbol]}>{symbols[symbol]}</div>))}</div>
 <div className="rr-status" role="status" aria-live="polite">{message}</div>
 <div className="rr-stats"><div><small>DEMO BALANCE</small><strong>{balance.toLocaleString()} <span>CR</span></strong></div><div><small>LAST WIN</small><strong>{win.toLocaleString()} <span>CR</span></strong></div><div><small>TOTAL BET</small><strong>{bet} <span>CR</span></strong></div></div>
 <div className="rr-controls"><button type="button" disabled={spinning} onClick={()=>setBetIndex(i=>Math.max(0,i-1))} aria-label="Decrease bet">−</button><span>BET {bet} CR</span><button type="button" disabled={spinning} onClick={()=>setBetIndex(i=>Math.min(bets.length-1,i+1))} aria-label="Increase bet">+</button><button className="rr-spin" type="button" onClick={spin} disabled={spinning||balance<bet}>{spinning?'SPINNING…':'SPIN'}</button><button type="button" className="rr-reset" onClick={reset} disabled={spinning}><RotateCcw size={16}/> Reset</button></div>
 <p className="rr-help">Matching 3, 4 or 5 symbols from the left on any horizontal row awards demo credits. Every spin is independent. Outcomes are simulated locally and are not certified for wagering.</p>
 </div><footer className="rr-footer">18+ · Free-to-play simulation · No deposits, withdrawals or real-money prizes · Not affiliated with third-party game studios.</footer>
 <style jsx global>{`
 body{background:#090811;color:#fff}.rr-shell{min-height:100vh;background:radial-gradient(ellipse at 50% 25%,#38132d 0,#0b0815 65%);font-family:Arial,sans-serif;color:#fff}
 .rr-top{display:flex;justify-content:space-between;align-items:center;padding:20px clamp(14px,4vw,60px);gap:15px;border-bottom:1px solid #563047;background:#0b0912}
 .rr-top a{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-size:14px}.rr-top span{font-size:11px;color:#f0b95c;letter-spacing:2px}.rr-top button{background:transparent;color:#fff;border:0;cursor:pointer}
 .rr-stage{max-width:860px;margin:28px auto;padding:25px clamp(12px,3vw,38px);text-align:center;background:linear-gradient(145deg,#1c1022,#100c18);border:2px solid #ad6d34;border-radius:22px;box-shadow:0 12px 70px #000a,0 0 36px #ae2b572a}
 .rr-eyebrow{font-size:12px;letter-spacing:5px;color:#e8b66e}.rr-stage h1{font-size:clamp(44px,8vw,86px);margin:10px 0 0;letter-spacing:2px;text-shadow:0 4px 20px #000}.rr-stage h1 em{font-style:normal;color:#ff365e}.rr-sub{color:#d6b9c9;font-size:13px;margin:5px 0 24px}
 .rr-reels{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:14px;background:#08070d;border:3px solid #b27d43;border-radius:16px;box-shadow:inset 0 0 24px #000}
 .rr-cell{display:flex;align-items:center;justify-content:center;aspect-ratio:1.05;background:linear-gradient(#422439,#241526);border:1px solid #6b455a;border-radius:10px;font-size:clamp(24px,6vw,57px);user-select:none}
 .rr-winning{background:linear-gradient(#745324,#33201c);border-color:#ffd271;box-shadow:inset 0 0 22px #e6ad4a88,0 0 12px #ffca6e}
 .rr-status{min-height:46px;display:flex;align-items:center;justify-content:center;color:#f4d29b;font-weight:bold}
 .rr-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rr-stats>div{padding:14px 6px;background:#0b0a12;border:1px solid #463244;border-radius:10px}.rr-stats small{display:block;font-size:10px;letter-spacing:1px;color:#c0a4b4}.rr-stats strong{display:block;margin-top:6px;font-size:clamp(17px,3vw,26px)}.rr-stats strong span{font-size:11px;color:#efb96e}
 .rr-controls{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:20px}.rr-controls button{min-height:48px;border:1px solid #88506a;background:#332036;color:white;border-radius:10px;padding:0 18px;font-size:18px;cursor:pointer}.rr-controls button:disabled{opacity:.45;cursor:not-allowed}.rr-controls>span{font-size:13px;font-weight:bold;min-width:85px}.rr-controls .rr-spin{min-width:160px;background:linear-gradient(#ff3e66,#b6002d);border-color:#ff8092;font-weight:900;letter-spacing:2px}.rr-controls .rr-reset{display:flex;align-items:center;gap:7px;font-size:13px}
 .rr-help{max-width:620px;margin:22px auto 0;font-size:12px;line-height:1.7;color:#a99aa7}.rr-footer{text-align:center;padding:25px;font-size:11px;color:#b8a7b4}
 @media(max-width:560px){.rr-top span{display:none}.rr-stage{margin:12px 8px}.rr-reels{gap:3px;padding:6px}.rr-cell{border-radius:5px}.rr-controls .rr-spin{width:100%}.rr-stats small{font-size:9px}}
 `}</style>
 </main>;
}
