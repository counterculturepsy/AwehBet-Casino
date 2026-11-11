import './admin.css';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const navigation = [
  { label: 'Overview', href: '/admin' },
  { label: 'Providers', href: '/admin/providers' },
  { label: 'Promotions', href: '/admin/promotions' },
  { label: 'Player account', href: '/account' },
  { label: 'Back to website', href: '/' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAdmin();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand">AwehBet <span>ADMIN COMMAND CENTRE</span></Link>
      <nav aria-label="Administration">{navigation.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      <p>Access role: {role}<br/>Compliance and promotions workspace</p>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
