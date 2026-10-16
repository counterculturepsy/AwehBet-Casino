import { DEMO_CREDIT_UNIT, type SpinRequest } from './contracts.ts';
import type { DemoGameConfig } from './config.ts';
import { SlotError } from './errors.ts';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const REQUEST_KEYS = ['gameId', 'gameVersion', 'idempotencyKey', 'stakeCredits', 'unit'] as const;

export function parseSpinRequest(input: unknown, config: DemoGameConfig): SpinRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SlotError('INVALID_REQUEST', 'Spin request must be an object.');
  }

  const record = input as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !REQUEST_KEYS.includes(key as (typeof REQUEST_KEYS)[number]));
  if (unknownKeys.length > 0) throw new SlotError('INVALID_REQUEST', 'Spin request contains unsupported fields.');

  const { gameId, gameVersion, idempotencyKey, stakeCredits, unit } = record;
  if (gameId !== config.gameId || gameVersion !== config.version) {
    throw new SlotError('INVALID_REQUEST', 'Unknown or retired game configuration.');
  }
  if (typeof idempotencyKey !== 'string' || !ID_PATTERN.test(idempotencyKey)) {
    throw new SlotError('INVALID_REQUEST', 'Idempotency key is invalid.');
  }
  if (unit !== DEMO_CREDIT_UNIT) {
    throw new SlotError('DEMO_ONLY', 'Only simulated demo credits are accepted.');
  }
  if (!Number.isSafeInteger(stakeCredits) || !config.allowedStakes.includes(stakeCredits as number)) {
    throw new SlotError('INVALID_REQUEST', 'Stake is not in the versioned allowlist.');
  }

  return { gameId, gameVersion, idempotencyKey, stakeCredits: stakeCredits as number, unit };
}

export function requestFingerprint(request: SpinRequest): string {
  return [request.gameId, request.gameVersion, request.idempotencyKey, request.stakeCredits, request.unit].join('|');
}
