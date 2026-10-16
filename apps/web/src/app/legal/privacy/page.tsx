import { LegalDocument } from '@/components/legal/legal-document';
import { LegalMarkdown } from '@/components/legal/legal-markdown';

export default function PrivacyPage() {
  return <LegalDocument eyebrow="POPIA READINESS" title="AwehBet Privacy Policy"><LegalMarkdown file="privacy.md"/></LegalDocument>;
}
