import { requireAdmin } from '@/lib/admin';
import { PromotionStudio } from './promotion-studio';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The role is resolved on the server and only decides what the UI renders; the API and database authorise every action.
  const { role, user } = await requireAdmin();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  return <PromotionStudio role={role} viewerId={user.id} initialQuery={query.toString()} />;
}
