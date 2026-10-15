'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { PIXI?: any }
}
const SYMBOLS = ['7', '★', '♦', '♣', '♥', 'BAR'];
const REELS = 3;
const ROWS = 3;
const START_CREDITS = 1000;
const BET = 10;
const SIZE = 96;

function randomSymbol() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return SYMBOLS[array[0] % SYMBOLS.length];
}

export default function PixiSlotsDemo({ onClose }: { onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const pixi = useRef<any>(null);
  const [credits, setCredits] = useState(START_CREDITS);
  const [reels, setReels] = useState<string[][]>([['7','★','♦'],['7','♦','♣'],['7','♥','BAR']]);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState('Demo credits only — no cash value.');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let app: any;
    let script: HTMLScriptElement | undefined;
    const initialize = () => {
      if (cancelled || !mount.current || !window.PIXI) return;
      const PIXI = window.PIXI;
      app = new PIXI.Application({ width: REELS * SIZE, height: ROWS * SIZE, backgroundColor: 0x150a16, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
      mount.current.appendChild(app.view);
      pixi.current = { app, PIXI };
    };
    if (window.PIXI) initialize();
    else {
      script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.js';
      script.async = true;
      script.onload = initialize;
      script.onerror = () => { if (!cancelled) setError('Unable to load the PixiJS renderer. Check your connection.'); };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (script && script.parentNode) script.remove();
      if (app) { app.destroy(true, { children: true }); pixi.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!pixi.current) return;
    const { app, PIXI } = pixi.current;
    app.stage.removeChildren().forEach((child: any) => child.destroy({ children: true }));
    reels.forEach((column, x) => column.forEach((symbol, y) => {
      const rect = new PIXI.Graphics();
      rect.lineStyle(2, 0xb88637).beginFill((x + y) % 2 ? 0x281329 : 0x37172c).drawRoundedRect(x * SIZE + 3, y * SIZE + 3, SIZE - 6, SIZE - 6, 10).endFill();
      app.stage.addChild(rect);
      const label = new PIXI.Text(symbol, { fontFamily: 'Arial', fontSize: symbol === 'BAR' ? 29 : 52, fontWeight: 'bold', fill: symbol === '7' ? 0xffd36c : 0xffffff, align: 'center' });
      label.anchor.set(0.5);
      label.position.set(x * SIZE + SIZE / 2, y * SIZE + SIZE / 2);
      app.stage.addChild(label);
    }));
  }, [reels, error]);

  useEffect(() => {
    if (!spinning) return;
    let ticks = 0;
    const interval = window.setInterval(() => {
      setReels(Array.from({ length: REELS }, () => Array.from({ length: ROWS }, randomSymbol)));
      ticks++;
      if (ticks >= 15) {
        window.clearInterval(interval);
        const result = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, randomSymbol));
        setReels(result);
        const middle = result.map(column => column[1]);
        const win = middle.every(symbol => symbol === middle[0]);
        const payout = win ? (middle[0] === '7' ? 200 : 50) : 0;
        setCredits(current => current + payout);
        setMessage(win ? `Three ${middle[0]} symbols! +${payout} demo credits.` : 'No win this spin. Try again!');
        setSpinning(false);
      }
    }, 90);
    return () => window.clearInterval(interval);
  }, [spinning]);

  const spin = () => {
    if (spinning || credits < BET || error) return;
    setCredits(value => value - BET);
    setMessage('Spinning…');
    setSpinning(true);
  };
  return (
    <div className="aweh-pixi-demo">
      <div className="aweh-pixi-top"><strong>AWEHBET REEL RUSH</strong><button type="button" onClick={onClose} aria-label="Close demo game">✕</button></div>
      <p>PLAY FOR FUN · 18+ · NOT A REAL-MONEY GAME</p>
      <div className="aweh-pixi-reels" ref={mount} aria-label={`Slot reels: ${reels.map(r => r.join(', ')).join(' / ')}`} role="img"/>
      {error && <p role="alert">{error}</p>}
      <div className="aweh-pixi-status" aria-live="polite">{message}</div>
      <div className="aweh-pixi-controls"><span>Credits: <b>{credits}</b></span><span>Bet: <b>{BET}</b></span></div>
      <button className="aweh-pixi-spin" type="button" onClick={spin} disabled={spinning || credits < BET || !!error}>{spinning ? 'SPINNING…' : 'SPIN'}</button>
      <button className="aweh-pixi-reset" type="button" disabled={spinning} onClick={() => { setCredits(START_CREDITS); setMessage('Demo credits reset.'); }}>Reset demo credits</button>
      <small>Client-side entertainment prototype. Results and balances are not secure, certified, or redeemable. Payline: middle row only; three matching symbols pay 50 credits, three 7s pay 200.</small>
      <style jsx>{`
        .aweh-pixi-demo{width:min(420px,100%);padding:20px;border:1px solid #a66d35;border-radius:18px;background:linear-gradient(145deg,#2c1020,#10090e);box-shadow:0 20px 80px #000;color:white;text-align:center}
        .aweh-pixi-top{display:flex;align-items:center;justify-content:space-between;color:#ffd46b;font-size:19px}.aweh-pixi-top button{border:0;background:transparent;color:#fff;font-size:24px}
        p{font-size:11px;letter-spacing:1px;color:#e8b8c6}.aweh-pixi-reels{margin:15px auto;max-width:288px;min-height:288px}.aweh-pixi-reels :global(canvas){width:100%;height:auto;display:block}
        .aweh-pixi-status{min-height:40px;color:#ffe0a0;font-weight:700}.aweh-pixi-controls{display:flex;justify-content:space-around;padding:12px;background:#09070b;border-radius:8px}
        .aweh-pixi-spin{display:block;width:100%;padding:15px;margin-top:15px;border:0;border-radius:8px;background:linear-gradient(#fa284b,#a90025);color:#fff;font-weight:900;font-size:20px}
        .aweh-pixi-spin:disabled{opacity:.55}.aweh-pixi-reset{margin:12px auto;background:none;border:0;color:#ffd46b;text-decoration:underline}small{display:block;color:#b9aab1;line-height:1.5}
      `}</style>
    </div>
  );
}
