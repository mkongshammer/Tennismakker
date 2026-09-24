# Club management extension — September 2026

## Club packages
Club.solutionMode defaults to STANDARD. Superadmin selects STANDARD/CUSTOM at club creation or from club approvals, including private pending clubs. Standard menu: overview, bookings, released times, courts, payment, integration, administrators/contact. Custom adds memberships, seasonal teams, news, wallet/pricing, lights/access and website. Existing clubs are not guessed to be custom; the owner explicitly assigns the package. Custom management server actions validate the current administrator and club.

## Members
Custom administrators add name, email and phone. New users get a random one-time displayed password; no email is sent. Existing accounts retain name, phone and credentials, and cannot be moved from another club or elevated role. Optional membership assignment is PENDING, never falsely marked paid. Imported users choose a password through the normal password reset flow. Users currently have one primary club (existing data model).

## Fixed bookings
Select multiple courts and weekdays, a starting hour and date range up to one year ahead (max 1,500 occurrences/request). Each occurrence is one hour, uses Danish local time across daylight saving, and is assigned to the selected club member. Existing bookings/imported busy periods are skipped and reported. This is allocation; it does not charge the member's card. Court rows are locked during reservation creation, including normal web/mobile bookings and rebooking, to coordinate with allocation/import. A large multi-court batch is processed per court/day; conflicts are skipped, not overwritten.

## Wallet
Club-only prepaid booking credit, integer øre, paid through Stripe card Checkout (Apple Pay/Google Pay availability depends on Stripe/device). Up to three bonus thresholds; the best qualifying multiplier applies to the full deposit. Example: 180,000 øre buys 200,000 øre credit. Deposits 10–10,000 DKK. No mock-money funding. The connected club is paid at deposit; the configured platform fee is collected there (zero for an active subscription club), never a second time on spend.

Only confirmed, amount/currency/destination-verified payment credits the ledger. Replayed callbacks are idempotent. Debit, ledger entry and booking confirmation are one DB transaction. Credit is automatically used for an eligible member's booking when it covers the entire price; otherwise the existing card checkout opens. Prepared card checkouts cannot be paid a second time from wallet. Timely cancellations (at least 24 hours) return credit once; late cancellations do not. This returns booking credit, not a card refund. Stripe refund/dispute events freeze the affected wallet for manual reconciliation; spending a disputed deposit is not silently allowed. Wallet payment rows represent booking consumption, not another card charge. Bonus face value is not cash receipts; full accounting exports/bonus VAT treatment are not implemented by this change.

Funding defaults off. Enabling requires the Stripe webhook configuration check to pass, including checkout.session.expired, checkout.session.async_payment_succeeded, charge.refunded and charge.dispute.created. No live payment, refund or webhook mutation was performed during development. Pending/under-review deposits and positive/frozen balances block account erasure until settled. Unresolved provider/API failures and disputed balances require operator reconciliation. There is no peer-to-peer transfer or cash withdrawal feature.

## Mobile and lights
A club administrator gets a Min klub tab. Native apps embed the same responsive administration through react-native-webview, using a random one-use, 60-second session handoff. No password or long-lived API token is put in a URL. Same authenticated flow exposes wallet from profile. Requires a new native build to distribute; Expo web/Render deployments do not update installed native apps.

Manual light control is limited to confirmed light channels in the current club: 15, 30, 60 or 120 minutes, then existing booking-based automation resumes. Returning to Auto does not turn off an active booking. Door channels are excluded. Commands are logged. Physical delivery, power/network failure behavior and controller wiring still require on-site validation. No live hardware commands were issued during development.

## Migration
Custom admin → Bookingsystem: paste CSV, preview and separately confirm. Fields: type,email,name,phone,court,start,end,external_id. Supports comma/semicolon and quoted fields. Explicit timestamp offsets required. Up to 500 rows; atomic import; club-scoped identity checks; repeat external IDs are preserved, not recreated; booking conflicts abort the import. Members must exist or appear in the same file. Bookings are imported as allocated/externally settled reservations with zero new charge, not as proof of old payment. Existing balances, old payment records, membership receipts and cancellation history are not imported.

A separate Resasports connector now prepares this import directly from documented Nubapp v4 read endpoints, with preview and explicit court mapping. Vendor credentials and live-club acceptance are still required; see [Resasports integration](resasports-integration.md). Existing iCalendar integration remains the option for supported ongoing availability feeds. For cutover, freeze changes in the old system, import and compare, then select RacketBuddy as the booking system; do not run two independent systems accepting the same slots.

## Verification scope
Offline regression tests: access boundaries, wallet amount math, concurrent debit/rollback, webhook replay and invalid payment evidence, cancellation credit, CSV parsing, DST, single-use mobile handoff, light authorization. Production Next build and Expo native/web export. These are not a substitute for real device, Stripe test-mode end-to-end or physical-controller validation.
