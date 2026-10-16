/**
 * Server-side player safety policy for the pre-launch AwehBet prototype.
 * This module intentionally fails closed. No browser-provided player state
 * or localStorage flag can authorise real-money play.
 */
export type PlayerSafetyDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export interface VerifiedPlayerSafetyRecord {
  /** Resolved from a trusted server-side authenticated session only. */
  authenticated: boolean;
  /** Verified by an approved identity verification service. */
  identityVerified: boolean;
  /** Verified by an approved age verification service. */
  ageVerified: boolean;
  /** Determined by authorised compliance processes. */
  jurisdictionApproved: boolean;
  /** Server-side exclusion and cooling-off state. */
  selfExcluded: boolean;
  coolingOffUntil?: string | null;
  /** Whether required account limits have been configured and enforced. */
  limitsEnforced: boolean;
}

export function assessRealMoneyEligibility(
  player: VerifiedPlayerSafetyRecord | null,
  options: { operatorApproved: boolean; now?: Date },
): PlayerSafetyDecision {
  if (!options.operatorApproved) return { allowed: false, reason: 'Real-money operations are not enabled.' };
  if (!player?.authenticated) return { allowed: false, reason: 'Authentication is required.' };
  if (!player.identityVerified || !player.ageVerified) return { allowed: false, reason: 'Verified identity and age are required.' };
  if (!player.jurisdictionApproved) return { allowed: false, reason: 'This gaming product is not authorised for the player jurisdiction.' };
  if (player.selfExcluded) return { allowed: false, reason: 'Player self-exclusion is active.' };
  if (player.coolingOffUntil) {
    const until = new Date(player.coolingOffUntil);
    if (!Number.isFinite(until.getTime())) return { allowed: false, reason: 'Cooling-off status is invalid.' };
    if (until.getTime() > (options.now ?? new Date()).getTime()) {
      return { allowed: false, reason: 'Player cooling-off period is active.' };
    }
  }
  if (!player.limitsEnforced) return { allowed: false, reason: 'Required player limits are not enforced.' };
  return { allowed: true };
}

/**
 * Integration status: there is no authenticated player-safety data source
 * configured in this prototype. Always deny until one is implemented.
 */
export function getTrustedPlayerSafetyRecord(): VerifiedPlayerSafetyRecord | null {
  return null;
}
