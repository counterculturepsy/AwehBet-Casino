/**
 * Provider-neutral casino game launch contracts.
 *
 * IMPORTANT: This module deliberately contains no guessed vendor endpoints.
 * Only an authorised aggregator's documented sandbox API may be connected.
 * Real-money mode is not implemented.
 */
export type GameMode = 'demo';
export type ProviderGame = {
  id: string;
  title: string;
  studio: string;
  aggregatorGameId?: string;
  demoAvailable: boolean;
  thumbnailUrl?: string;
};
export type LaunchRequest = {
  gameId: string;
  mode: GameMode;
  sessionId: string;
  locale: string;
  returnUrl: string;
};
export type LaunchResult =
  | {ok: true; launchUrl: string; expiresAt?: string}
  | {ok: false; code: 'NOT_CONFIGURED' | 'NOT_AUTHORISED' | 'GAME_UNAVAILABLE' | 'INVALID_REQUEST'; message: string};

export interface GameAggregator {
  listGames(): Promise<ProviderGame[]>;
  launchDemo(request: LaunchRequest): Promise<LaunchResult>;
}

export class UnconfiguredAggregator implements GameAggregator {
  async listGames(): Promise<ProviderGame[]> { return []; }
  async launchDemo(_request: LaunchRequest): Promise<LaunchResult> {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'A licensed game aggregator sandbox has not been connected yet.',
    };
  }
}

/** Explicitly disabled until a real authorised integration is installed. */
export const gameAggregator: GameAggregator = new UnconfiguredAggregator();
