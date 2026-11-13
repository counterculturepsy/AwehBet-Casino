'use client';

import { Gamepad2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { DemoGame } from '@/lib/games/catalogue';
import styles from '../../demo.module.css';

type LaunchState = 'idle' | 'loading' | 'unavailable' | 'error';

export default function LauncherPanel({ game }: { game: DemoGame }) {
  const [state, setState] = useState<LaunchState>('idle');
  const [message, setMessage] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');

  async function launchDemo() {
    setState('loading');
    setMessage('');
    try {
      const response = await fetch('/api/game-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, mode: 'demo' }),
        cache: 'no-store',
      });
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object') throw new Error('Invalid launch response.');
      const launch = result as Record<string, unknown>;
      if (response.ok && launch.status === 'ready' && typeof launch.launchUrl === 'string') {
        if (launch.presentation === 'redirect') {
          window.location.assign(launch.launchUrl);
          return;
        }
        if (launch.presentation === 'iframe') {
          setIframeUrl(launch.launchUrl);
          return;
        }
        throw new Error('Unsupported provider presentation.');
      }
      if (launch.reason === 'provider_not_configured') {
        setState('unavailable');
        setMessage('This title is awaiting authorised provider sandbox credentials.');
        return;
      }
      setState('error');
      setMessage(typeof launch.error === 'string' ? launch.error : 'A provider demo session is not available yet.');
    } catch {
      setState('error');
      setMessage('The secure launcher could not be reached. Please try again later.');
    }
  }

  if (iframeUrl) {
    return <iframe className={styles.gameFrame} src={iframeUrl} title={`${game.title} provider demo`} allow="fullscreen" referrerPolicy="strict-origin-when-cross-origin" />;
  }

  return <section className={styles.stage} aria-label="Secure provider demo launcher">
    <div className={styles.launchCard}>
      <div className={styles.launchIcon}><Gamepad2 size={34} aria-hidden="true" /></div>
      <p className={styles.eyebrow}>{game.provider}</p>
      <h1>{game.title}</h1>
      <p>The server will request an original demo session from the authorised provider adapter, then verify its host, transport, mode, and expiry before opening it.</p>
      <button className={styles.launchButton} type="button" onClick={launchDemo} disabled={state === 'loading'}>
        {state === 'loading' ? <LoaderCircle className="spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
        {state === 'loading' ? 'Checking securely…' : 'Check demo access'}
      </button>
      {message && <p className={styles.feedback} role="status" aria-live="polite">{message}</p>}
      <p className={styles.safety}><ShieldCheck size={16} aria-hidden="true" /> Demo-only development stage · no real-money wagering</p>
    </div>
  </section>;
}
