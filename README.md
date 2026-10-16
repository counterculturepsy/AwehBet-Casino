# AwehBet – Design 5 player-account platform

Next.js 15 + React 19 with Supabase SSR authentication and PostgreSQL migrations. This branch extends the approved black/red/gold Design 5 frontend with registration, protected player accounts, encrypted identity references, a simulated wallet ledger, KYC states, responsible-gaming controls, and payment-provider-ready demo screens.

This is a development platform, not a live gambling service. Real-money payments, withdrawals, wagering, KYC uploads, and provider gaming are disabled. Current National Gambling Board guidance states that interactive gambling is prohibited in South Africa except licensed online betting; the platform must not be offered as an online casino without written regulatory and legal clearance.

## Run

```bash
corepack enable
pnpm install
copy .env.example .env.local
pnpm dev
```

Configure a dedicated Supabase development project, apply `supabase/migrations`, and set the variables documented in `.env.example`. Open http://localhost:3000. Check with `pnpm test`, `pnpm typecheck`, and `pnpm build`.

## Notes

See `docs/ACCOUNT_ARCHITECTURE.md`, `docs/COMPLIANCE_READINESS.md`, and `docs/DEPLOYMENT.md` before configuring any external service. Do not publish bonus, licensing, payment-method, or provider claims until independently verified.
