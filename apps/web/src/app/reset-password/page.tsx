import { ResetPasswordForm } from '@/components/auth/recovery-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function ResetPasswordPage() {
  return <AuthShell eyebrow="SECURE PASSWORD RESET" title="Choose a new password" description="Your recovery link must still be valid for this change to succeed."><ResetPasswordForm/></AuthShell>;
}
