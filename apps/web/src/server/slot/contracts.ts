export const DEMO_CREDIT_UNIT = 'DEMO_CREDIT' as const;

export type DemoCreditUnit = typeof DEMO_CREDIT_UNIT;
export type RoundStatus = 'pending' | 'result_recorded' | 'settled' | 'rolled_back';

export type DemoGameSession = Readonly<{
  id: string;
  playerReference: string;
  mode: 'demo';
  scopes: readonly string[];
  adultDeclaredAt: string;
}>;

export type SpinRequest = Readonly<{
  gameId: string;
  gameVersion: string;
  idempotencyKey: string;
  stakeCredits: number;
  unit: DemoCreditUnit;
}>;

export type Outcome<TPresentation = unknown> = Readonly<{
  outcomeReference: string;
  payoutCredits: number;
  presentation: TPresentation;
}>;

export type Round<TPresentation = unknown> = Readonly<{
  id: string;
  sessionId: string;
  request: SpinRequest;
  requestFingerprint: string;
  status: RoundStatus;
  outcome?: Outcome<TPresentation>;
}>;

export type SpinResult<TPresentation = unknown> = Readonly<{
  roundId: string;
  status: 'settled';
  stakeCredits: number;
  payoutCredits: number;
  balanceCredits: number;
  unit: DemoCreditUnit;
  presentation: TPresentation;
  replayed: boolean;
  notice: 'SIMULATED CREDITS ONLY — NO CASH VALUE';
}>;

export interface RoundRepository<TPresentation = unknown> {
  reserve(round: Round<TPresentation>): Promise<{ kind: 'created'; round: Round<TPresentation> } | { kind: 'existing'; round: Round<TPresentation> }>;
  save(round: Round<TPresentation>): Promise<void>;
}

export interface WalletPort {
  getBalance(sessionId: string): Promise<number>;
  getDebitStatus(input: Readonly<{ transactionId: string; sessionId: string; amountCredits: number }>): Promise<'applied' | 'missing'>;
  debit(input: Readonly<{ transactionId: string; sessionId: string; amountCredits: number }>): Promise<void>;
  credit(input: Readonly<{ transactionId: string; sessionId: string; amountCredits: number }>): Promise<void>;
  rollbackDebit(input: Readonly<{ transactionId: string; sessionId: string }>): Promise<void>;
}

export interface OutcomeProvider<TPresentation = unknown> {
  evaluate(input: Readonly<{ roundId: string; gameId: string; gameVersion: string; stakeCredits: number }>): Promise<Outcome<TPresentation>>;
}
