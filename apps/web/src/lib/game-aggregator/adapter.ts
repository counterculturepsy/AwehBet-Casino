import { assessRealMoneyEligibility, getTrustedPlayerSafetyRecord } from '../player-safety/policy';

/**
 * AwehBet game-aggregator boundary.
 *
 * SOFTSWISS's marketing overview describes a single integration, catalogue,
 * tournaments, jackpots and reporting, but does not specify API contracts.
 * Do not infer endpoints or enable real-money gameplay from that brochure.
 */
export type GamingMode = 'demo' | 'real';
export type AggregatorStatus = 'not_configured' | 'sandbox' | 'production';

export interface AggregatedGame {
  id: string;
  providerId: string;
  providerName: string;
  title: string;
  categories: string[];
  thumbnailUrl?: string;
  supportedModes: GamingMode[];
  enabled: boolean;
  jurisdictions?: string[];
}

export interface GameLaunchRequest {
  gameId: string;
  mode: GamingMode;
  currency: 'ZAR';
  locale: string;
  /** Authenticated server-side player reference; never trust a browser-supplied ID. */
  playerId?: string;
}

export interface GameLaunchResult {
  launchUrl: string;
  expiresAt?: string;
}

export interface AggregatorCampaign {
  id: string;
  type: 'tournament' | 'jackpot';
  title: string;
  startsAt?: string;
  endsAt?: string;
  active: boolean;
}

export interface AggregatorAdapter {
  readonly status: AggregatorStatus;
  listGames(): Promise<AggregatedGame[]>;
  launchGame(request: GameLaunchRequest): Promise<GameLaunchResult>;
  listCampaigns(): Promise<AggregatorCampaign[]>;
}

/** Safe default: no third-party content or money movement is activated. */
export class UnconfiguredAggregator implements AggregatorAdapter {
  readonly status = 'not_configured' as const;

  async listGames(): Promise<AggregatedGame[]> {
    return [];
  }

  async listCampaigns(): Promise<AggregatorCampaign[]> {
    return [];
  }

  async launchGame(_request: GameLaunchRequest): Promise<GameLaunchResult> {
    throw new Error('Game provider integration is not configured.');
  }
}

/**
 * Integration policy: real-money launches remain disabled until an authenticated
 * provider adapter and server-side operator approval are explicitly configured.
 */
export function assertLaunchAllowed(
  request: GameLaunchRequest,
  status: AggregatorStatus,
  realMoneyEnabled: boolean,
): void {
  if (!request.gameId.trim()) throw new Error('Game ID is required.');
  if (request.currency !== 'ZAR') throw new Error('Unsupported currency.');
  if (status === 'not_configured') throw new Error('Game provider integration is not configured.');
  if (request.mode === 'real') {
    if (status !== 'production' || !realMoneyEnabled) {
      throw new Error('Real-money gameplay is unavailable.');
    }
    if (!request.playerId) throw new Error('An authenticated player is required.');
    // Fail closed until a trusted server-side player-safety data source is connected.
    // The request.playerId is not sufficient evidence of eligibility.
    const decision = assessRealMoneyEligibility(getTrustedPlayerSafetyRecord(), {
      operatorApproved: false,
    });
    if (!decision.allowed) throw new Error(decision.reason);
  }
}
