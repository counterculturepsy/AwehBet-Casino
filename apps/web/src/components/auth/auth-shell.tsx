import Image from 'next/image';
import Link from 'next/link';

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-home" aria-label="AwehBet homepage"><Image src="/assets/logo.webp" width={220} height={120} alt="AwehBet" priority/></Link><p className="account-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}<p className="account-legal">18+ only · Development platform · No real-money deposits, withdrawals, or wagering</p></section></main>;
}
