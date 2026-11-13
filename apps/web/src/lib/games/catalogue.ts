export type DemoGame = Readonly<{
  id: string;
  title: string;
  provider: string;
  category: 'Adventure' | 'Fantasy' | 'Sweets' | 'Western';
}>;

/**
 * Candidate provider titles for sandbox onboarding. Entries are not evidence of
 * distribution rights, configuration, or availability in any jurisdiction.
 */
export const demoGames: readonly DemoGame[] = [
  { id: 'gates-of-olympus', title: 'Gates of Olympus', provider: 'Pragmatic Play', category: 'Fantasy' },
  { id: 'sweet-bonanza', title: 'Sweet Bonanza', provider: 'Pragmatic Play', category: 'Sweets' },
  { id: 'big-bass-bonanza', title: 'Big Bass Bonanza', provider: 'Pragmatic Play', category: 'Adventure' },
  { id: 'book-of-dead', title: 'Book of Dead', provider: "Play'n GO", category: 'Adventure' },
  { id: 'wanted-dead-or-a-wild', title: 'Wanted Dead or a Wild', provider: 'Hacksaw Gaming', category: 'Western' },
];

export function findDemoGame(gameId: string) {
  return demoGames.find((game) => game.id === gameId);
}

export function findDemoGameByTitle(title: string) {
  const normalized = title.trim().toLocaleLowerCase('en-ZA');
  return demoGames.find((game) => game.title.toLocaleLowerCase('en-ZA') === normalized);
}
