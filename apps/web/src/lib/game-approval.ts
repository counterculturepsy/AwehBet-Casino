import { demoGames } from './demo-catalogue';
import { providerVerifications, type ProviderVerification } from './provider-compliance';

export type Evidence = {
  status: 'verified' | 'unverified' | 'restricted';
  reference: string;
  verifiedAt: string;
  expiresAt: string;
  provider: string;
  gameId?: string;
};
export type GameApproval = {
  gameId: string;
  provider: string;
  certification: Evidence;
  launchPermission: Evidence;
  enabled: boolean;
};
export type ApprovalBundle = {
  provider: ProviderVerification;
  licence: Evidence;
  operator: Evidence;
  distribution: Evidence;
  game: GameApproval;
};
const evidenceValid = (e: Evidence | undefined, provider: string, gameId: string | undefined, now: Date): boolean => {
  if (!e || e.status !== 'verified' || e.provider !== provider || typeof e.reference !== 'string' || !e.reference.trim()) return false;
  if (gameId !== undefined ? e.gameId !== gameId : e.gameId !== undefined) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(e.verifiedAt) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(e.expiresAt)) return false;
  const start = Date.parse(e.verifiedAt), end = Date.parse(e.expiresAt), at = now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= at && at < end && end > start;
};
export function mayLaunchApprovedGame(gameId: string, bundle?: ApprovalBundle, now = new Date()): boolean {
  if (!bundle || !Number.isFinite(now.getTime())) return false;
  const catalogueGame = demoGames.find(g => g.slug === gameId);
  const registered = providerVerifications.find(p => p.provider === bundle.provider.provider);
  if (!catalogueGame || !registered || catalogueGame.provider !== bundle.provider.provider) return false;
  // The immutable compliance register is the authority; caller-provided approvals cannot override it.
  if (registered.activationStatus !== 'approved' ||
      registered.licenceStatus !== 'verified' ||
      registered.gameCertification !== 'verified' ||
      registered.operatorEligibility !== 'verified' ||
      registered.distributionRights !== 'verified' ||
      registered.demoPermission !== 'verified' ||
      registered.technicalValidation !== 'verified') return false;
  if (bundle.provider.activationStatus !== registered.activationStatus ||
      bundle.provider.licenceStatus !== registered.licenceStatus ||
      bundle.provider.gameCertification !== registered.gameCertification ||
      bundle.provider.operatorEligibility !== registered.operatorEligibility ||
      bundle.provider.distributionRights !== registered.distributionRights ||
      bundle.provider.demoPermission !== registered.demoPermission ||
      bundle.provider.technicalValidation !== registered.technicalValidation) return false;
  if (!bundle.game.enabled || bundle.game.gameId !== gameId || bundle.game.provider !== catalogueGame.provider) return false;
  return evidenceValid(bundle.licence, catalogueGame.provider, undefined, now)
    && evidenceValid(bundle.operator, catalogueGame.provider, undefined, now)
    && evidenceValid(bundle.distribution, catalogueGame.provider, undefined, now)
    && evidenceValid(bundle.game.certification, catalogueGame.provider, gameId, now)
    && evidenceValid(bundle.game.launchPermission, catalogueGame.provider, gameId, now);
}
// No persisted approval records or provider contracts are configured. Default deny.
export function currentApprovalForGame(_gameId: string): ApprovalBundle | undefined { return undefined; }
