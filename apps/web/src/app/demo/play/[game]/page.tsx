import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findDemoGame } from '@/lib/games/catalogue';
import styles from '../../demo.module.css';
import LauncherPanel from './launcher-panel';

export default async function DemoPlayer({ params }: { params: Promise<{ game: string }> }) {
  const { game: gameId } = await params;
  const game = findDemoGame(gameId);
  if (!game) notFound();

  return <main className={styles.playerShell}>
    <header className={styles.playerHeader}>
      <Link className={styles.back} href="/demo"><ArrowLeft size={17} /> Demo lobby</Link>
      <div className={styles.playerTitle}><strong>{game.title}</strong><span>{game.provider}</span></div>
      <span className={styles.demoBadge}>DEMO ONLY</span>
    </header>
    <LauncherPanel game={game} />
  </main>;
}
