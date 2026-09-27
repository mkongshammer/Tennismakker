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
all new clubs pay 199 DKK/month; Custom additionally costs 14,995 DKK once,
regardless of module count. First Custom checkout totals 15,194 DKK. Later invoices
are 199 DKK/month. Existing agreements retain their stored price rather than being
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

## Verification (27 September 2026)

- 16 isolated database-backed onboarding scenarios passed (`test:onboarding`).
- 179 server tests and 22 mobile tests passed.
- Production Next build and Expo web export passed.
- Stripe calls in onboarding tests are simulated. No real charge, email, door
  command or light command was sent. Live payment acceptance remains required.
- Web export does not publish a signed iOS/Android build to the stores. The native
  code changes must be included in the next signed app release.
