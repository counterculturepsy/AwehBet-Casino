import Link from 'next/link';
import { notFound } from 'next/navigation';
import { approvedExternalDemoUrl, getDemoGame } from '@/lib/demo-catalogue';

export default async function DemoGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getDemoGame(slug);
  if (!game) notFound();
  const externalUrl = approvedExternalDemoUrl(game);
  return <main style={{ minHeight: '100vh', background: '#0b090d', color: '#f7f0e8', padding: 'clamp(24px,5vw,64px)', fontFamily: 'Arial,sans-serif' }}>
    <div style={{ maxWidth: 900, margin: 'auto' }}>
      <Link href="/demo-games" style={{ color: '#f1c77a' }}>← Demo catalogue</Link>
      <section style={{ background: '#180e15', border: '1px solid #5a2830', borderRadius: 18, padding: 'clamp(24px,5vw,48px)', marginTop: 30 }}>
        <p style={{ color: '#f1c77a' }}>{game.provider} · Demo preview</p>
        <h1 style={{ fontSize: 'clamp(30px,5vw,48px)' }}>{game.title}</h1>
        <p style={{ lineHeight: 1.7, color: '#d6c5c5' }}>This is a catalogue preview, not an active game session. Official provider demo access requires verification of the permitted launch method and relevant rights. No real-money wagering is available.</p>
        {externalUrl ? <a href={externalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#f1c77a', fontWeight: 700 }}>Open authorised official demo ↗</a> : <p role="status" style={{ color: '#f1c77a', fontWeight: 700 }}>Status: Awaiting provider permission / sandbox integration</p>}
      </section>
    </div>
  </main>;
}
