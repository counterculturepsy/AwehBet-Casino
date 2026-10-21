import { currentApprovalForGame, mayLaunchApprovedGame } from './game-approval';
import { currentApprovalForGame, mayLaunchApprovedGame } from './game-approval';
/**
 * Demo-only provider catalogue. Entries are discovery records, NOT distribution rights.
 * Never enable a URL until the rights holder has approved the precise use.
 */
export type DemoLaunchMethod = 'unavailable' | 'external' | 'embed' | 'sandbox';
export type DemoGame = {
  slug: string;
  title: string;
  provider: string;
  category: string;
  launchMethod: DemoLaunchMethod;
  permission: 'pending' | 'approved';
  approvedUrl?: string;
};
export const demoGames: readonly DemoGame[] = [
  { slug: 'gates-of-olympus', title: 'Gates of Olympus', provider: 'Pragmatic Play', category: 'Slots', launchMethod: 'unavailable', permission: 'pending' },
  { slug: 'sweet-bonanza', title: 'Sweet Bonanza', provider: 'Pragmatic Play', category: 'Slots', launchMethod: 'unavailable', permission: 'pending' },
  { slug: 'big-bass-bonanza', title: 'Big Bass Bonanza', provider: 'Pragmatic Play', category: 'Slots', launchMethod: 'unavailable', permission: 'pending' },
  { slug: 'starlight-princess', title: 'Starlight Princess', provider: 'Pragmatic Play', category: 'Slots', launchMethod: 'unavailable', permission: 'pending' },
  { slug: 'wanted-dead-or-a-wild', title: 'Wanted Dead or a Wild', provider: 'Hacksaw Gaming', category: 'Slots', launchMethod: 'unavailable', permission: 'pending' },
  { slug: 'le-bandit', title: 'Le Bandit', provider: 'Hacksaw Gaming', category: 'Slots', launchMethod: 'unavailable', permission: 'pending' },
  { slug: 'book-of-dead', title: 'Book of Dead', provider: "Play'n GO", category: 'Slots', launchMethod: 'unavailable', permission: 'pending' },
  { slug: 'aviator', title: 'Aviator', provider: 'SPRIBE', category: 'Crash', launchMethod: 'unavailable', permission: 'pending' },
];
export function getDemoGame(slug: string): DemoGame | undefined {
  return demoGames.find(game => game.slug === slug);
}
export function approvedExternalDemoUrl(game: DemoGame): string | null {
  if (!mayLaunchApprovedGame(game.slug, currentApprovalForGame(game.slug))) return null;
  if (!mayLaunchApprovedGame(game.slug, currentApprovalForGame(game.slug)) || game.permission !== 'approved' || game.launchMethod !== 'external' || !game.approvedUrl) return null;
  try {
    const url = new URL(game.approvedUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // Each host must be explicitly reviewed before activation.
    const approvedHosts = new Set<string>([]);
    return approvedHosts.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}
