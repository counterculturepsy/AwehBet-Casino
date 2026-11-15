import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Gamepad2, HeartHandshake, KeyRound, Megaphone, ShieldCheck, Wallet } from 'lucide-react';
import styles from './platform.module.css';

export const metadata: Metadata = {
  title: 'AwehBet Platform | Compliance-first player accounts for South African operators',
  description: 'Overview of the AwehBet development platform: player accounts, wallet ledger, verification states, responsible-gaming controls and operator tooling. No real-money gaming is connected.',
};

const capabilities = [
  {
    icon: KeyRound,
    title: 'Player accounts',
    body: 'Registration, email verification, sign-in and password recovery on cookie-backed server sessions. Identity numbers are encrypted before storage and never returned to the browser.',
  },
  {
    icon: Wallet,
    title: 'Wallet ledger',
    body: 'One rand wallet per player, held in integer minor units. Balances change only through an atomic, idempotent database function, and players have read-only access to their own records.',
  },
  {
    icon: BadgeCheck,
    title: 'Verification states',
    body: 'A status model for identity verification with a fail-closed interface. Document uploads and provider transitions stay disabled until a verification provider is approved.',
  },
  {
    icon: HeartHandshake,
    title: 'Responsible gaming',
    body: 'Deposit limits, cooling-off periods and self-exclusion are stored per player and available from the account area.',
  },
  {
    icon: Megaphone,
    title: 'Operator tooling',
    body: 'A role-gated admin area with a promotions workflow: drafts, server-validated review transitions and an audit trail.',
  },
  {
    icon: Gamepad2,
    title: 'Provider approval gate',
    body: 'Game launches are denied unless licence, certification and distribution evidence is recorded and current. No provider session can open without it.',
  },
] as const;

const safeguards = [
  'Payments, withdrawals and document uploads are off by default behind server-side flags.',
  'Wallet entries that are not simulated are rejected.',
  'Server routes verify the signed-in user, require same-origin requests, validate input and apply rate limits.',
  'Database access is restricted by row-level security, with service credentials kept in server-only modules.',
  'Unit tests, database security tests and browser tests run in continuous integration.',
] as const;

const outstanding = [
  'No gambling licence is held, and no licensing claim is made.',
  'No payment provider, verification provider or game provider is connected.',
  'Game mathematics and random number generation have not been certified.',
  'Legal, privacy and anti-money-laundering programmes need review by qualified South African counsel before any launch.',
] as const;

export default function PlatformPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}><img src="/assets/logo.webp" alt="AwehBet homepage" /></Link>
          <p className={styles.eyebrow}>AWEHBET PLATFORM · DEVELOPMENT STAGE</p>
          <h1>Compliance-first player accounts for South African operators</h1>
          <p className={styles.lead}>
            AwehBet is a player-account platform built for licensed operators: accounts, wallet, verification, responsible-gaming controls and operator tooling, designed around South African requirements from the first commit.
          </p>
          <p className={styles.status} role="note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>This is a development platform, not a live gambling service. No real-money gaming, deposits or payouts are connected.</span>
          </p>
        </header>

        <section aria-labelledby="capabilities-title">
          <h2 id="capabilities-title">What is built</h2>
          <ul className={styles.grid}>
            {capabilities.map(({ icon: Icon, title, body }) => (
              <li key={title} className={styles.card}>
                <Icon size={26} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="safeguards-title" className={styles.columns}>
          <div>
            <h2 id="safeguards-title">Built to fail closed</h2>
            <ul className={styles.list}>
              {safeguards.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div>
            <h2 id="outstanding-title">What is not done yet</h2>
            <ul className={styles.list} aria-labelledby="outstanding-title">
              {outstanding.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section aria-labelledby="explore-title">
          <h2 id="explore-title">See it running</h2>
          <p className={styles.text}>The reference player front end and account area are available in this preview. Game titles and artwork shown in the lobby are illustrative and are not licensed integrations.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/register">Create a demo account</Link>
            <Link className={styles.secondary} href="/account">Open the player dashboard</Link>
            <Link className={styles.secondary} href="/legal/responsible-gaming">Responsible gaming</Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <p>Partnership and investment enquiries: <a href="mailto:awehbet@gmail.com">awehbet@gmail.com</a></p>
          <p>18+ · Play responsibly · © {new Date().getFullYear()} AwehBet</p>
        </footer>
      </div>
    </main>
  );
}
