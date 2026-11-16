import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { buildHref, label, pageCount, pagesAreCapped, statusTone } from '@/lib/admin/view';

export function AdminHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <header className="dashboard-head"><p className="account-eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}

export function ReadOnlyNotice({ children }: { children: React.ReactNode }) {
  return <div className="admin-safety"><ShieldCheck aria-hidden="true"/><div><strong>Read-only</strong><p>{children}</p></div></div>;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <span className={`admin-status admin-status-${statusTone(status)}`}>{label(status)}</span>;
}

export function Pagination({ path, params, page, total }: { path: string; params: Record<string, string | number | null | undefined>; page: number; total: number | null | undefined }) {
  const pages = pageCount(total);
  if (pages <= 1) return null;
  return <nav className="admin-pagination" aria-label="Pagination">
    {page > 1 ? <Link className="admin-btn admin-btn-quiet" href={buildHref(path, { ...params, page: page - 1 })} rel="prev">Previous</Link> : <span className="admin-btn admin-btn-quiet" aria-disabled="true">Previous</span>}
    <span aria-current="page">Page {Math.min(page, pages)} of {pages}</span>
    {page < pages ? <Link className="admin-btn admin-btn-quiet" href={buildHref(path, { ...params, page: page + 1 })} rel="next">Next</Link> : <span className="admin-btn admin-btn-quiet" aria-disabled="true">Next</span>}
    {pagesAreCapped(total) && <p className="admin-muted admin-pagination-note">Only the first {pages} pages are listed. Narrow the filters to reach older records.</p>}
  </nav>;
}

export function LoadError({ what }: { what: string }) {
  return <p className="admin-error" role="alert">{what} could not be loaded. Try again shortly.</p>;
}
