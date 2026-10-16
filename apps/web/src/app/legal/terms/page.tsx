import { LegalDocument } from '@/components/legal/legal-document';
import { LegalMarkdown } from '@/components/legal/legal-markdown';

export default function TermsPage() {
  return <LegalDocument eyebrow="ACCOUNT TERMS" title="AwehBet Terms and Conditions"><LegalMarkdown file="terms.md"/></LegalDocument>;
}
