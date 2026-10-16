'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BadgeCheck, CircleUserRound, CreditCard, History, Landmark, LayoutDashboard, LogOut, Shield, WalletCards } from 'lucide-react';

const links = [
  ['/account', 'Overview', LayoutDashboard], ['/account/profile', 'My Account', CircleUserRound],
  ['/account/transactions', 'Transactions', History], ['/account/deposit', 'Deposit Centre', CreditCard],
  ['/account/withdraw', 'Withdrawals', Landmark], ['/account/verification', 'Verification', BadgeCheck],
  ['/account/security', 'Security', Shield], ['/account/responsible-gaming', 'Responsible Gaming', WalletCards],
] as const;

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    router.push('/'); router.refresh();
  }
  return <aside className="account-sidebar"><Link href="/" className="account-brand"><img src="/assets/logo.webp" alt="AwehBet"/></Link><nav aria-label="Player account">{links.map(([href, label, Icon]) => <Link key={href} href={href} className={pathname === href ? 'active' : ''}><Icon/>{label}</Link>)}</nav><button type="button" onClick={logout}><LogOut/> Sign out</button><p>18+ · Development mode<br/>No real-money transactions</p></aside>;
}
