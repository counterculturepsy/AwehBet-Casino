import type { DemoGameConfig } from './config.ts';
import type { DemoGameSession, OutcomeProvider, Round, RoundRepository, SpinRequest, SpinResult, WalletPort } from './contracts.ts';
import { SlotError } from './errors.ts';
import { parseSpinRequest, requestFingerprint } from './validation.ts';

const PLAY_SCOPE = 'slot:demo:play';

export class DemoRoundService<TPresentation = unknown> {
  private readonly dependencies: Readonly<{
    config: DemoGameConfig;
    rounds: RoundRepository<TPresentation>;
    wallet: WalletPort;
    outcomes: OutcomeProvider<TPresentation>;
    createRoundId: () => string;
  }>;

  constructor(dependencies: DemoRoundService<TPresentation>['dependencies']) {
    this.dependencies = dependencies;
  }

  async play(session: DemoGameSession, request: SpinRequest): Promise<SpinResult<TPresentation>> {
    this.authorize(session);
    parseSpinRequest(request, this.dependencies.config);

    const fingerprint = requestFingerprint(request);
    const pending: Round<TPresentation> = {
      id: this.dependencies.createRoundId(),
      sessionId: session.id,
      request,
      requestFingerprint: fingerprint,
      status: 'pending',
    };
    const reservation = await this.dependencies.rounds.reserve(pending);

    if (reservation.kind === 'existing') {
      return this.replay(reservation.round, fingerprint);
    }

    const debitTransactionId = `${pending.id}:debit`;
    let debitCompleted = false;
    let resultRecorded = false;

    try {
      await this.ensureDebit({
        transactionId: debitTransactionId,
        sessionId: session.id,
        amountCredits: request.stakeCredits,
      });
      debitCompleted = true;

      const outcome = await this.dependencies.outcomes.evaluate({
        roundId: pending.id,
        gameId: request.gameId,
        gameVersion: request.gameVersion,
        stakeCredits: request.stakeCredits,
      });
      this.validateOutcome(outcome.payoutCredits, outcome.outcomeReference);

      const recorded = { ...pending, status: 'result_recorded' as const, outcome };
      await this.dependencies.rounds.save(recorded);
      resultRecorded = true;
      return this.settleRecordedRound(recorded, false);
    } catch (error) {
      if (!debitCompleted) {
        try {
          const debitStatus = await this.dependencies.wallet.getDebitStatus({
            transactionId: debitTransactionId,
            sessionId: session.id,
            amountCredits: request.stakeCredits,
          });
          if (debitStatus === 'missing') {
            await this.dependencies.rounds.save({ ...pending, status: 'rolled_back' });
          }
        } catch (statusError) {
          throw new SlotError(
            'ROUND_IN_PROGRESS',
            `Debit status is ambiguous and requires reconciliation: ${statusError instanceof Error ? statusError.name : 'unknown status error'}`,
          );
        }
      }
      if (debitCompleted && !resultRecorded) {
        await this.dependencies.wallet.rollbackDebit({ transactionId: debitTransactionId, sessionId: session.id });
        await this.dependencies.rounds.save({ ...pending, status: 'rolled_back' });
      }
      throw error;
    }
  }

  private authorize(session: DemoGameSession): void {
    if (session.mode !== 'demo') throw new SlotError('DEMO_ONLY', 'Only demo sessions are supported.');
    if (!session.scopes.includes(PLAY_SCOPE)) throw new SlotError('FORBIDDEN', 'Session cannot play the demo slot.');
    if (!session.adultDeclaredAt || Number.isNaN(Date.parse(session.adultDeclaredAt))) {
      throw new SlotError('FORBIDDEN', 'An adult-only demo declaration is required.');
    }
  }

  private validateOutcome(payoutCredits: number, outcomeReference?: string): void {
    if (!Number.isSafeInteger(payoutCredits) || payoutCredits < 0 || payoutCredits > this.dependencies.config.maximumPayoutCredits) {
      throw new SlotError('INVALID_OUTCOME', 'Outcome exceeded the configured demo payout boundary.');
    }
    if (!outcomeReference || outcomeReference.length > 128) {
      throw new SlotError('INVALID_OUTCOME', 'Outcome reference is missing or invalid.');
    }
  }

  private async ensureDebit(
    input: Readonly<{ transactionId: string; sessionId: string; amountCredits: number }>,
  ): Promise<void> {
    try {
      await this.dependencies.wallet.debit(input);
    } catch (error) {
      const status = await this.dependencies.wallet.getDebitStatus(input);
      if (status === 'applied') return;
      throw error;
    }
  }

  private async replay(round: Round<TPresentation>, fingerprint: string): Promise<SpinResult<TPresentation>> {
    if (round.requestFingerprint !== fingerprint) {
      throw new SlotError('IDEMPOTENCY_CONFLICT', 'Idempotency key was reused with different request data.');
    }
    if (round.status === 'result_recorded' && round.outcome) {
      return this.settleRecordedRound({ ...round, status: 'result_recorded', outcome: round.outcome }, true);
    }
    if (round.status !== 'settled' || !round.outcome) {
      throw new SlotError('ROUND_IN_PROGRESS', 'The existing round is not settled.');
    }
    return this.toResult({ ...round, outcome: round.outcome }, await this.dependencies.wallet.getBalance(round.sessionId), true);
  }

  private async settleRecordedRound(
    round: Round<TPresentation> & { status: 'result_recorded'; outcome: NonNullable<Round<TPresentation>['outcome']> },
    replayed: boolean,
  ): Promise<SpinResult<TPresentation>> {
    if (round.outcome.payoutCredits > 0) {
      await this.dependencies.wallet.credit({
        transactionId: `${round.id}:credit`,
        sessionId: round.sessionId,
        amountCredits: round.outcome.payoutCredits,
      });
    }

    const settled = { ...round, status: 'settled' as const };
    await this.dependencies.rounds.save(settled);
    return this.toResult(settled, await this.dependencies.wallet.getBalance(round.sessionId), replayed);
  }

  private toResult(
    round: Round<TPresentation> & { outcome: NonNullable<Round<TPresentation>['outcome']> },
    balanceCredits: number,
    replayed: boolean,
  ): SpinResult<TPresentation> {
    return {
      roundId: round.id,
      status: 'settled',
      stakeCredits: round.request.stakeCredits,
      payoutCredits: round.outcome.payoutCredits,
      balanceCredits,
      unit: round.request.unit,
      presentation: round.outcome.presentation,
      replayed,
      notice: 'SIMULATED CREDITS ONLY — NO CASH VALUE',
    };
  }
}
