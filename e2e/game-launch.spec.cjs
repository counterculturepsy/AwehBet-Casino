const { test, expect } = require('@playwright/test');

const providers = /pragmaticplay|hacksawgaming|playngo|gamesglobal|gamingrealms|evolution|spribe/i;
async function captureUnsafeNavigation(page) {
 const events = [];
 page.on('popup', popup => events.push('popup:' + popup.url()));
 page.on('framenavigated', frame => {
  if (frame !== page.mainFrame() && /^https?:/.test(frame.url())) events.push('frame:' + frame.url());
 });
 page.on('request', request => {
  if (providers.test(request.url())) events.push('provider:' + request.url());
 });
 return events;
}

test('Slots Masters card -> preview -> launcher -> fail-closed denial', async ({page}) => {
 const events = await captureUnsafeNavigation(page);
 await page.goto('/slots');
 await page.getByRole('button', {name:'View Sweet Bonanza',exact:true}).click();
 const dialog = page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('Awaiting authorised provider integration');
 await dialog.getByRole('link',{name:'Open game launcher'}).click();
 await expect(page).toHaveURL(/\/game-launcher\?game=Sweet%20Bonanza/);
 await page.getByRole('button',{name:'Check demo availability'}).click();
 await expect(page.getByRole('status')).toContainText('A playable provider session has not been enabled');
 expect(events).toEqual([]);
});

test('Launcher deep link and unknown game never open provider', async ({page}) => {
 const events = await captureUnsafeNavigation(page);
 await page.goto('/game-launcher?game=Sweet%20Bonanza');
 await page.getByRole('button',{name:'Check demo availability'}).click();
 await expect(page.getByRole('status')).toContainText('not been enabled');
 await page.goto('/game-launcher?game=https%3A%2F%2Fexample.org');
 await expect(page.getByText('Choose a supported game')).toBeVisible();
 await expect(page.getByRole('button',{name:'Check demo availability'})).toHaveCount(0);
 expect(events).toEqual([]);
});

test('Demo catalogue card and direct game URL expose no provider link or iframe', async ({page}) => {
 const events = await captureUnsafeNavigation(page);
 await page.goto('/demo-games');
 await page.getByRole('link',{name:'View game →'}).first().click();
 await expect(page).toHaveURL(/\/demo-games\/[^/]+$/);
 await expect(page.getByRole('status')).toContainText('Awaiting provider permission');
 await expect(page.locator('iframe')).toHaveCount(0);
 await expect(page.getByRole('link',{name:/Open authorised official demo/})).toHaveCount(0);
 await page.goto('/demo-games/sweet-bonanza?launchUrl=https%3A%2F%2Fexample.org');
 await expect(page.getByRole('link',{name:/Open authorised official demo/})).toHaveCount(0);
 await expect(page.locator('iframe')).toHaveCount(0);
 expect(events).toEqual([]);
});

test('Game launch API denies unapproved, forged URL and invalid mode', async ({request}) => {
 for (const gameId of ['sweet-bonanza','gates-of-olympus','aviator']) {
  const response = await request.post('/api/game-launch',{data:{gameId,mode:'demo',launchUrl:'https://example.org/game',approved:true}});
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({status:'unavailable',reason:'approval_required'});
  expect(response.headers()['cache-control']).toBe('no-store');
 }
 const bad = await request.post('/api/game-launch',{data:{gameId:'https://example.org',mode:'demo'}});
 expect(bad.status()).toBe(400);
 const live = await request.post('/api/game-launch',{data:{gameId:'sweet-bonanza',mode:'real'}});
 expect(live.status()).toBe(400);
});

test('Homepage game-card previews never create external session', async ({page}) => {
 const events = await captureUnsafeNavigation(page);
 await page.goto('/');
 await page.locator('.slot-card .slot-image').first().click();
 await expect(page.getByRole('dialog')).toContainText('visual game preview');
 await expect(page.locator('iframe')).toHaveCount(0);
 expect(events).toEqual([]);
});

test('Unknown demo slug is not a provider redirect', async ({page}) => {
 const events = await captureUnsafeNavigation(page);
 const response = await page.goto('/demo-games/https%3A%2F%2Fexample.org');
 expect(response.status()).toBe(404);
 expect(events).toEqual([]);
});
