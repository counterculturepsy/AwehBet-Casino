# AwehBet – approved design #5 frontend

Next.js 15 + React 19. This package recreates the approved black/red/gold mockup using the supplied official AwehBet logo and artwork extracted from the approved mockup. It is a frontend concept, not a live gambling service. Provider game images and promotional terms require licensing and verification before launch.

## Run

```bash
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:3000. Check with `pnpm typecheck` and `pnpm build`.

Run the server-side slot-foundation regression tests with `pnpm test`.

## Notes

Login/register and games are visual previews only. No backend, real-money gambling, payments, player identity verification, or game-provider API is connected. Do not publish bonus claims or licensing claims until independently verified.

The first custom-slot engineering milestone is documented in [the gap analysis](docs/real-money-slot-gap-analysis.md) and [architecture and delivery gates](docs/real-money-slot-architecture.md). Its code is a simulated-credit contract prototype only: it has no public game route, durable wallet, certified mathematics, approved RNG, RGS connection, or real-money mode.
