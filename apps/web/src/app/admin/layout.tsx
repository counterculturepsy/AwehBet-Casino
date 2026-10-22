import './admin.css';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const navigation = [
  { label: 'Overview', href: '/admin' },
  { label: 'Providers', href: '/admin/providers' },
  { label: 'Player account', href: '/account' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAdmin();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand">AwehBet <span>COMMAND CENTRE</span></Link>
      <nav aria-label="Administration">{navigation.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      <p>Access role: {role}<br/>Read-only compliance workspace</p>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
