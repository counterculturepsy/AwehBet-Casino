import 'server-only';

export type PaymentEventStatus = 'pending' | 'succeeded' | 'failed' | 'uncertain' | 'reversed';

export type VerifiedPaymentEvent = {
  eventId: string;
  merchantReference: string;
  providerReference: string;
  amountMinor: number;
  currency: 'ZAR';
  status: PaymentEventStatus;
  occurredAt: string;
};

export interface PaymentProviderAdapter {
  readonly provider: 'ozow' | 'peach' | 'payfast';
  createPayment(input: { merchantReference: string; amountMinor: number; returnUrl: string }): Promise<{ redirectUrl: string; providerReference: string }>;
  verifyAndNormalizeWebhook(rawBody: Uint8Array, headers: Headers): Promise<VerifiedPaymentEvent>;
  fetchStatus(providerReference: string): Promise<VerifiedPaymentEvent>;
}

/**
 * Provider adapters are deliberately absent until an authorised merchant,
 * approved gambling product, signed agreement, sandbox credentials and
 * webhook-verification specification are available.
 */
export function getPaymentProviderAdapter(_provider: string): PaymentProviderAdapter | null {
  return null;
}
