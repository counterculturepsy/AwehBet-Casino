# AwehBet demo provider gateway

## Scope
This branch is based on `feature/provider-game-integration`, preserving Design 5 homepage, existing `/slots`, registration, dashboard and deposit previews. It adds only `/demo`, `/api/demo/games`, `/api/demo/launch` and one server-side adapter.

No third-party production API credentials have been supplied. This is an integration-ready internal contract, **not** a fabricated implementation of Hub88, SOFTSWISS or BGaming proprietary APIs.

## Configuration (server-side environment only)

```env
DEMO_GATEWAY_URL=https://your-approved-private-gateway.example/api/demo
DEMO_GATEWAY_API_KEY=provided-by-your-gateway
DEMO_GAME_HOSTS=games.authorized-provider.example,launch.authorized-provider.example
```

Never commit real keys. DEMO_GATEWAY_URL must use HTTPS; DEMO_GAME_HOSTS is a comma-separated exact hostname allowlist for approved game launch destinations. Do not use `NEXT_PUBLIC_` variables for credentials.

## Gateway contract

- `GET {DEMO_GATEWAY_URL}/games` returns `{"games":[{"id":"studio:game-id","title":"Approved Demo","studio":"Studio","category":"Slots","thumbnailUrl":"https://..."}]}`
- `POST {DEMO_GATEWAY_URL}/launch` with JSON `{"gameId":"studio:game-id","mode":"demo"}` returns `{"url":"https://approved-launch-host.example/session/..."}`
- Header: `Authorization: Bearer <DEMO_GATEWAY_API_KEY>`.
- Gateway is responsible for mapping the **actual provider protocol**, validating provider rights and demo-only sessions, signing upstream requests and enforcing IP/account/territory access as required.
- Never return signed upstream credentials, player secrets or payment details to the browser.

The gateway contract deliberately uses a neutral internal API; individual vendor protocols must be implemented only after approved technical docs are received.

## Expected behaviour
Without gateway settings, `GET /api/demo/games` returns `{status:"pending", games:[]}`; `POST /api/demo/launch` returns HTTP 503. The existing site continues to run.

## Validation checklist
```bash
pnpm install
pnpm --filter @awehbet/web typecheck
pnpm --filter @awehbet/web build
```
After gateway onboarding, verify demo catalogue mapping, launch permissions, exact host allowlist, popup behaviour, timeout recovery, mobile UI and unsupported-game errors. Add request throttling and authenticated session validation before exposing any sensitive integration or broader commercial mode. Real-money gameplay is intentionally not implemented.
