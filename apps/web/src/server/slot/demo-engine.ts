import type { Outcome } from './contracts.ts';

export const DEMO_SYMBOLS = ['wild', 'aweh', 'ruby', 'diamond', 'crown', 'star'] as const;
export type DemoSymbol = (typeof DEMO_SYMBOLS)[number];
export type DemoGrid = readonly [
  readonly [DemoSymbol, DemoSymbol, DemoSymbol, DemoSymbol, DemoSymbol],
  readonly [DemoSymbol, DemoSymbol, DemoSymbol, DemoSymbol, DemoSymbol],
  readonly [DemoSymbol, DemoSymbol, DemoSymbol, DemoSymbol, DemoSymbol],
];

export type DemoLineWin = Readonly<{
  line: number;
  symbol: DemoSymbol;
  count: 3 | 4 | 5;
  payoutCredits: number;
}>;

export type DemoSlotPresentation = Readonly<{
  grid: DemoGrid;
  lineWins: readonly DemoLineWin[];
  totalPayoutCredits: number;
}>;

export interface RandomSource {
  nextInt(exclusiveMaximum: number): number;
}

const PAYLINES = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
] as const;

const WEIGHTS = [
  ['wild', 3],
  ['aweh', 5],
  ['ruby', 8],
  ['diamond', 12],
  ['crown', 18],
  ['star', 24],
] as const satisfies readonly (readonly [DemoSymbol, number])[];

const PAYTABLE: Readonly<Record<DemoSymbol, Readonly<Record<3 | 4 | 5, number>>>> = {
  wild: { 3: 15, 4: 40, 5: 100 },
  aweh: { 3: 10, 4: 25, 5: 75 },
  ruby: { 3: 8, 4: 20, 5: 50 },
  diamond: { 3: 6, 4: 15, 5: 40 },
  crown: { 3: 4, 4: 10, 5: 25 },
  star: { 3: 3, 4: 8, 5: 20 },
};

export const demoSlotRules = {
  rows: 3,
  reels: 5,
  fixedPaylines: PAYLINES.length,
  wildSymbol: 'wild',
  evaluation: 'left-to-right consecutive symbols; wild substitutes for every regular symbol',
  mathsStatus: 'engineering prototype; RTP and volatility not certified or approved',
} as const;

function pickSymbol(random: RandomSource): DemoSymbol {
  const totalWeight = WEIGHTS.reduce((total, [, weight]) => total + weight, 0);
  const value = random.nextInt(totalWeight);
  if (!Number.isSafeInteger(value) || value < 0 || value >= totalWeight) {
    throw new RangeError('Random source returned a value outside the requested range.');
  }
  let cursor = 0;
  for (const [symbol, weight] of WEIGHTS) {
    cursor += weight;
    if (value < cursor) return symbol;
  }
  throw new RangeError('Unable to map random value to a symbol.');
}

export function generateDemoGrid(random: RandomSource): DemoGrid {
  return Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => pickSymbol(random))) as unknown as DemoGrid;
}

export function evaluateDemoGrid(grid: DemoGrid, stakeCredits: number): DemoSlotPresentation {
  if (!Number.isSafeInteger(stakeCredits) || stakeCredits <= 0 || stakeCredits % PAYLINES.length !== 0) {
    throw new RangeError('Stake must be a positive integer divisible across all fixed paylines.');
  }

  const creditsPerLine = stakeCredits / PAYLINES.length;
  const lineWins: DemoLineWin[] = [];

  PAYLINES.forEach((rows, lineIndex) => {
    const symbols = rows.map((row, reel) => grid[row][reel]);
    const payingSymbol = symbols.find((symbol) => symbol !== 'wild') ?? 'wild';
    let count = 0;
    for (const symbol of symbols) {
      if (symbol !== payingSymbol && symbol !== 'wild') break;
      count += 1;
    }
    if (count < 3) return;
    const paidCount = Math.min(count, 5) as 3 | 4 | 5;
    lineWins.push({
      line: lineIndex + 1,
      symbol: payingSymbol,
      count: paidCount,
      payoutCredits: creditsPerLine * PAYTABLE[payingSymbol][paidCount],
    });
  });

  return {
    grid,
    lineWins,
    totalPayoutCredits: lineWins.reduce((total, win) => total + win.payoutCredits, 0),
  };
}

export function createDemoOutcome(
  stakeCredits: number,
  random: RandomSource,
  outcomeReference: string,
): Outcome<DemoSlotPresentation> {
  const presentation = evaluateDemoGrid(generateDemoGrid(random), stakeCredits);
  return { outcomeReference, payoutCredits: presentation.totalPayoutCredits, presentation };
}
