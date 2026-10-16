import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';

export type AdminRole = 'owner' | 'admin' | 'viewer';

export async function requireAdmin() {
  const session = await createServerSupabaseClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) redirect('/login?next=/admin');
  const service = createServiceSupabaseClient();
  const { data, error: accessError } = await service.schema('private').from('admin_members')
    .select('role').eq('user_id', user.id).maybeSingle();
  if (accessError || !data || !['owner','admin','viewer'].includes(data.role)) notFound();
  return { user, service, role: data.role as AdminRole };
}
