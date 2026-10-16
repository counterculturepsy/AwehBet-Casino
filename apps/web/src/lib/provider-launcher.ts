/**
 * Provider-neutral sandbox launch contract.
 * No provider credentials or authorised endpoints are configured yet.
 * Never accept arbitrary provider URLs from the client.
 */
export type LaunchMode = 'demo';
export type LaunchRequest = { gameId: string; mode: LaunchMode };
export type LaunchResult =
  | { status: 'unavailable'; reason: 'provider_not_configured' | 'unknown_game' }
  | { status: 'ready'; launchUrl: string };

const catalogue: Record<string, { provider: string; title: string }> = {
  aviator: { provider: 'SPRIBE', title: 'Aviator' },
  'sweet-bonanza': { provider: 'Pragmatic Play', title: 'Sweet Bonanza' },
  'gates-of-olympus': { provider: 'Pragmatic Play', title: 'Gates of Olympus' },
};

export function getLaunchableGame(gameId: string) {
  return Object.prototype.hasOwnProperty.call(catalogue, gameId)
    ? catalogue[gameId]
    : null;
}

export async function createDemoGameSession(request: LaunchRequest): Promise<LaunchResult> {
  if (!getLaunchableGame(request.gameId)) {
    return { status: 'unavailable', reason: 'unknown_game' };
  }
  // Replace only after a provider contract, approved sandbox API and server-side validation.
  return { status: 'unavailable', reason: 'provider_not_configured' };
}
