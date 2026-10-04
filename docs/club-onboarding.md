# Self-service club onboarding

Clubs register at `/opret-klub`, choose Standard or Custom and selected modules,
create credentials, and pay the monthly subscription through Stripe Checkout.
The club remains private until a superadmin approves its verified payment.
Approval does not send email. Club admins can log in using the mobile Klublogin
button and use the existing authenticated administration portal.

## Owner setup

In `/superadmin/opsaetning`, save the monthly subscription and Custom setup price with
“Gem priser og klargør Stripe”. This also configures the required Stripe webhook
events. Stripe credentials must already be configured. Owner-confirmed pricing:
new European clubs pay EUR 27/month, with EUR 1,999 once for Custom; US and Canadian clubs pay USD 30/month, with USD 2,249 once for Custom. First Custom checkout is EUR 2,026 or USD 2,279 before applicable tax. Later invoices contain the monthly subscription only. Existing agreements retain their stored price rather than being
silently repriced. Previously paid setup is not charged again upon restarting.
Pricing uses the V2 settings key to avoid interpreting legacy monthly Custom
prices as setup fees. Approval also verifies initial setup payment.

## Payment and permissions

- Account, sport-specific courts and chosen modules are created atomically.
- Repeated checkout attempts reuse the open checkout and customer.
- Approval checks Stripe's canonical subscription, customer, currency, amount and
  paid invoice. A success URL alone cannot activate a club.
- Failed payment suspends publication; verified recovery restores an already
  approved club. Rejected clubs cannot be republished by payment notifications.
- Rejection cancels the subscription. Any already collected payment must be
  reviewed/refunded in Stripe; refunds are not automated by this action.
- Custom module checks apply in navigation and server actions. Legacy Custom
  clubs with no module selection retain their existing full access.
- Hardware pairing/testing and player-payment payout setup remain separate.

## Verification and acceptance

- Isolated database-backed onboarding tests cover all 19 markets and payment failure/recovery, including preventing tax from substituting for the Custom setup fee.
- Server regression tests cover invoice access control, signed live webhook evidence, fixed checkout currency and market-specific terms.
- Production Next build and isolated database/HTTP tests must pass before release.
- Stripe calls in tests are simulated. No real charge, email, door or light command is sent. Live payment acceptance remains required.
- `/superadmin/salg` reports provider configuration separately from live evidence and outstanding owner information.
- Club administrators can open paid invoices directly and update their card through the billing portal even while payment is overdue.
- Each club must supply its actual entity, identity and bank details in Stripe Connect. Business type is not assumed to be nonprofit.
- Tax registrations must match the business's actual registrations; never invent registrations to make a status check green.
- Web export does not publish signed iOS/Android builds. Store configuration and native releases remain separate.
