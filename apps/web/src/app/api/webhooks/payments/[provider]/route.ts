import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProviderAdapter } from '@/lib/payments/provider';

export async function POST(_request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const adapter = getPaymentProviderAdapter(provider);
  if (!adapter) {
    return NextResponse.json({ error: 'Payment provider is not configured.' }, { status: 503 });
  }

  // A future implementation must verify the signature against the untouched
  // raw body before parsing, deduplicate the provider event, compare the
  // server-side intent amount/currency/owner, and reconcile uncertain states.
  return NextResponse.json({ error: 'Live payment processing is disabled.' }, { status: 503 });
}
