import { ForgotPasswordForm } from '@/components/auth/recovery-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function ForgotPasswordPage() {
  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="Reset your password" description="We will send recovery instructions if the email address belongs to an account."><ForgotPasswordForm/></AuthShell>;
}
