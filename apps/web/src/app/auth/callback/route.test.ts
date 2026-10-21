import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: mocks }),
}));

import { GET } from './route';

describe('authentication callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('verifies a recovery token hash without requiring the initiating browser PKCE verifier', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    const request = new NextRequest('https://example.test/auth/callback?token_hash=recovery-token&type=recovery');

    const response = await GET(request);

    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'recovery-token', type: 'recovery' });
    expect(response.headers.get('location')).toBe('https://example.test/reset-password');
  });
});
