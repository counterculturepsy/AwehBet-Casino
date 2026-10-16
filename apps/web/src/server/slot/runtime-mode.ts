import { SlotError } from './errors.ts';

export type SafeGameRuntimeMode = 'disabled' | 'demo';

export function parseGameRuntimeMode(value: string | undefined): SafeGameRuntimeMode {
  if (value === undefined || value === '' || value === 'disabled') return 'disabled';
  if (value === 'demo') return 'demo';
  if (value === 'real-money') {
    throw new SlotError('DEMO_ONLY', 'Real-money mode is not implemented or permitted by this application.');
  }
  throw new SlotError('DEMO_ONLY', `Unsupported game runtime mode: ${value}`);
}
