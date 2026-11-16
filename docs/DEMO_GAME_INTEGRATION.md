# AwehBet demo-game integration gate

The /demo-games catalogue is a development preview, not a representation of commercial distribution rights or connected provider sessions. All seeded entries are unavailable by default.

## External official demos
1. Obtain written approval or documented terms permitting AwehBet to link to the exact demo.
2. Confirm legal and jurisdictional restrictions with qualified counsel.
3. Review the HTTPS destination, redirects, and ownership.
4. Add the exact reviewed hostname to the server-side allowlist in demo-catalogue.ts.
5. Set permission=approved, launchMethod=external and approvedUrl for the specific game.
6. Test desktop/mobile behaviour and re-check periodically.

## Outbound links to provider-hosted demo pages (Slots Masters lobby)
Added 2026-11-16 by owner decision. The /slots game dialog shows a "Play free demo on <provider>" link for titles whose provider publishes a free-play demo on its own public website. Scope and limits:
- It is a plain new-tab hyperlink (`rel="noopener noreferrer"`) to the provider's own game page. Nothing is embedded, proxied, or launched through AwehBet, and no provider game id or launch URL is constructed.
- Links live in `apps/web/src/lib/official-demo-links.ts`. Each title is tied to its provider and can only resolve to that provider's fixed hostname over HTTPS.
- 38 of the 45 lobby titles are linked; each page was loaded on the provider's site on 2026-11-16. Not linked (no provider-hosted page found): Majestic King, Dork Unit, Hand of Anubis, Mega Moolah, Immortal Romance, Thunderstruck II, Book of Atem.
- This is NOT the "External official demos" process above: no written approval or provider terms review has been recorded for these links, and legal review (step 2) is still outstanding. The approval gate (`game-approval.ts`, `approvedExternalDemoUrl`, `/api/game-launch`) is unchanged and still denies every embedded or API launch.
- Re-check the links periodically; provider sites change paths and may geo-restrict demos.

## Embedded demos
Do not iframe, proxy, copy, or reverse-engineer provider games without express permission. An authorised embed must use an approved origin, CSP/frame policy, sandbox attributes and a documented provider session lifecycle. Embedded launches are not enabled by this change.

## Sandbox adapters
Integrate only against official provider documentation, approved credentials and game identifiers. Keep secrets server-side, validate signed responses, allowlist destinations, handle expiry, and test against provider sandbox. Sandbox launches are not enabled by this change.

## Separation of funds
Provider-operated virtual demo balances are not AwehBet wallet balances. Never imply simulated credits are withdrawable or redeemable.

## Release checklist
- Permission and legal review documented
- Official endpoint and asset rights verified
- Integration tests and responsive QA pass
- Security review and audit trail completed
- Feature flag and rollback available
- No live-money operations enabled
