import { describe, expect, it } from 'vitest';
import { officialDemoHosts, officialDemoLink, officialDemoTitles } from './official-demo-links';
import { slotGames } from './slots-lobby-games';
import { approvedExternalDemoUrl, demoGames } from './demo-catalogue';

describe('official provider demo links', () => {
  it('every linked title exists in the lobby and resolves for its own provider', () => {
    for (const title of officialDemoTitles) {
      const game = slotGames.find(g => g.name === title);
      expect(game, title).toBeDefined();
      expect(officialDemoLink(title, game!.provider), title).not.toBeNull();
    }
  });
  it('only ever resolves to https on the title provider’s own allowlisted host', () => {
    for (const game of slotGames) {
      const link = officialDemoLink(game.name, game.provider);
      if (!link) continue;
      const url = new URL(link);
      expect(url.protocol).toBe('https:');
      expect(officialDemoHosts).toContain(url.hostname);
      expect(url.username + url.password + url.search + url.hash).toBe('');
    }
  });
  it('refuses a title paired with a different provider', () => {
    expect(officialDemoLink('Sweet Bonanza', 'Hacksaw Gaming')).toBeNull();
    expect(officialDemoLink('Le Bandit', 'Pragmatic Play')).toBeNull();
  });
  it('returns null for unknown titles, unknown providers and prototype keys', () => {
    expect(officialDemoLink('Not A Game', 'Pragmatic Play')).toBeNull();
    expect(officialDemoLink('Sweet Bonanza', 'Evil Corp')).toBeNull();
    expect(officialDemoLink('constructor', 'Pragmatic Play')).toBeNull();
    expect(officialDemoLink('Sweet Bonanza', 'toString')).toBeNull();
  });
  it('links exactly the 38 verified titles', () => {
    expect(officialDemoTitles).toHaveLength(38);
    expect(new Set(officialDemoTitles).size).toBe(38);
  });
  it('leaves unverified titles without a link', () => {
    for (const title of ['Majestic King', 'Dork Unit', 'Hand of Anubis', 'Mega Moolah', 'Immortal Romance', 'Thunderstruck II', 'Book of Atem']) {
      const game = slotGames.find(g => g.name === title)!;
      expect(officialDemoLink(title, game.provider), title).toBeNull();
    }
  });
  it('does not weaken the fail-closed approval gate', () => {
    expect(demoGames.every(game => approvedExternalDemoUrl(game) === null)).toBe(true);
  });
});
