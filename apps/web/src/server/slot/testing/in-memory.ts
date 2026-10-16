import type { Outcome, Round, RoundRepository, WalletPort } from '../contracts.ts';
import { SlotError } from '../errors.ts';

export class InMemoryRoundRepository<TPresentation = unknown> implements RoundRepository<TPresentation> {
  private readonly roundsByRequest = new Map<string, Round<TPresentation>>();
  private readonly roundsById = new Map<string, Round<TPresentation>>();

  async reserve(round: Round<TPresentation>): Promise<{ kind: 'created'; round: Round<TPresentation> } | { kind: 'existing'; round: Round<TPresentation> }> {
    const key = this.key(round.sessionId, round.request.idempotencyKey);
    const existing = this.roundsByRequest.get(key);
    if (existing) return { kind: 'existing', round: existing };
    if (this.roundsById.has(round.id)) {
      throw new SlotError('IDEMPOTENCY_CONFLICT', 'Round ID was reused for a different request.');
    }
    this.roundsByRequest.set(key, round);
    this.roundsById.set(round.id, round);
    return { kind: 'created', round };
  }

  async save(round: Round<TPresentation>): Promise<void> {
    this.roundsByRequest.set(this.key(round.sessionId, round.request.idempotencyKey), round);
    this.roundsById.set(round.id, round);
  }

  private key(sessionId: string, idempotencyKey: string): string {
    return `${sessionId}:${idempotencyKey}`;
  }
}

type LedgerEntry = Readonly<{ sessionId: string; amountCredits: number; kind: 'debit' | 'credit' | 'rollback' }>;

export class InMemoryDemoWallet implements WalletPort {
  private readonly balances = new Map<string, number>();
  readonly ledger = new Map<string, LedgerEntry>();

  constructor(initialBalances: Readonly<Record<string, number>>) {
    for (const [sessionId, balance] of Object.entries(initialBalances)) this.balances.set(sessionId, balance);
  }

  async getBalance(sessionId: string): Promise<number> {
    return this.balances.get(sessionId) ?? 0;
  }

  openDemoAccount(sessionId: string, initialCredits: number): void {
    this.assertPositiveAmount(initialCredits);
    if (this.balances.has(sessionId)) {
      throw new SlotError('IDEMPOTENCY_CONFLICT', 'Demo account already exists.');
    }
    this.balances.set(sessionId, initialCredits);
  }

  async getDebitStatus(
    input: Readonly<{ transactionId: string; sessionId: string; amountCredits: number }>,
  ): Promise<'applied' | 'missing'> {
    const existing = this.ledger.get(input.transactionId);
    if (!existing) return 'missing';
    this.assertSameTransaction(existing, input.sessionId, input.amountCredits, 'debit');
    return 'applied';
  }

  async debit(input: Readonly<{ transactionId: string; sessionId: string; amountCredits: number }>): Promise<void> {
    this.assertPositiveAmount(input.amountCredits);
    const existing = this.ledger.get(input.transactionId);
    if (existing) {
      this.assertSameTransaction(existing, input.sessionId, input.amountCredits, 'debit');
      return;
    }
    const balance = await this.getBalance(input.sessionId);
    if (balance < input.amountCredits) throw new SlotError('INSUFFICIENT_CREDITS', 'Insufficient simulated credits.');
    this.balances.set(input.sessionId, balance - input.amountCredits);
    this.ledger.set(input.transactionId, { sessionId: input.sessionId, amountCredits: input.amountCredits, kind: 'debit' });
  }

  async credit(input: Readonly<{ transactionId: string; sessionId: string; amountCredits: number }>): Promise<void> {
    this.assertPositiveAmount(input.amountCredits);
    const existing = this.ledger.get(input.transactionId);
    if (existing) {
      this.assertSameTransaction(existing, input.sessionId, input.amountCredits, 'credit');
      return;
    }
    this.balances.set(input.sessionId, (await this.getBalance(input.sessionId)) + input.amountCredits);
    this.ledger.set(input.transactionId, { sessionId: input.sessionId, amountCredits: input.amountCredits, kind: 'credit' });
  }

  async rollbackDebit(input: Readonly<{ transactionId: string; sessionId: string }>): Promise<void> {
    const debit = this.ledger.get(input.transactionId);
    const rollbackId = `${input.transactionId}:rollback`;
    if (!debit) return;
    this.assertSameTransaction(debit, input.sessionId, debit.amountCredits, 'debit');
    if (this.ledger.has(rollbackId)) return;
    this.balances.set(input.sessionId, (await this.getBalance(input.sessionId)) + debit.amountCredits);
    this.ledger.set(rollbackId, { sessionId: input.sessionId, amountCredits: debit.amountCredits, kind: 'rollback' });
  }

  private assertSameTransaction(
    existing: LedgerEntry,
    sessionId: string,
    amountCredits: number,
    kind: LedgerEntry['kind'],
  ): void {
    if (existing.sessionId !== sessionId || existing.amountCredits !== amountCredits || existing.kind !== kind) {
      throw new SlotError('IDEMPOTENCY_CONFLICT', 'Transaction ID was reused with different wallet data.');
    }
  }

  private assertPositiveAmount(amountCredits: number): void {
    if (!Number.isSafeInteger(amountCredits) || amountCredits <= 0) {
      throw new SlotError('INVALID_REQUEST', 'Wallet amount must be a positive integer number of demo credits.');
    }
  }
}

export function fixedOutcome<TPresentation>(outcome: Outcome<TPresentation>) {
  return { evaluate: async () => outcome };
}
