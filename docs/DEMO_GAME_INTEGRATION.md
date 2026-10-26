# AwehBet demo-game integration gate

The /demo-games catalogue is a development preview, not a representation of commercial distribution rights or connected provider sessions. All seeded entries are unavailable by default.

## External official demos
1. Obtain written approval or documented terms permitting AwehBet to link to the exact demo.
2. Confirm legal and jurisdictional restrictions with qualified counsel.
3. Review the HTTPS destination, redirects, and ownership.
4. Add the exact reviewed hostname to the server-side allowlist in demo-catalogue.ts.
5. Set permission=approved, launchMethod=external and approvedUrl for the specific game.
6. Test desktop/mobile behaviour and re-check periodically.

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
