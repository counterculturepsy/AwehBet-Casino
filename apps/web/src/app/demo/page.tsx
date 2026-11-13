import { ArrowLeft, ArrowRight, ShieldCheck, TimerReset } from 'lucide-react';
import Link from 'next/link';
import { demoGames } from '@/lib/games/catalogue';
import styles from './demo.module.css';

export const metadata = {
  title: 'Provider Demo Catalogue | AwehBet',
  description: 'Review AwehBet candidate provider titles and sandbox integration status.',
};

const providers = ['All providers', ...Array.from(new Set(demoGames.map((game) => game.provider)))];

export default async function DemoCatalogue({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; provider?: string }>;
}) {
  const { q = '', provider = 'All providers' } = await searchParams;
  const query = q.trim().toLocaleLowerCase('en-ZA');
  const selectedProvider = providers.includes(provider) ? provider : 'All providers';
  const visible = demoGames.filter((game) =>
    (selectedProvider === 'All providers' || game.provider === selectedProvider) &&
    (!query || `${game.title} ${game.provider} ${game.category}`.toLocaleLowerCase('en-ZA').includes(query)),
  );

  return <main className={styles.shell}>
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href="/" aria-label="AwehBet home"><img className={styles.logo} src="/assets/logo.webp" alt="AwehBet" /></Link>
        <Link className={styles.back} href="/slots"><ArrowLeft size={17} /> Slots Masters</Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Professional game integration</p>
        <h1>Provider demo <span>lobby</span></h1>
        <p className={styles.intro}>A production-shaped launch experience for original provider-hosted games. Titles remain unavailable until distribution approval, official sandbox access, and exact provider catalogue IDs are supplied.</p>
        <div className={styles.status}><ShieldCheck aria-hidden="true" /> Fail-closed sandbox stage · no wagering</div>
      </section>

      <form className={styles.filters} action="/demo">
        <input type="search" name="q" defaultValue={q} placeholder="Search title, provider or category" aria-label="Search demo catalogue" maxLength={80} />
        <select name="provider" defaultValue={selectedProvider} aria-label="Filter by provider">
          {providers.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button type="submit">Apply filters</button>
      </form>

      <p className={styles.count}>{visible.length} candidate {visible.length === 1 ? 'title' : 'titles'} · launch access pending</p>
      {visible.length > 0 ? <section className={styles.grid} aria-label="Provider demo catalogue">
        {visible.map((game) => <article className={styles.card} key={game.id}>
          <p className={styles.provider}>{game.provider}</p>
          <h2>{game.title}</h2>
          <p className={styles.category}>{game.category}</p>
          <p className={styles.pending}><TimerReset aria-hidden="true" /> Awaiting authorised sandbox configuration</p>
          <Link className={styles.cardLink} href={`/demo/play/${game.id}`}>Open secure launcher <ArrowRight size={16} /></Link>
        </article>)}
      </section> : <div className={styles.empty}>No candidate titles match these filters. <Link href="/demo">Clear filters</Link>.</div>}

      <p className={styles.disclaimer}>18+ · Catalogue candidates only. A listing does not claim availability, commercial rights, licensing, certification, or provider approval. No deposits, prizes, or real-money play are available.</p>
    </div>
  </main>;
}
