import { DepositForm } from '@/components/account/deposit-form';
import { getCapitecDirectDepositConfig } from '@/lib/payments/capitec-direct-deposit';

export default function DepositPage() {
  const capitecDirectDeposit = getCapitecDirectDepositConfig().enabled;
  return <><header className="dashboard-head"><p className="account-eyebrow">PAYMENT CENTRE · DEMO</p><h1>Deposit Centre</h1><p>Explore planned South African methods. Provider connections and real payments are disabled.</p></header><section className="dashboard-panel"><DepositForm capitecDirectDeposit={capitecDirectDeposit}/></section></>;
}
