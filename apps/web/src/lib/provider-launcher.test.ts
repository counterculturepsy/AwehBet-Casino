import { describe, expect, it } from 'vitest';
import { validateProviderLaunch, type ProviderLaunchResponse } from './provider-launch-validation';

const now = new Date('2026-10-20T12:00:00.000Z');
const approvedHosts = ['games.provider.example'];
const launch = (overrides: Partial<ProviderLaunchResponse> = {}): ProviderLaunchResponse => ({
  launchUrl: 'https://games.provider.example/play?session=opaque',
  expiresAt: '2026-10-20T12:05:00.000Z',
  mode: 'demo',
  presentation: 'iframe',
  ...overrides,
});

describe('validateProviderLaunch', () => {
  it('accepts an approved HTTPS demo session', () => {
    expect(validateProviderLaunch(launch(), approvedHosts, now)).toEqual(launch());
  });

  it.each([
    'https://evil.example/play',
    'https://games.provider.example.evil.example/play',
    'http://games.provider.example/play',
    'https://user:pass@games.provider.example/play',
    'https://games.provider.example:8443/play',
  ])('rejects unsafe launch URL %s', (launchUrl) => {
    expect(() => validateProviderLaunch(launch({ launchUrl }), approvedHosts, now)).toThrow();
  });

  it.each(['2026-10-20T11:59:00.000Z', 'not-a-date'])('rejects invalid expiry %s', (expiresAt) => {
    expect(() => validateProviderLaunch(launch({ expiresAt }), approvedHosts, now)).toThrow();
  });

  it('fails closed when no provider hosts are approved', () => {
    expect(() => validateProviderLaunch(launch(), [], now)).toThrow();
  });

  it('rejects invalid modes and presentations at runtime', () => {
    expect(() => validateProviderLaunch({ ...launch(), mode: 'real' } as unknown as ProviderLaunchResponse, approvedHosts, now)).toThrow();
    expect(() => validateProviderLaunch({ ...launch(), presentation: 'popup' } as unknown as ProviderLaunchResponse, approvedHosts, now)).toThrow();
  });
});
