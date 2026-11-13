import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from './same-origin';

describe('isSameOriginRequest', () => {
  it('uses the request host when Next internally normalizes the URL hostname', () => {
    const headers = new Headers({
      host: '127.0.0.1:3000',
      origin: 'http://127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
    });
    expect(isSameOriginRequest(headers, new URL('http://localhost:3000/api/game-launch'))).toBe(true);
  });

  it('uses trusted proxy host and protocol headers when present', () => {
    const headers = new Headers({
      host: 'internal:3000',
      origin: 'https://preview.awehbet.example',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-host': 'preview.awehbet.example',
      'x-forwarded-proto': 'https',
    });
    expect(isSameOriginRequest(headers, new URL('http://internal:3000/api/game-launch'))).toBe(true);
  });

  it('rejects cross-origin and cross-site requests', () => {
    const crossOrigin = new Headers({ host: 'awehbet.example', origin: 'https://attacker.example' });
    const crossSite = new Headers({
      host: 'awehbet.example',
      origin: 'https://awehbet.example',
      'sec-fetch-site': 'cross-site',
    });
    expect(isSameOriginRequest(crossOrigin, new URL('https://awehbet.example/api/game-launch'))).toBe(false);
    expect(isSameOriginRequest(crossSite, new URL('https://awehbet.example/api/game-launch'))).toBe(false);
  });

  it('fails closed when the Origin header is missing or malformed', () => {
    expect(isSameOriginRequest(new Headers({ host: 'awehbet.example' }), new URL('https://awehbet.example'))).toBe(false);
    expect(isSameOriginRequest(new Headers({ host: 'awehbet.example', origin: 'not a url' }), new URL('https://awehbet.example'))).toBe(false);
  });
});
