# Club lighting and door validation

Validated actual `club-control.ts` and `setManualLight` against a fresh temporary PostgreSQL-compatible PGlite database and simulated Shelly devices. Four court lights, one common light and one door are mapped across two devices. All external fetches are blocked. No production database, booking, email or controller is used.

Run `npm run test:control` after `npm install` and `npx prisma generate`.

## Results: 16/16 integration scenarios passed

1. Lights remain off before the configured lead time.
2. The booked court and common light turn on; other courts and door remain untouched.
3. Repeated reconciliation does not resend unchanged states.
4. Lights remain on through the end boundary and turn off afterward.
5. HOLD and CANCELLED bookings do not activate lights.
6. Administration manual-on activates the light and expires automatically.
7. Administration Auto immediately restores booking-based control.
8. Manual light action rejects door channels and an unowned/unknown channel ID.
9. Door service rejects another user and access before/after the window.
10. At the opening boundary, only the mapped door receives a five-second pulse command.
11. Database cooldown rejects a second tap without issuing another command.
12. Access is accepted at the exact end boundary.
13. A failed door command returns HTTP-equivalent 502 and stores a failed audit event.
14. Offline controllers produce recorded errors rather than success.
15. Failed lighting commands are recorded and a later reconciliation recovers.
16. A paused system sends neither automatic lighting nor door commands.

## Mobile component checks: 3/3 new tests passed

Actual ProfileScreen rendered with synthetic booking/API dependencies:

- Double tap sends one request; loading/disabled state appears and clears. Success copy says the command was sent, and asks the user to check physical opening.
- Controller error appears and retry is enabled afterward.
- Door button is absent before/after the access window and for HOLD/CANCELLED bookings.

Full existing suites also pass: 179 server tests and 21 mobile tests (including these 3).

## Scope

These tests exercise the software, SQL writes and component behavior, not physical current, wiring, a live Shelly Cloud account, real relay auto-off, lock movement or installed iOS/Android builds. The simulated provider verifies the requested pulse duration; only an on-site test can establish that the physical relay and lock actually follow it. PGlite does not establish multi-session PostgreSQL concurrency. Existing provider HTTP-contract and setup-policy tests run in the server suite.

No application behavior needed changing for these scenarios. This change adds reproducible tests and documentation only.
