import { DEMO_CREDIT_UNIT } from './contracts.ts';

export type DemoGameConfig = Readonly<{
  gameId: string;
  version: string;
  status: 'engineering-demo';
  unit: typeof DEMO_CREDIT_UNIT;
  allowedStakes: readonly number[];
  maximumPayoutCredits: number;
  rulesStatus: 'not-certified';
  rtpStatus: 'not-defined';
}>;

export const demoSlotV1 = {
  gameId: 'awehbet-demo-slot',
  version: '0.1.0-demo.1',
  status: 'engineering-demo',
  unit: DEMO_CREDIT_UNIT,
  allowedStakes: [10, 20, 50, 100],
  maximumPayoutCredits: 100_000,
  rulesStatus: 'not-certified',
  rtpStatus: 'not-defined',
} as const satisfies DemoGameConfig;
