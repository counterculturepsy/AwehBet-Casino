export type DemoGame = {
  id: string;
  title: string;
  provider: string;
  category: 'Fantasy' | 'Sweets' | 'Adventure' | 'Western';
  artwork?: string;
};

export const demoGames: readonly DemoGame[] = [
  { id: 'gates-of-olympus', title: 'Gates of Olympus', provider: 'Pragmatic Play', category: 'Fantasy' },
  { id: 'sweet-bonanza', title: 'Sweet Bonanza', provider: 'Pragmatic Play', category: 'Sweets' },
  { id: 'big-bass-bonanza', title: 'Big Bass Bonanza', provider: 'Pragmatic Play', category: 'Adventure' },
  { id: 'book-of-dead', title: 'Book of Dead', provider: "Play'n GO", category: 'Adventure' },
  { id: 'wanted-dead-or-a-wild', title: 'Wanted Dead or a Wild', provider: 'Hacksaw Gaming', category: 'Western' },
];

export function findDemoGame(id: string): DemoGame | undefined {
  return demoGames.find(game => game.id === id);
}
