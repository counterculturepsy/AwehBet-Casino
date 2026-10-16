export type SlotErrorCode =
  | 'DEMO_ONLY'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'INSUFFICIENT_CREDITS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'ROUND_IN_PROGRESS'
  | 'INVALID_OUTCOME';

export class SlotError extends Error {
  readonly code: SlotErrorCode;

  constructor(code: SlotErrorCode, message: string) {
    super(message);
    this.name = 'SlotError';
    this.code = code;
  }
}
