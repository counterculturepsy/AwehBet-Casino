import 'server-only';

export type CapitecDirectDepositConfig = {
  enabled: boolean;
  source: string | null;
  expectedSha256: string | null;
  allowedHost: string | null;
};

export function getCapitecDirectDepositConfig(): CapitecDirectDepositConfig {
  const source = process.env.CAPITEC_PAYME_QR_SOURCE?.trim() || null;
  const expectedSha256 = process.env.CAPITEC_PAYME_QR_SHA256?.trim().toLowerCase() || null;
  const allowedHost = process.env.CAPITEC_PAYME_QR_ALLOWED_HOST?.trim().toLowerCase() || null;
  const explicitlyApproved = process.env.CAPITEC_DIRECT_DEPOSIT_APPROVED === 'true';
  const reconciliationReady = process.env.CAPITEC_RECONCILIATION_ENABLED === 'true';
  const paymentsEnabled = process.env.PAYMENTS_ENABLED === 'true';

  return {
    enabled: Boolean(source && explicitlyApproved && reconciliationReady && paymentsEnabled),
    source,
    expectedSha256,
    allowedHost,
  };
}
