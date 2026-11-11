import { ShieldAlert } from 'lucide-react';
import { providerVerifications, providerMayLaunch } from '@/lib/provider-compliance';

export default function ProvidersPage() {
  return <section className="admin-workspace">
    <header className="dashboard-head"><p className="account-eyebrow">COMPLIANCE / PROVIDERS</p><h1>Provider registry</h1><p>Evidence register only. No provider is authorized by this page.</p></header>
    <div className="admin-safety"><ShieldAlert aria-hidden="true"/><div><strong>Fail-closed authorization</strong><p>Provider approvals require verified contracts, rights, eligibility, technical review and an independent final decision. This register cannot grant approval.</p></div></div>
    <div className="admin-table-wrap admin-panel"><table className="admin-table"><thead><tr><th>Provider</th><th>Licence evidence</th><th>Rights</th><th>Demo permission</th><th>Technical</th><th>Effective launch</th></tr></thead><tbody>
    {providerVerifications.map(provider => <tr key={provider.provider}><td><strong>{provider.provider}</strong></td><td>{provider.licenceStatus.replaceAll('_',' ')}</td><td>{provider.distributionRights}</td><td>{provider.demoPermission}</td><td>{provider.technicalValidation}</td><td><span className={providerMayLaunch(provider) ? 'admin-status admin-status-ok' : 'admin-status admin-status-blocked'}>{providerMayLaunch(provider) ? 'AUTHORIZED' : 'BLOCKED'}</span></td></tr>)}
    </tbody></table></div>
    <p className="admin-muted">Evidence references are unverified until independently reviewed. Approval transitions and evidence uploads are not enabled.</p>
  </section>;
}
