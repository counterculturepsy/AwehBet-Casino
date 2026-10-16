import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';

export type AdminRole = 'owner' | 'admin' | 'viewer';

export async function requireAdmin() {
  const session = await createServerSupabaseClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) redirect('/login?next=/admin');
  const service = createServiceSupabaseClient();
  const { data, error: accessError } = await service.rpc('get_admin_role', { p_user_id: user.id });
  if (accessError || !data || !['owner','admin','viewer'].includes(data)) notFound();
  return { user, service, role: data as AdminRole };
}
