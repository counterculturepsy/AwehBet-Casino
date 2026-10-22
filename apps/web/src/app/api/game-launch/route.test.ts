import { describe, expect, it } from 'vitest';
import { POST } from './route';
const endpoint = 'http://localhost:3000/api/game-launch';
const post = (body: string, contentType = 'application/json') =>
 POST(new Request(endpoint, { method: 'POST', headers: { 'content-type': contentType }, body }));
describe('game-launch HTTP contract (no external provider credentials)', () => {
 it('returns 415 for non-JSON content', async () => {
   const response = await post('{}','text/plain'); expect(response.status).toBe(415);
 });
 it('returns 400 for malformed JSON', async () => {
   const response = await post('{'); expect(response.status).toBe(400);
 });
 it('returns 400 for live mode', async () => {
   const response = await post(JSON.stringify({gameId:'sweet-bonanza',mode:'real'})); expect(response.status).toBe(400);
 });
 it('returns 400 for client-supplied URL instead of game ID', async () => {
   const response = await post(JSON.stringify({gameId:'https://example.org',mode:'demo'})); expect(response.status).toBe(400);
 });
 it('returns 404 for unknown game', async () => {
   const response = await post(JSON.stringify({gameId:'unregistered-title',mode:'demo'})); expect(response.status).toBe(404);
 });
 it.each(['sweet-bonanza','gates-of-olympus','aviator'])('blocks %s without evidence', async gameId => {
   const response = await post(JSON.stringify({gameId,mode:'demo'}));
   expect(response.status).toBe(503);
   expect(await response.json()).toEqual({status:'unavailable',reason:'approval_required'});
   expect(response.headers.get('cache-control')).toBe('no-store');
 });
});
