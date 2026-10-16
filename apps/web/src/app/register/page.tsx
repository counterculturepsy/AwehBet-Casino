import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function RegisterPage() {
  return <AuthShell eyebrow="18+ ACCOUNT REGISTRATION" title="Create your AwehBet account" description="Enter accurate details. Identity information is encrypted and kept outside public player records."><AuthForm mode="register"/></AuthShell>;
}
