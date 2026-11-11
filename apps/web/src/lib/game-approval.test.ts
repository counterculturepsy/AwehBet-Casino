import { describe, expect, it } from 'vitest';
import { createDemoGameSession } from './provider-launcher';
import { approvedExternalDemoUrl, demoGames } from './demo-catalogue';
import { mayLaunchApprovedGame, type ApprovalBundle } from './game-approval';
import { providerVerifications } from './provider-compliance';
const date = new Date('2026-10-21T12:00:00Z');
const ev = (gameId?: string) => ({ status: 'verified' as const, reference: 'document-123', verifiedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-11-01T00:00:00Z', provider: 'Pragmatic Play', ...(gameId ? {gameId} : {}) });
const base: ApprovalBundle = { provider: {...providerVerifications[0], activationStatus:'approved', licenceStatus:'verified',gameCertification:'verified',operatorEligibility:'verified',distributionRights:'verified',demoPermission:'verified',technicalValidation:'verified'}, licence: ev(), operator:ev(), distribution:ev(), game:{gameId:'sweet-bonanza',provider:'Pragmatic Play',certification:ev('sweet-bonanza'),launchPermission:ev('sweet-bonanza'),enabled:true}};
describe('fail-closed launch approval', () => {
 it('rejects missing approval', () => expect(mayLaunchApprovedGame('sweet-bonanza',undefined,date)).toBe(false));
 it('rejects an unknown game', () => expect(mayLaunchApprovedGame('not-a-game',base,date)).toBe(false));
 it('rejects caller-forged approval when the canonical register is blocked', () => expect(mayLaunchApprovedGame('sweet-bonanza',base,date)).toBe(false));
 it('rejects missing evidence', () => expect(mayLaunchApprovedGame('sweet-bonanza',{...base, licence:undefined as never},date)).toBe(false));
 it('rejects expired evidence', () => expect(mayLaunchApprovedGame('sweet-bonanza',{...base,licence:{...ev(),expiresAt:'2026-10-20T00:00:00Z'}},date)).toBe(false));
 it('rejects inconsistent game evidence', () => expect(mayLaunchApprovedGame('sweet-bonanza',{...base,game:{...base.game,certification:ev('gates-of-olympus')}},date)).toBe(false));
 it('rejects inconsistent provider', () => expect(mayLaunchApprovedGame('sweet-bonanza',{...base,game:{...base.game,provider:'Hacksaw Gaming'}},date)).toBe(false));
 it('rejects invalid verification dates', () => expect(mayLaunchApprovedGame('sweet-bonanza',{...base,licence:{...ev(),verifiedAt:'invalid'}},date)).toBe(false));
 it('denies all direct provider demo links', () => {
   expect(demoGames.every(game => approvedExternalDemoUrl(game) === null)).toBe(true);
 });
 it('denies API-backed session creation for a registered title', async () => {
   expect(await createDemoGameSession({ gameId: 'sweet-bonanza', mode: 'demo' }))
     .toEqual({ status: 'unavailable', reason: 'approval_required' });
 });
 it('rejects inconsistent provider approval flags', () => {
   expect(mayLaunchApprovedGame('sweet-bonanza', {
     ...base, provider: { ...base.provider, gameCertification: 'unverified' }
   }, date)).toBe(false);
 });
});
