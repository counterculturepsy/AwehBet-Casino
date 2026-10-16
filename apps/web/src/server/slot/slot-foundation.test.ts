import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoSlotV1 } from './config.ts';
import { DEMO_CREDIT_UNIT, type DemoGameSession, type Round, type SpinRequest } from './contracts.ts';
import { SlotError } from './errors.ts';
import { DemoRoundService } from './round-service.ts';
import { parseGameRuntimeMode } from './runtime-mode.ts';
import { fixedOutcome, InMemoryDemoWallet, InMemoryRoundRepository } from './testing/in-memory.ts';
import { parseSpinRequest } from './validation.ts';

const session: DemoGameSession = {
  id: 'session-demo-001',
  playerReference: 'opaque-player-001',
  mode: 'demo',
  scopes: ['slot:demo:play'],
  adultDeclaredAt: '2026-10-15T12:00:00.000Z',
};

const request: SpinRequest = {
  gameId: demoSlotV1.gameId,
  gameVersion: demoSlotV1.version,
  idempotencyKey: 'spin-request-0001',
  stakeCredits: 20,
  unit: DEMO_CREDIT_UNIT,
};

function service(payoutCredits = 50) {
  const rounds = new InMemoryRoundRepository();
  const wallet = new InMemoryDemoWallet({ [session.id]: 1_000 });
  const game = new DemoRoundService({
    config: demoSlotV1,
    rounds,
    wallet,
    outcomes: fixedOutcome({ outcomeReference: 'test-outcome-001', payoutCredits, presentation: null }),
    createRoundId: () => 'round-demo-001',
  });
  return { game, rounds, wallet };
}

async function expectSlotError(run: () => Promise<unknown>, code: SlotError['code']): Promise<void> {
  await assert.rejects(run, (error: unknown) => error instanceof SlotError && error.code === code);
}

describe('real-money safety boundary', () => {
  it('defaults to disabled and permits only explicit demo mode', () => {
    assert.equal(parseGameRuntimeMode(undefined), 'disabled');
    assert.equal(parseGameRuntimeMode('demo'), 'demo');
    assert.throws(() => parseGameRuntimeMode('real-money'), SlotError);
    assert.throws(() => parseGameRuntimeMode('production'), SlotError);
  });

  it('rejects cash-like units, unknown fields, and non-allowlisted stakes', () => {
    assert.throws(() => parseSpinRequest({ ...request, unit: 'ZAR' }, demoSlotV1), /simulated demo credits/i);
    assert.throws(() => parseSpinRequest({ ...request, stakeCredits: 25 }, demoSlotV1), /allowlist/i);
    assert.throws(() => parseSpinRequest({ ...request, clientPayout: 1_000_000 }, demoSlotV1), /unsupported fields/i);
  });
});

describe('server-authoritative demo round', () => {
  it('validates the request again at the service boundary before touching the wallet', async () => {
    const { game, wallet } = service();
    await expectSlotError(() => game.play(session, { ...request, idempotencyKey: 'short' }), 'INVALID_REQUEST');
    assert.equal(wallet.ledger.size, 0);
  });

  it('settles in integer demo credits and returns an explicit no-cash-value notice', async () => {
    const { game, wallet } = service();
    const result = await game.play(session, request);

    assert.deepEqual(
      { stakeCredits: result.stakeCredits, payoutCredits: result.payoutCredits, balanceCredits: result.balanceCredits, replayed: result.replayed },
      { stakeCredits: 20, payoutCredits: 50, balanceCredits: 1_030, replayed: false },
    );
    assert.match(result.notice, /NO CASH VALUE/);
    assert.equal(wallet.ledger.size, 2);
  });

  it('replays the same settled round without a second debit or credit', async () => {
    const { game, wallet } = service();
    const first = await game.play(session, request);
    const duplicate = await game.play(session, request);

    assert.equal(duplicate.roundId, first.roundId);
    assert.equal(duplicate.replayed, true);
    assert.equal(duplicate.balanceCredits, 1_030);
    assert.equal(wallet.ledger.size, 2);
  });

  it('resolves an ambiguous debit response from authoritative transaction status', async () => {
    class AmbiguousDebitWallet extends InMemoryDemoWallet {
      private failOnce = true;

      override async debit(input: Parameters<InMemoryDemoWallet['debit']>[0]): Promise<void> {
        await super.debit(input);
        if (this.failOnce) {
          this.failOnce = false;
          throw new Error('simulated lost debit response');
        }
      }
    }

    const rounds = new InMemoryRoundRepository();
    const wallet = new AmbiguousDebitWallet({ [session.id]: 1_000 });
    const game = new DemoRoundService({
      config: demoSlotV1,
      rounds,
      wallet,
      outcomes: fixedOutcome({ outcomeReference: 'test-outcome-ambiguous-debit', payoutCredits: 50, presentation: null }),
      createRoundId: () => 'round-demo-ambiguous-debit',
    });

    const result = await game.play(session, request);
    assert.equal(result.balanceCredits, 1_030);
    assert.equal(wallet.ledger.size, 2);
  });

  it('rejects reuse of an idempotency key with different request data', async () => {
    const { game } = service();
    await game.play(session, request);
    await expectSlotError(() => game.play(session, { ...request, stakeCredits: 50 }), 'IDEMPOTENCY_CONFLICT');
  });

  it('requires a scoped adult-only demo session', async () => {
    const { game } = service();
    await expectSlotError(() => game.play({ ...session, scopes: [] }, request), 'FORBIDDEN');
    await expectSlotError(() => game.play({ ...session, adultDeclaredAt: '' }, request), 'FORBIDDEN');
  });

  it('rolls the debit back when an outcome violates the configured cap', async () => {
    const { game, wallet } = service(demoSlotV1.maximumPayoutCredits + 1);
    await expectSlotError(() => game.play(session, request), 'INVALID_OUTCOME');
    assert.equal(await wallet.getBalance(session.id), 1_000);
    assert.deepEqual([...wallet.ledger.values()].map((entry) => entry.kind), ['debit', 'rollback']);
  });

  it('rolls the debit back when the outcome reference is missing', async () => {
    const rounds = new InMemoryRoundRepository();
    const wallet = new InMemoryDemoWallet({ [session.id]: 1_000 });
    const game = new DemoRoundService({
      config: demoSlotV1,
      rounds,
      wallet,
      outcomes: fixedOutcome({ outcomeReference: '', payoutCredits: 50, presentation: null }),
      createRoundId: () => 'round-demo-missing-outcome',
    });

    await expectSlotError(() => game.play(session, request), 'INVALID_OUTCOME');
    assert.equal(await wallet.getBalance(session.id), 1_000);
  });

  it('rejects an unaffordable stake without creating a ledger movement', async () => {
    const rounds = new InMemoryRoundRepository();
    const wallet = new InMemoryDemoWallet({ [session.id]: 10 });
    const game = new DemoRoundService({
      config: demoSlotV1,
      rounds,
      wallet,
      outcomes: fixedOutcome({ outcomeReference: 'test-outcome-insufficient', payoutCredits: 0, presentation: null }),
      createRoundId: () => 'round-demo-insufficient',
    });

    await expectSlotError(() => game.play(session, request), 'INSUFFICIENT_CREDITS');
    assert.equal(await wallet.getBalance(session.id), 10);
    assert.equal(wallet.ledger.size, 0);
  });

  it('resumes a recorded result without duplicating credit after settlement persistence fails', async () => {
    class FailOnceOnSettledRepository extends InMemoryRoundRepository {
      private shouldFail = true;

      override async save(round: Round): Promise<void> {
        if (round.status === 'settled' && this.shouldFail) {
          this.shouldFail = false;
          throw new Error('simulated persistence interruption');
        }
        await super.save(round);
      }
    }

    const rounds = new FailOnceOnSettledRepository();
    const wallet = new InMemoryDemoWallet({ [session.id]: 1_000 });
    const game = new DemoRoundService({
      config: demoSlotV1,
      rounds,
      wallet,
      outcomes: fixedOutcome({ outcomeReference: 'test-outcome-002', payoutCredits: 50, presentation: null }),
      createRoundId: () => 'round-demo-002',
    });

    await assert.rejects(() => game.play(session, request), /persistence interruption/);
    assert.equal(await wallet.getBalance(session.id), 1_030);

    const recovered = await game.play(session, request);
    assert.equal(recovered.balanceCredits, 1_030);
    assert.equal(recovered.replayed, true);
    assert.equal(wallet.ledger.size, 2);
  });

  it('rejects a wallet transaction ID reused with different data', async () => {
    const wallet = new InMemoryDemoWallet({ [session.id]: 1_000 });
    await wallet.debit({ transactionId: 'wallet-tx-001', sessionId: session.id, amountCredits: 20 });
    await expectSlotError(
      () => wallet.debit({ transactionId: 'wallet-tx-001', sessionId: session.id, amountCredits: 50 }),
      'IDEMPOTENCY_CONFLICT',
    );
    assert.equal(await wallet.getBalance(session.id), 980);
  });

  it('rejects non-positive or fractional wallet movements', async () => {
    const wallet = new InMemoryDemoWallet({ [session.id]: 1_000 });
    await expectSlotError(
      () => wallet.debit({ transactionId: 'wallet-tx-negative', sessionId: session.id, amountCredits: -1 }),
      'INVALID_REQUEST',
    );
    await expectSlotError(
      () => wallet.credit({ transactionId: 'wallet-tx-fractional', sessionId: session.id, amountCredits: 1.5 }),
      'INVALID_REQUEST',
    );
    assert.equal(await wallet.getBalance(session.id), 1_000);
  });

  it('rejects a generated round ID collision across different requests', async () => {
    const rounds = new InMemoryRoundRepository();
    const wallet = new InMemoryDemoWallet({ [session.id]: 1_000 });
    const game = new DemoRoundService({
      config: demoSlotV1,
      rounds,
      wallet,
      outcomes: fixedOutcome({ outcomeReference: 'test-outcome-round-collision', payoutCredits: 0, presentation: null }),
      createRoundId: () => 'round-demo-collision',
    });

    await game.play(session, request);
    await expectSlotError(
      () => game.play(session, { ...request, idempotencyKey: 'spin-request-0002' }),
      'IDEMPOTENCY_CONFLICT',
    );
    assert.equal(await wallet.getBalance(session.id), 980);
  });
});
