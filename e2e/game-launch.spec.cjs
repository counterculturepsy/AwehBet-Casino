const { test, expect } = require('@playwright/test');

const providers = /pragmaticplay|hacksawgaming|playngo|gamesglobal|gamingrealms|evolution|spribe/i;
const origin = 'http://127.0.0.1:3000';
function monitorLaunchEscapes(page) {
 const violations = [];
 const record = (kind, url) => violations.push(kind + ':' + url);
 page.context().on('page', popup => record('popup', popup.url()));
 page.on('popup', popup => record('popup', popup.url()));
 page.on('framenavigated', frame => {
  const url = frame.url();
  if (url === 'about:blank') return;
  if (frame === page.mainFrame()) {
   if (!url.startsWith(origin + '/')) record('external-main-frame', url);
  } else {
   record('child-frame-navigation', url);
  }
 });
 page.on('request', request => {
  const url = request.url();
  if (providers.test(url)) record('provider-request', url);
  if (request.isNavigationRequest() && !url.startsWith(origin + '/'))
   record('external-navigation-request', url);
 });
 page.on('response', response => {
  if (response.status() >= 300 && response.status() < 400) {
   const location = response.headers()['location'];
   if (location) {
    try {
     const target = new URL(location, response.url());
     if (target.origin !== origin) record('external-redirect', target.href);
    } catch { record('malformed-redirect', location); }
   }
  }
 });
 return async () => {
  await expect(page.locator('iframe, frame, object, embed')).toHaveCount(0);
  expect(page.url().startsWith(origin + '/')).toBe(true);
  expect(violations).toEqual([]);
 };
}

test('Slots Masters card -> preview -> launcher -> fail-closed denial', async ({page}) => {
 const assertNoEscape = monitorLaunchEscapes(page);
 await page.goto('/slots');
 await page.getByRole('button', {name:'View Sweet Bonanza',exact:true}).click();
 const dialog = page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('Awaiting authorised provider integration');
 await dialog.getByRole('link',{name:'Open game launcher'}).click();
 await expect(page).toHaveURL(/\/game-launcher\?game=Sweet%20Bonanza/);
 await page.getByRole('button',{name:'Check demo availability'}).click();
 await expect(page.getByRole('status')).toContainText('A playable provider session has not been enabled');
 await assertNoEscape();
 await assertNoEscape();
});

test('Launcher deep link and unknown game never open provider', async ({page}) => {
 const assertNoEscape = monitorLaunchEscapes(page);
 await page.goto('/game-launcher?game=Sweet%20Bonanza');
 await page.getByRole('button',{name:'Check demo availability'}).click();
 await expect(page.getByRole('status')).toContainText('not been enabled');
 await assertNoEscape();
 await page.goto('/game-launcher?game=https%3A%2F%2Fexample.org');
 await expect(page.getByText('Choose a supported game')).toBeVisible();
 await expect(page.getByRole('button',{name:'Check demo availability'})).toHaveCount(0);
 await assertNoEscape();
});

test('Demo catalogue card and direct game URL expose no provider link or iframe', async ({page}) => {
 const assertNoEscape = monitorLaunchEscapes(page);
 await page.goto('/demo-games');
 await page.getByRole('link',{name:'View game →'}).first().click();
 await expect(page).toHaveURL(/\/demo-games\/[^/]+$/);
 await expect(page.getByRole('status')).toContainText('Awaiting provider permission');
 await assertNoEscape();
 await expect(page.locator('iframe')).toHaveCount(0);
 await expect(page.getByRole('link',{name:/Open authorised official demo/})).toHaveCount(0);
 await page.goto('/demo-games/sweet-bonanza?launchUrl=https%3A%2F%2Fexample.org');
 await expect(page.getByRole('link',{name:/Open authorised official demo/})).toHaveCount(0);
 await expect(page.locator('iframe')).toHaveCount(0);
 await assertNoEscape();
});

test('Game launch API denies unapproved, forged URL and invalid mode', async ({request}) => {
 for (const gameId of ['sweet-bonanza','gates-of-olympus','aviator']) {
  const response = await request.post('/api/game-launch',{data:{gameId,mode:'demo',launchUrl:'https://example.org/game',approved:true}});
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({status:'unavailable',reason:'approval_required'});
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['location']).toBeUndefined();
 }
 const bad = await request.post('/api/game-launch',{data:{gameId:'https://example.org',mode:'demo'}});
 expect(bad.status()).toBe(400);
 expect(bad.headers()['location']).toBeUndefined();
 const live = await request.post('/api/game-launch',{data:{gameId:'sweet-bonanza',mode:'real'}});
 expect(live.status()).toBe(400);
 expect(live.headers()['location']).toBeUndefined();
});

test('Homepage game-card previews never create external session', async ({page}) => {
 const assertNoEscape = monitorLaunchEscapes(page);
 await page.goto('/');
 await page.locator('.slot-card .slot-image').first().click();
 await expect(page.getByRole('dialog')).toContainText('visual game preview');
 await expect(page.locator('iframe')).toHaveCount(0);
 await assertNoEscape();
});

test('Unknown demo slug is not a provider redirect', async ({page}) => {
 const assertNoEscape = monitorLaunchEscapes(page);
 const response = await page.goto('/demo-games/https%3A%2F%2Fexample.org');
 expect(response.status()).toBe(404);
 await assertNoEscape();
});
