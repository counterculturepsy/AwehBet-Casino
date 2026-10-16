# AwehBet payment integration — production readiness

Status: **planning / sandbox only**. No real-money deposit or payout capability is authorised or enabled by this document.

## Existing implementation (design5-master)
- `apps/web/src/lib/payments/provider.ts`: typed adapter interface; deliberately returns null.
- `apps/web/src/app/api/account/deposit-intents/route.ts`: authenticated, rate-limited simulated deposit intents.
- `apps/web/src/app/api/webhooks/payments/[provider]/route.ts`: rejects unconfigured webhooks.
- `apps/web/src/app/api/account/withdrawals/route.ts`: simulated withdrawals.
- `apps/web/src/lib/env.ts`: `PAYMENTS_ENABLED` and `WITHDRAWALS_ENABLED` flags; neither enables a real adapter.
- Preserve Design 5 and all existing demo account flows.

## Provider onboarding gate
1. Confirm intended products and customer jurisdictions with independent legal counsel and the prospective acquirer/PSP. Obtain written merchant acceptance for the *actual* business category; do not disguise gambling as retail.
2. Request sandbox credentials, full API/webhook signature specification, settlement timing, reversals/refunds, payout eligibility, dispute handling and fee schedule. Do not put secrets in GitHub or client-side environment variables.
3. Obtain confirmation of operator authorisation and relevant game-provider contracts before accepting real-money gambling deposits.

## Implementation sequence (after approved sandbox)
1. Implement an isolated, server-only provider adapter for one approved provider; separate sandbox and production configuration. Keep live flags off by default.
2. Create an authenticated deposit intent server-side; validate allowed amount, ZAR currency, verified account/eligibility and a unique idempotency key. Persist a unique merchant reference **before** requesting hosted checkout.
3. Use hosted payment pages/tokenisation; never accept card PAN/CVV or bank passwords in AwehBet.
4. Verify webhook signatures against the exact raw request body; enforce timestamp/replay protection and durable event deduplication. Never credit from a browser redirect or screenshot.
5. Match provider reference, merchant reference, amount, currency and intent state; verify uncertain events against the provider API.
6. Credit a wallet **once** through a database transaction with unique constraints and an immutable double-entry ledger. Handle late failures, refunds, chargebacks and reversals without rewriting history.
7. Reconcile provider settlement reports and bank settlements daily. Surface unmatched events for authorised manual review; never silently mark pending deposits successful.
8. Withdrawals: KYC/age verification, beneficiary ownership checks, available-balance hold, risk limits, approval workflow, provider payout and final reconciliation. Segregate maker/checker roles.
9. Tests: invalid signature, replay, duplicate/out-of-order webhook, mismatched amount/currency, concurrent callbacks, provider timeout, refund/chargeback, account takeover and denied payout. Audit and load-test before live activation.

## Merchant enquiries
- Ozow merchant onboarding: https://ozow.com/become-a-merchant ; developer documentation: https://hub.ozow.com/
- Peach Payments: https://www.peachpayments.com/legal/ (review current merchant agreement and eligibility).
- Request written confirmation of gambling merchant acceptance, supported SA methods, sandbox availability and payout support before choosing an adapter.

## Release gate
No live deployment until legal/merchant approvals, signed commercial agreements, penetration testing, database reconciliation tests, operational monitoring and rollback procedures are complete. Keep `PAYMENTS_ENABLED=false` and `WITHDRAWALS_ENABLED=false` meanwhile.
