import './admin.css';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAdmin();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand">AwehBet <span>ADMIN</span></Link>
      <nav aria-label="Administration"><Link href="/admin">Overview</Link><Link href="/account">Player account</Link><Link href="/">Back to website</Link></nav>
      <p>Role: {role}<br/>Read-only administration</p>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
