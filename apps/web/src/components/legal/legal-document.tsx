import Link from 'next/link';

export function LegalDocument({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <main className="legal-page"><article className="legal-document"><header><Link href="/"><img src="/assets/logo.webp" alt="AwehBet homepage"/></Link><p className="account-eyebrow">{eyebrow}</p><span className="draft-badge">DEVELOPMENT DRAFT · LEGAL APPROVAL REQUIRED</span><h1>{title}</h1><p>Last updated 16 October 2026. This draft describes the development platform and must be reviewed by qualified South African counsel and the applicable regulator before publication or acceptance in production.</p></header>{children}<Link className="legal-back" href="/">← Back to AwehBet</Link></article></main>;
}
