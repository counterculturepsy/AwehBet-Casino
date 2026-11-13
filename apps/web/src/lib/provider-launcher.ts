import 'server-only';

import { findDemoGame } from '@/lib/games/catalogue';
import {
  validateProviderLaunch,
  type ProviderLaunchResponse,
} from '@/lib/provider-launch-validation';

export { validateProviderLaunch } from '@/lib/provider-launch-validation';
export type { ProviderLaunchResponse } from '@/lib/provider-launch-validation';

export type LaunchMode = 'demo';
export type LaunchRequest = { gameId: string; mode: LaunchMode };
export type LaunchResult =
  | { status: 'unavailable'; reason: 'provider_not_configured' | 'unknown_game' }
  | {
      status: 'ready';
      launchUrl: string;
      expiresAt?: string;
      presentation: 'iframe' | 'redirect';
    };

export type ProviderLaunchRequest = Readonly<{
  gameId: string;
  locale: 'en-ZA';
  mode: 'demo';
  returnUrl: string;
  sessionId: string;
}>;

export interface DemoProviderAdapter {
  readonly id: string;
  launchDemo(request: ProviderLaunchRequest): Promise<ProviderLaunchResponse>;
}

class ProviderNotConfiguredError extends Error {}

class UnconfiguredProviderAdapter implements DemoProviderAdapter {
  readonly id = 'unconfigured';

  async launchDemo(_request: ProviderLaunchRequest): Promise<ProviderLaunchResponse> {
    throw new ProviderNotConfiguredError('Authorised provider sandbox access is not configured.');
  }
}

export type ProviderLaunchDependencies = Readonly<{
  adapter: DemoProviderAdapter;
  approvedHosts: readonly string[];
  now?: Date;
  returnUrl: string;
  sessionId: string;
}>;

const defaultAdapter = new UnconfiguredProviderAdapter();

export function getDemoProviderAdapter(): DemoProviderAdapter {
  return defaultAdapter;
}

export function getApprovedProviderHosts() {
  return (process.env.DEMO_PROVIDER_LAUNCH_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function getLaunchableGame(gameId: string) {
  return findDemoGame(gameId) ?? null;
}

export async function createDemoGameSession(
  request: LaunchRequest,
  dependencies?: ProviderLaunchDependencies,
): Promise<LaunchResult> {
  if (!getLaunchableGame(request.gameId)) {
    return { status: 'unavailable', reason: 'unknown_game' };
  }

  const resolved = dependencies ?? {
    adapter: defaultAdapter,
    approvedHosts: getApprovedProviderHosts(),
    returnUrl: '',
    sessionId: crypto.randomUUID(),
  };

  try {
    const response = await resolved.adapter.launchDemo({
      gameId: request.gameId,
      locale: 'en-ZA',
      mode: 'demo',
      returnUrl: resolved.returnUrl,
      sessionId: resolved.sessionId,
    });
    const validated = validateProviderLaunch(response, resolved.approvedHosts, resolved.now);
    return { status: 'ready', ...validated };
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return { status: 'unavailable', reason: 'provider_not_configured' };
    }
    throw error;
  }
}
