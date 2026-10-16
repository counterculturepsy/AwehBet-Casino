'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
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
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Sign out failed');
      router.replace('/');
      router.refresh();
    } catch {
      setLogoutError('Could not sign out. Please try again.');
      setSigningOut(false);
    }
  }
  return <aside className="account-sidebar">
    <Link href="/" className="account-brand" aria-label="AwehBet home"><img src="/assets/logo.webp" alt="AwehBet"/></Link>
    <nav aria-label="Player account">{links.map(([href, title, Icon]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={pathname === href ? 'active' : ''}><Icon aria-hidden="true"/>{title}</Link>)}</nav>
    <button type="button" onClick={logout} disabled={signingOut}><LogOut aria-hidden="true"/> {signingOut ? 'Signing out…' : 'Sign out'}</button>
    {logoutError && <div className="account-nav-error" role="alert">{logoutError}</div>}
    <p>18+ · Development mode<br/>No real-money transactions</p>
  </aside>;
}
