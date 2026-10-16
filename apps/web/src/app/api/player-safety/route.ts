import { NextResponse } from 'next/server';
import { assessRealMoneyEligibility, getTrustedPlayerSafetyRecord } from '../../../lib/player-safety/policy';

export const dynamic = 'force-dynamic';

/** Read-only pre-launch status. Does not accept or expose identity documents. */
export async function GET() {
  const decision = assessRealMoneyEligibility(getTrustedPlayerSafetyRecord(), {
    operatorApproved: false,
  });
  return NextResponse.json(
    {
      environment: 'prototype',
      realMoneyAvailable: decision.allowed,
      safeguards: {
        identityVerification: 'not_connected',
        ageVerification: 'not_connected',
        selfExclusion: 'not_enforced',
        coolingOff: 'not_enforced',
        playerLimits: 'not_enforced',
      },
      reason: decision.allowed ? null : decision.reason,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
