import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="PLAYER ACCESS" title="Welcome back" description={params.error === 'configuration' ? 'Account services require Supabase configuration before they can be used.' : 'Sign in through AwehBet’s secure, server-managed account flow.'}><AuthForm mode="login" next={params.next}/></AuthShell>;
}
