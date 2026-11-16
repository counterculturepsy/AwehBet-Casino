/**
 * Outbound links to each provider's OWN public game page, where the provider
 * itself hosts a free-play demo. These are plain hyperlinks that open in a new
 * tab: nothing is embedded, proxied or launched through AwehBet, and no
 * provider game id or launch URL is constructed here.
 *
 * This is deliberately separate from the fail-closed approval gate in
 * game-approval.ts / demo-catalogue.ts, which still governs any embedded or
 * API-launched session. A link here is NOT evidence of distribution rights.
 *
 * Every URL below was loaded on the provider's site on the verification date.
 * Titles without a verified provider page are intentionally absent.
 */
export const OFFICIAL_DEMO_LINKS_VERIFIED_ON = '2026-11-16';

const PROVIDER_HOSTS: Readonly<Record<string, string>> = {
  'Pragmatic Play': 'www.pragmaticplay.com',
  'Hacksaw Gaming': 'www.hacksawgaming.com',
  "Play'n GO": 'www.playngo.com',
  'NoLimit City': 'nolimitcity.com',
  NetEnt: 'netent.com',
  'Push Gaming': 'www.pushgaming.com',
  'Big Time Gaming': 'www.bigtimegaming.com',
  Spribe: 'spribe.co',
};

/** Provider -> exact lobby title -> path on that provider's host. */
const DEMO_PAGE_PATHS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'Pragmatic Play': {
    'Gates of Olympus 1000': '/en/games/gates-of-olympus-1000/',
    'Sweet Bonanza': '/en/games/sweet-bonanza-slot/',
    'Big Bass Splash': '/en/games/big-bass-splash/',
    'Sugar Rush': '/en/games/sugar-rush/',
    'Buffalo King': '/en/games/buffalo-king-slot/',
    'Zeus vs Hades': '/en/games/zeus-vs-hades-gods-of-war/',
    'Starlight Princess': '/en/games/starlight-princess/',
    'Gates of Olympus': '/en/games/gates-of-olympus/',
    'Sweet Bonanza 1000': '/en/games/sweet-bonanza-1000/',
    'The Dog House': '/en/games/the-dog-house-slot/',
    'Big Bass Bonanza': '/en/games/big-bass-bonanza/',
    'Fruit Party': '/en/games/fruit-party-slot/',
  },
  'Hacksaw Gaming': {
    'Wanted Dead or a Wild': '/games/wanted-dead-or-a-wild',
    'Le Bandit': '/games/le-bandit',
    'Chaos Crew': '/games/chaos-crew',
  },
  "Play'n GO": {
    'Book of Dead': '/games/book-of-dead',
    Reactoonz: '/games/reactoonz',
    'Legacy of Dead': '/games/legacy-of-dead',
    'Rise of Olympus': '/games/rise-of-olympus',
    'Moon Princess': '/games/moon-princess',
  },
  'NoLimit City': {
    Mental: '/games/mental',
    'Tombstone RIP': '/games/tombstone-rip',
    'San Quentin xWays': '/games/san-quentin',
    Deadwood: '/games/deadwood',
    'Fire in the Hole xBomb': '/games/fire-in-the-hole',
  },
  NetEnt: {
    Starburst: '/games/starburst',
    'Gonzo’s Quest': '/games/gonzos-quest',
    'Dead or Alive 2': '/games/dead-or-alive-2',
    'Divine Fortune': '/games/divine-fortune',
  },
  'Push Gaming': {
    'Jammin Jars': '/games/jammin-jars.html',
    'Razor Shark': '/games/razor-shark.html',
    'Fat Rabbit': '/games/fat-rabbit.html',
    'Wild Swarm': '/games/wild-swarm.html',
  },
  'Big Time Gaming': {
    Bonanza: '/games/bonanza',
    'Extra Chilli': '/games/extra-chilli',
    'Who Wants to Be a Millionaire Megaways': '/games/millionaire',
    'White Rabbit': '/games/white-rabbit',
  },
  Spribe: {
    Aviator: '/games/aviator',
  },
};

const SAFE_PATH = /^\/[a-z0-9\-/.]*$/;

/**
 * Returns the provider-hosted demo page for a lobby title, or null.
 * Fails closed: the host comes only from the fixed provider table, so a title
 * can never resolve to a host other than its own provider's website.
 */
export function officialDemoLink(title: string, provider: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(PROVIDER_HOSTS, provider)) return null;
  if (!Object.prototype.hasOwnProperty.call(DEMO_PAGE_PATHS, provider)) return null;
  const paths = DEMO_PAGE_PATHS[provider];
  if (!Object.prototype.hasOwnProperty.call(paths, title)) return null;
  const path = paths[title];
  if (!SAFE_PATH.test(path) || path.includes('..') || path.includes('//')) return null;
  const url = new URL(`https://${PROVIDER_HOSTS[provider]}${path}`);
  return url.hostname === PROVIDER_HOSTS[provider] ? url.toString() : null;
}

export const officialDemoTitles: readonly string[] = Object.values(DEMO_PAGE_PATHS).flatMap(paths => Object.keys(paths));
export const officialDemoHosts: readonly string[] = Object.values(PROVIDER_HOSTS);
