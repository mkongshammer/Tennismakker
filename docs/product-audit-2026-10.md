# RacketBuddy product audit — October 2026

Scope: the live US product (racketbuddy.app → racketbuddy-us.onrender.com), the Next.js web app, the API, the Expo app, and the engineering workflow. Everything below was verified against the repository at commit `85f7bb9` and the live endpoints on 2026-10-19.

## Where the product stands

| Area | State | Evidence |
|---|---|---|
| Marketplace supply | **Zero** approved US clubs, zero US coaches | `GET /api/v1/clubs` returns `{"clubs":[]}`; `/courts` renders "0 clubs in the United States" |
| Public domain | Guests are 302-redirected from racketbuddy.app to **racketbuddy-us.onrender.com** | `middleware.ts` regional redirect; CI smoke test asserts the onrender URL |
| Language | US-only product built on a **Danish source language**: Danish route names (`/klub`, `/coaches`, `/players`, `/messages`, `/list-your-club`, `/terms`), Danish string keys translated at render time, Danish comments and error messages | `src/app/*`, `shared/phrases.json`, `phrase()` |
| Client payload | **371–413 kB First Load JS on every page.** An 839 kB (uncompressed) chunk carries all eight language dictionaries to the browser | `next build` output; `.next/static/chunks/4692-*.js` |
| Tests | 232 unit tests pass; `tsc` clean; `npm run test:database` and `npm run test:onboarding` **failed at HEAD** (unmocked modules and assertions left behind by the US-only change); 4 of 28 mobile tests failed for the same reason | run locally with PGlite |
| Design | Solid foundation (hard-court palette, Bricolage/Inter Tight/Martian Mono, court-tile signature). Executed inconsistently: dense inline Tailwind, minified JSX, no shared primitives beyond `.btn/.card/.input` | `globals.css`, `tailwind.config.ts`, component files |
| Discovery | Alphabetical list of clubs for one sport; free-text filter on name/city; map on desktop. No ZIP/state search, no distance, no availability or price filters, no favorites | `src/app/book/page.tsx`, `ClubExplorer.tsx` |
| Empty state | "No US clubs match your search" + a Danish-market explainer ("clubs keep their own booking system") that contradicts the US positioning | `/courts` live |
| Booking | Court grid is strong (per-court tiles, member/guest pricing, 10-minute hold, hold expiry, SQL overlap guard). Weak around it: no sticky summary, no "what happens next", checkout copy is Danish-sourced | `BookingGrid.tsx`, `checkout/[id]` |
| Coaches | Profiles exist with sport, price, specialties, weekly availability, packages. Listing is a two-column card list with a free-text "Region" input; no photos by default | `traenere/page.tsx` |
| Club admin | 13 sections already cover bookings, released times, members, teams, news, courts, lighting/access, pricing, billing, integrations, website, admins. The **overview is four stat tiles** (courts, guest bookings, revenue, paid out) and nothing operational: no today view, no utilization, no tasks | `AdminPageContent.tsx` |
| Club onboarding | One long form (plan → facility → login) with Danish-sourced labels; clubs land in `PENDING` until manual approval | `opret-klub/SignupForm.tsx` |
| Mobile | Expo 54 / RN 0.81, JavaScript (no types), four tabs mirroring the web, Apple/Google/email auth, biometric lock, push. Still shows a **country onboarding** flow | `mobile/App.js`, `CountryOnboarding.js` |
| Hardware | Shelly-based lighting/door control with event log and manual override | `club-control*.ts`, `ManualLights.tsx` |
| Payments | Stripe Connect destination charges, subscription billing for clubs, webhook replay protection, idempotency keys, currency snapshots on every money row | `payments.ts`, `club-onboarding.ts`, `stripe-webhook-handler.ts` |

## What is good and must be preserved

- The money model is careful: immutable currency/time-zone snapshots, idempotent webhooks, row locks on club rows, holds that expire, overlap rejection in SQL.
- Multi-tenant isolation is consistently keyed on `clubId`; admin sections are gated by `solutionMode` and `customFeatures`.
- Venue time zones are first-class (IANA zone per club, DST-aware wall-time helpers with tests).
- The court-tile visual language is distinctive and worth building the whole system around.
- Hardware control has safe fallbacks and an audit log.

## Problems ranked by user impact

1. **Nothing to discover.** With zero supply, every player journey ends in an empty state within one click. The empty state must become the product: honest, local, and useful (notify me, find a coach instead, list your club).
2. **The public site lives on an onrender.com subdomain.** Breaks trust, SEO, link sharing and the app's deep links. (Infrastructure change — code is ready and inert; exact DNS/Render/Stripe steps in `docs/domain-cutover.md`.)
3. **Every page ships ~400 kB of JS**, most of it translation dictionaries nobody in the US uses. Mobile LCP/INP suffer directly.
4. **Danish leaks through the seams**: route slugs, `lang`-independent defaults (`InternationalProvider` defaults to `da`), error messages thrown in Danish and only translated if registered, 8-language picker in the footer of a US-only product.
5. **Discovery lacks the three things American players search by**: location (city/state/ZIP), time (available today/this evening) and price.
6. **Club admin home gives a manager nothing to act on** today.
7. **Club signup is one undifferentiated form**; a manager cannot see the result before paying.
8. **Design inconsistency**: three button styles, five card radii, ad-hoc spacing, no empty/loading/error primitives, no motion system.
9. **Dev workflow friction**: build depends on network (DB-IP download, Prisma engine download), integration tests silently rotted, source is minified-style JSX that resists review.

## Technical notes

- Next.js 15.5 App Router, React 18, Tailwind 3, Prisma 5.22 on PostgreSQL (Render), Stripe, Leaflet, Resend, Shelly Cloud, Expo 54.
- All pages are `force-dynamic`; nothing is cached. Fine at current scale, but discovery pages should move to short-TTL caching once supply exists.
- `middleware.ts` matcher excludes `/api`, `/_next`, `/app`; regional redirect uses `tm_session` cookie presence as the EU-legacy signal.
- Regional sharding (`REGIONAL_SHARDING_ACTIVE`, `RACKETBUDDY_REGION`) is enforced in a Prisma middleware for `User/Club/CoachProfile` writes.
- `npm run build` runs `prisma db push` on every deploy — schema changes apply automatically and non-interactively; destructive changes would need a manual migration plan.
