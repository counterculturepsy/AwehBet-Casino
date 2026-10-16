export type DemoGame = {
  id: string;
  title: string;
  studio: string;
  category: string;
  thumbnailUrl?: string;
};

export type DemoLaunch = { url: string };

type GameResponse = { games: DemoGame[] };
type LaunchResponse = { url: string };

/**
 * AwehBet-facing provider contract. The upstream integration gateway implements:
 * GET /games -> { games: DemoGame[] }
 * POST /launch { gameId, mode: 'demo' } -> { url: string }
 *
 * This is NOT a claimed Hub88/BGaming/SOFTSWISS wire protocol. Implement their
 * specific signing, session creation and catalogue mapping inside a private gateway.
 */
export class ProviderNotConfiguredError extends Error {
  constructor() { super('Demo provider is not configured'); }
}

function config(): { base: URL; apiKey: string; allowedHosts: string[] } {
  const raw = process.env.DEMO_GATEWAY_URL;
  const apiKey = process.env.DEMO_GATEWAY_API_KEY;
  const allowedHosts = (process.env.DEMO_GAME_HOSTS ?? '')
    .split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!raw || !apiKey || allowedHosts.length === 0) throw new ProviderNotConfiguredError();
  const base = new URL(raw);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid DEMO_GATEWAY_URL');
  }
  return { base, apiKey, allowedHosts };
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_:.\/-]{1,128}$/.test(value);
}

export function assertGameId(value: unknown): asserts value is string {
  if (!validId(value)) throw new Error('Invalid game ID');
}

async function request<T>(path: 'games' | 'launch', body?: object): Promise<T> {
  const { base, apiKey } = config();
  const url = new URL(base.toString().replace(/\/$/, '') + '/' + path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${apiKey}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function listDemoGames(): Promise<DemoGame[]> {
  const { games } = await request<GameResponse>('games');
  if (!Array.isArray(games)) throw new Error('Invalid provider catalogue');
  return games.filter((g): g is DemoGame =>
    typeof g === 'object' && g !== null && validId(g.id) &&
    typeof g.title === 'string' && g.title.length > 0 && g.title.length <= 150 &&
    typeof g.studio === 'string' && g.studio.length <= 100 &&
    typeof g.category === 'string' && g.category.length <= 100
  ).slice(0, 1000).map(g => ({
    id: g.id, title: g.title, studio: g.studio, category: g.category,
    thumbnailUrl: safeImage(g.thumbnailUrl),
  }));
}

function safeImage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try { const url = new URL(raw); return url.protocol === 'https:' ? url.toString() : undefined; }
  catch { return undefined; }
}

export async function launchDemoGame(gameId: string): Promise<DemoLaunch> {
  assertGameId(gameId);
  const { allowedHosts } = config();
  const launch = await request<LaunchResponse>('launch', { gameId, mode: 'demo' });
  if (!launch || typeof launch.url !== 'string') throw new Error('Invalid launch response');
  const url = new URL(launch.url);
  if (url.protocol !== 'https:' || url.username || url.password ||
      !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error('Unapproved launch destination');
  }
  return { url: url.toString() };
}
