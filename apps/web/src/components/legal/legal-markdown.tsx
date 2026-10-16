import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type LegalFile = 'privacy.md' | 'terms.md';

function readLegalFile(file: LegalFile) {
  const candidates = [
    join(process.cwd(), 'public', 'legal-documents', file),
    join(process.cwd(), 'apps', 'web', 'public', 'legal-documents', file),
  ];
  const path = candidates.find(existsSync);
  if (!path) throw new Error(`Legal document is unavailable: ${file}`);
  return readFileSync(path, 'utf8').replace(/^# .+\r?\n+/, '');
}

export function LegalMarkdown({ file }: { file: LegalFile }) {
  return <div className="legal-markdown"><ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ href = '', children }) => {
        const external = /^https?:\/\//.test(href);
        return <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>;
      },
    }}
  >{readLegalFile(file)}</ReactMarkdown></div>;
}
