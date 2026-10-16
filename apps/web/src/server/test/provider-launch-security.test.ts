import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDemoLaunch } from '../providers/validate-launch.js';
import type { DemoLaunchResult } from '../providers/contracts.js';

const approvedHosts = ['games.example.test'];
const now = new Date('2026-10-16T12:00:00.000Z');
const launch = (overrides: Partial<DemoLaunchResult> = {}): DemoLaunchResult => ({
  launchUrl: 'https://games.example.test/play?session=demo',
  mode: 'demo',
  presentation: 'iframe',
  expiresAt: '2026-10-16T12:05:00.000Z',
  ...overrides,
});

test('accepts an approved HTTPS demo launch', () => {
  assert.deepEqual(validateDemoLaunch(launch(), approvedHosts, now), launch());
});

test('rejects an unapproved provider domain, including deceptive subdomains', () => {
  for (const host of ['evil.example.test', 'games.example.test.evil.test']) {
    assert.throws(() => validateDemoLaunch(launch({ launchUrl: `https://${host}/play` }), approvedHosts, now));
  }
});

test('rejects HTTP and non-HTTPS schemes', () => {
  for (const url of ['http://games.example.test/play', 'javascript:alert(1)']) {
    assert.throws(() => validateDemoLaunch(launch({ launchUrl: url }), approvedHosts, now));
  }
});

test('rejects expired and malformed session expiries', () => {
  for (const expiresAt of ['2026-10-16T11:59:00.000Z', 'not-a-date']) {
    assert.throws(() => validateDemoLaunch(launch({ expiresAt }), approvedHosts, now));
  }
});

test('rejects embedded credentials and nonstandard ports', () => {
  for (const url of ['https://user:pass@games.example.test/play', 'https://games.example.test:8443/play']) {
    assert.throws(() => validateDemoLaunch(launch({ launchUrl: url }), approvedHosts, now));
  }
});

test('rejects non-demo modes and invalid presentation types at runtime', () => {
  assert.throws(() => validateDemoLaunch({ ...launch(), mode: 'real' } as unknown as DemoLaunchResult, approvedHosts, now));
  assert.throws(() => validateDemoLaunch({ ...launch(), presentation: 'popup' } as unknown as DemoLaunchResult, approvedHosts, now));
});

test('fails closed when no approved hosts are configured', () => {
  assert.throws(() => validateDemoLaunch(launch(), [], now));
});
