import { AccountNav } from '@/components/account/account-nav';
import { requirePlayer } from '@/lib/account';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requirePlayer();
  return <div className="account-shell"><AccountNav/><main className="account-main">{children}</main></div>;
}
