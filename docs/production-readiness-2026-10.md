# Production readiness — second pass, 2026-10-19

Branch `racketbuddy/product-transformation`, PR #18. This is the evidence
record for the self-critical second pass. Everything marked **verified** was
run in this environment against a production build served over a
PGlite-backed PostgreSQL with seeded US data and Stripe in mock mode.
Everything marked **not verified** needs production or a credential this
environment does not have.

## 1. Critical findings in the first implementation (and what was done)

| # | Finding | Severity | Correction |
|---|---|---|---|
| 1 | A club cancelling a paid booking inside 24 h kept the customer's money (`adminCancelBooking` reused the player's 24-hour rule). | Financial / trust | One pure policy module: PLAYER keeps the 24-hour window; CLUB / COACH / SYSTEM always refund in full, for card, wallet, package and punch credits. Confirmed by a PGlite check with a mocked Stripe. |
| 2 | Stripe refunds had no idempotency key; nobody recorded who cancelled or why; the cancellation e-mail was sent as DKK / Danish / Copenhagen time to US customers. | Financial / audit | `booking-refund-v1-<id>` key; `cancelledAt/By/ByUserId/Reason` on every cancellation path; e-mail gets currency, locale, zone, actor and reason. |
| 3 | Cancelling was one click for both players and clubs, with no statement of the money consequence. | UX / financial | Confirmation dialogs that state the refund (or its absence) before committing. |
| 4 | "Massachusetts" searched a 50-mile radius around the state centroid, missing most of the state. | Correctness | A state is an area (ZIP bounding box + per-club state verification); radius hidden for state searches. |
| 5 | Discovery loaded every approved club and read every club's live calendar (≈3 queries each, unbounded parallelism) on every search. | Scalability | Geographic prefilter in SQL, selected columns, indexes, pagination (24), availability only for the page with concurrency 6 and 2.5 s timeout, 30 s card-only cache. Measured at 1,000 clubs: one club query, ≤24 calendar reads. |
| 6 | Ambiguous cities resolved silently; clubs without coordinates vanished from city searches; a slow geocoder left new clubs without coordinates. | Correctness | Alternatives shown for real namesakes; same-city fallback; ZIP-centroid fallback in `geocode()`. |
| 7 | The waitlist promised an e-mail nothing could send, with no confirmation, rate limit, unsubscribe or retention. | Trust / privacy / abuse | Double opt-in, signed links, limits, honeypot, real notifications on club approval / coach creation, unsubscribe deletes, retention, superadmin demand view, privacy policy updated. |
| 8 | Public URLs were Danish (`/book`, `/klub/…`, `/traenere`, `/profil`). | Product coherence | English routes with permanent 308 redirects from every legacy path (including auth and checkout return paths). |
| 9 | The admin schedule placed bookings by start hour only: half-hour starts, 90-minute lessons, bookings outside opening hours and overnight bookings rendered wrongly or not at all. | Correctness | Pure `schedule-grid.ts` layout with unit tests for each case, including both DST transitions. |
| 10 | The product hero duplicated the sport chips; the court grid was a wall of identical blue buttons; the phone discovery page put every control above the first result; player tabs covered the admin on phones. | Design | Fixed in the second design pass (see QA). |

## 2. Verified in this environment

- `npx tsc --noEmit` — 0 errors.
- `npm test` — 266 pass (unit + localization), including new suites: cancellation policy, schedule grid, market-interest rules, place resolver, hosts.
- `npm run test:database` — 17/17 (two new: club refund with idempotency key + audit; late player cancellation keeps payment).
- `npm run test:onboarding` — 24/24.
- `npm run test:discovery` (new) — 9/9: state/city/ZIP/ambiguity/name/nonexistent-place correctness; waitlist end to end; scale at 10/100/500/1,000 clubs.
- `cd mobile && npm test` — 27/27. `expo export --platform ios` — see QA.
- `next build` — ok. First Load JS: `/` 118 kB, `/courts` 202 kB, `/clubs/[slug]` 197 kB, `/admin` 233 kB.
- Expanded journey validation (33/33, `validate.mjs`, local only): new player via API and via UI; duplicate and non-US signups refused; tampered bearer token 401; **8 concurrent reservations for one slot → 1×201, 7×409**; another club's admin cannot see the booking; club admin cannot open superadmin; player cannot open admin; corrupted session cookie → signed out; keyboard-only reservation → checkout → mock payment → confirmation → `.ics`; cancel dialog states the refund; cancelled booking disappears; SQL-looking and 5,000-character queries harmless; market-interest rejects non-string JSON and malformed bodies and rate-limits one address; image route refuses traversal and unknown variants; new coach reaches the coach dashboard.
- Accessibility: axe-core WCAG 2.2 AA + best-practice, 12 screens × phone/desktop, **0 violations** after fixing three (avatar accessible name, tablist semantics, contrast in schedule cells).
- Latency (local production build, warm, p50/p90 over 8 runs): `/api/v1/clubs?q=Boston` 25/34 ms; state search 19/21 ms; `/courts?q=Boston` 48/90 ms; `/clubs/[slug]` 111/120 ms; `/` 43/49 ms.
- Schema change review: additive only — 4 nullable columns on `Booking`, new `MarketInterest` table, 2 indexes on `Club`, 3 on `MarketInterest`. Applied by the existing `prisma db push` build step on each regional deployment; no column is dropped or retyped, so rollback is deploying the previous commit (unused columns are harmless).

## 3. Not verified (and why)

- Live Stripe: checkout, webhooks, Connect payouts and **refunds with `reverse_transfer`** on a real destination charge. Mock provider here. The code path is exercised with a mocked Stripe client in `test:database`.
- Shelly lighting / door hardware — no devices.
- TestFlight / Play builds — no EAS credentials.
- Real Core Web Vitals — the public origin is still the onrender host behind a gateway; field data must be collected after the cutover.
- True multi-connection PostgreSQL concurrency: the local database is PGlite behind a single connection, so the 8-way race proves the application and the row locks, not Postgres under parallel sessions. The reservation uses `SELECT … FOR UPDATE` on the court and club rows, which is the correct primitive.
- The production value of the `clubSignupPricesV3` platform setting (see blockers).
- Render service configuration — the workspace connected to this session belongs to another project, so the cutover plan was built from the repository and live endpoint behaviour.

## 4. What could prevent a safe launch (owner decisions)

1. **Custom price default.** The code's fallback price book says USD **2,249** for Custom (so do `docs/international.md` and `docs/club-onboarding.md`, from before this PR); the brief says **2,250**. The live price comes from the `clubSignupPricesV3` setting, which the superadmin can edit and which I could not read. Decide which number is right; if 2,250, change `DEFAULT_PRICE_BOOK` in `src/lib/platform-pricing.ts`, the two docs and the two tests that pin 2249 — a two-line change I have left untouched because it is a price.
2. **Domain cutover** (`docs/domain-cutover.md`): DNS and Render custom-domain changes, a second Stripe webhook endpoint, OAuth origins. Code is ready and inert.
3. **Refund policy sign-off.** Club-initiated cancellations now always refund in full and reverse the club's payout and our fee. This is the customer-fair default and the one the brief asked me to verify; it is also a commercial rule clubs will notice.

## 5. Acceptance criteria used

| Area | Criterion | Status |
|---|---|---|
| Discovery scale | One club query per search; availability reads ≤ page size (or ≤ 48 for "today"); p90 < 150 ms locally at 1,000 clubs | met |
| Geography | Whole-state coverage; cross-border radius; ambiguity surfaced; no silent drops of clubs without coordinates | met (tests) |
| Payments safety | Exactly one winner per slot under concurrency; refunds idempotent; who/why recorded | met (local) · live Stripe not verified |
| Waitlist | No promise without a sender; confirm before count; one notification; unsubscribe deletes | met |
| Accessibility | 0 axe violations (WCAG 2.2 AA) on key screens | met |
| Mobile layout | No horizontal scroll at 390 px; first result above the fold on `/courts` | met |
| Bundle | First Load JS ≤ 210 kB on public pages | met (≤ 202 kB) |
