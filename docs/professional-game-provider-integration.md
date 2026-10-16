# Professional game-provider integration checklist

AwehBet uses third-party, professionally supplied games only. No custom slot engine or locally generated outcomes should be offered to players.

## Current implementation (not connected)

- `/slots` is a Design 5 catalogue of preview cards, **not** an authorised playable game library.
- `/game-launcher` requests demo availability from `POST /api/game-launch`.
- `apps/web/src/lib/provider-launcher.ts` contains a small provisional catalogue and deliberately returns `provider_not_configured`.
- No SOFTSWISS API credentials, game-session API endpoint, launch token, or signed callback implementation has been supplied. Do not invent any.
- Real-money game launch must remain disabled until all required commercial, regulatory, identity, player-safety, wallet and settlement controls are independently verified.

## Required from the aggregator

1. Signed commercial permission to distribute specific studios/titles in approved jurisdictions and environments.
2. Official sandbox API specification, base URLs, authentication/signing mechanism, IP allowlisting and credentials supplied through a secure secret manager.
3. Authoritative catalogue feed containing aggregator game IDs, provider IDs, demo eligibility, supported currencies, jurisdictions and launch parameters.
4. Official demo-session endpoint and documented request/response/error schemas; whether the game must open in an iframe, redirect, or SDK.
5. Session expiry, refresh/recovery, webhook signing, idempotency and incident handling documentation.
6. For any future money-play system: operator wallet integration and transactional guarantees, reconciliation, settlement, reporting, certified RNG/game content, and player eligibility enforcement.

## Engineering acceptance criteria

- Keep all credentials and provider API calls server-side; never embed credentials in the browser.
- Map game names to exact provider-issued IDs, not inferred slugs. Do not treat a catalogue preview as launchable.
- Validate launch inputs and authenticated player context server-side; never accept arbitrary client-supplied URLs or provider names.
- Validate provider-returned launch URLs against a reviewed HTTPS hostname allowlist, including redirects and iframe permissions, before exposing a URL to the client.
- Apply rate limiting, timeouts, structured redacted logs and provider-specific error mapping.
- Preserve fail-closed behaviour when configuration, rights, session, or verification is missing.
- Test success and failure paths in the vendor sandbox and complete `pnpm --filter @awehbet/web typecheck` and `pnpm --filter @awehbet/web build`.
- Test desktop/mobile launcher behaviour, browser CSP, game close/back navigation and expired sessions.

## Implementation order

1. Receive and review SOFTSWISS or another authorised aggregator's actual technical documentation.
2. Implement a provider-specific server adapter behind the existing `createDemoGameSession` contract, with fixture-based tests.
3. Import only the approved catalogue and display launch controls only for enabled games.
4. Enable sandbox demo sessions after credential validation and URL allowlist review.
5. Treat real-money support as a separate gated project, not an extension of demo launch by changing a feature flag.

No provider connection or game launch is represented as working by this document.
