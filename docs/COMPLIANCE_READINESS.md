# South African compliance readiness

Last reviewed: 16 October 2026. This is an engineering readiness note, not legal advice.

## Hard launch blocker: product legality and licensing

The National Gambling Act coordinates national and provincial regulation and licensing. The National Gambling Board currently states that online or interactive gambling is prohibited in South Africa, except online betting offered by a South African provincially licensed bookmaker. It also states that licensed digital operators must display licensing information. A provincial licence or foreign licence must not be assumed to authorise an online casino product.

Sources:

- [National Gambling Act 7 of 2004](https://www.gov.za/documents/national-gambling-act-0)
- [National Gambling Board: Interactive Gambling Is Illegal in South Africa](https://www.ngb.org.za/media-releases/interactive-gambling-is-illegal-in-south-africa/)
- [National Gambling Board enforcement guidance](https://www.ngb.org.za/industry-regulation/enforcement/)
- [National Gambling Board FAQs](https://www.ngb.org.za/faqs/)

Engineering decision: `PAYMENTS_ENABLED` and `WITHDRAWALS_ENABLED` default to false, wallet transactions reject non-simulated entries, and the UI makes no licensing claim. Do not activate casino wagering, deposits, payouts, promotions, or game-provider production modes without written advice from qualified South African gambling counsel and the applicable national/provincial authorities.

## FICA and AML

The Financial Intelligence Centre identifies gambling institutions as accountable institutions. Its gambling-sector material describes registration with the FIC, risk-based customer identification and verification, a documented Risk Management and Compliance Programme, recordkeeping, regulatory reporting, staff training, and a compliance officer. The FIC Act prohibits relationships with anonymous or apparently fictitious clients and requires client identification and verification in accordance with the RMCP.

Sources:

- [FIC toolkit for the gambling sector](https://www.fic.gov.za/wp-content/uploads/2023/09/Toolkit-booklet-Gambling-sector-_A4.pdf)
- [Current FIC Act booklet](https://www.fic.gov.za/wp-content/uploads/2024/05/2024.3-GN-FIC-Act-booklet.pdf)
- [FIC goAML registration and reporting](https://gostage.fic.gov.za/goAMLWeb_UAT/Home)

Before launch: appoint accountable owners, complete registration, approve an RMCP, define risk tiers/source-of-funds and enhanced due-diligence rules, sanctions/PEP screening, suspicious/cash/international reporting, case management, staff access, record retention, and tested escalation procedures. Do not use the registration ID-format check as verification.

## POPIA and privacy

The Information Regulator states that responsible parties must comply with the lawful processing conditions, implement appropriate technical and organisational safeguards, identify foreseeable risks, verify and update controls, and report security compromises to the Regulator and affected data subjects as soon as reasonably possible. Direct marketing consent is separate and optional in this implementation.

Sources:

- [Information Regulator POPIA guidance and security-compromise requirements](https://inforegulator.org.za/popia/)
- [Information Regulator guidance on special personal information](https://inforegulator.org.za/wp-content/uploads/2020/07/InfoRegSA-GuidanceNote-Processing-SpecialPersonalInformation-20210628.pdf)

Before production: document lawful purpose and minimum fields, publish privacy and retention notices, register/appoint the Information Officer as required, complete operator agreements and cross-border assessments, implement access/correction/deletion workflows, formalise key rotation and breach response, and confirm retention with gambling/FIC counsel. No identity documents or selfies should be collected until these controls and an approved KYC provider exist.

## Responsible gambling

The South African Responsible Gambling Foundation describes formal self-exclusion as a legislated process supported by operators and provincial gambling boards, with a minimum six-month exclusion period and counselling requirements for upliftment. Its current support line is 0800 006 008 and WhatsApp is 076 675 0710.

Sources:

- [SARGF self-exclusion guidance](https://responsiblegambling.org.za/self-exclusion-2/)
- [SARGF counselling and support](https://responsiblegambling.org.za/counselling/)

The development UI implements immediate cooling-off and six-month-or-longer self-exclusion records, but this does not replace the statutory operator/board process. Production needs cross-channel enforcement, staff procedures, marketing suppression, game/payment blocks, exclusion-register integration where required, and verified support content.

## Payment-provider investigation

Banks listed in the interface are user choices, not claimed direct merchant APIs. A regulated payment service provider must be selected and must explicitly approve the merchant, gambling use case, product, transaction flows, payouts, and settlement model.

Candidate technical paths, all commercially and legally unapproved:

- [Ozow integration hub](https://hub.ozow.com/) documents merchant onboarding, ZAR payment requests, idempotency, authenticated callbacks, refunds, and separately approved/tested payouts. Its documentation warns that the browser return is not proof of payment.
- [Peach Payments developer hub](https://developer.peachpayments.com/) documents hosted/embedded checkout, sandbox credentials, payment methods and payouts. [Webhook guidance](https://developer.peachpayments.com/docs/checkout-webhooks) requires HMAC-SHA256 verification and defines pending, successful, and uncertain states.
- [PayFast ITN guidance](https://developers.payfast.co.za/docs/itn-instant-transaction-notification/) documents signature/domain/status/amount validation. Merchant eligibility and gambling support still require written confirmation.

Required commercial evidence before any adapter is written: executed merchant agreement, explicit approval for the licensed gambling product, acquiring-bank/card-scheme approval, enabled methods and limits, chargeback/refund rules, payout approval, sandbox and production credentials, settlement account, PCI scope, webhook secrets/IP guidance, support escalation, reconciliation reports, and go-live sign-off.
