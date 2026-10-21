import { describe, expect, it, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { clientKey } from './request';

function req(headers: Record<string,string>) {
  return new NextRequest('https://awehbet.example/api/auth/login', { headers });
}
afterEach(() => { vi.unstubAllEnvs(); });
describe('rate limit proxy identity', () => {
  it('ignores spoofed forwarding headers without an explicit trusted proxy', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', '');
    expect(clientKey(req({'x-forwarded-for':'1.1.1.1'}), 'login'))
      .toBe(clientKey(req({'x-forwarded-for':'2.2.2.2','x-real-ip':'3.3.3.3'}), 'login'));
  });
  it('does not allow an arbitrary configured header', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', 'x-forwarded-for');
    expect(clientKey(req({'x-forwarded-for':'1.1.1.1'}), 'login'))
      .toBe(clientKey(req({'x-forwarded-for':'2.2.2.2'}), 'login'));
  });
  it('separates requests by explicitly trusted proxy header', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', 'cf-connecting-ip');
    expect(clientKey(req({'cf-connecting-ip':'1.1.1.1'}), 'login'))
      .not.toBe(clientKey(req({'cf-connecting-ip':'2.2.2.2'}), 'login'));
  });
});
