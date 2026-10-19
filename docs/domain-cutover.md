# Serving the US marketplace on racketbuddy.app — cutover plan

Status: **proposed, code-ready, not executed.** Everything in "In code" is on the
branch and inert until the environment variables below are set. The DNS and
Render steps change production and need the owner.

## What is live today (verified 2026-10-19)

| Hostname | Service | Role |
|---|---|---|
| `racketbuddy.app`, `www.racketbuddy.app` | EU web service (Frankfurt), `RACKETBUDDY_REGION=EU`, EU database | Answers the apex. Guests get a **302 → `https://racketbuddy-us.onrender.com/`**; visitors with a `tm_session` cookie stay (legacy European customers). |
| `racketbuddy-us.onrender.com` | US gateway (`scripts/region-gateway.mjs`) | Proxies everything to the US core, adds `x-geo-country: US`, `x-forwarded-host`. `GET /healthz` → `{"ok":true,"region":"US","upstream":"racketbuddy-us-core.onrender.com"}`. |
| `racketbuddy-us-core.onrender.com` | US Next.js app, `RACKETBUDDY_REGION=US`, US database | The product Americans actually use. |

The Render workspace for RacketBuddy is not connected to this session (the
connected workspace holds another project), so service IDs, plans and env
vars were read from the repository and the live endpoints, not from the
Render dashboard. Confirm the service names in the dashboard before step 1.

## Target

`https://racketbuddy.app` **is** the US product. The onrender.com hostnames
keep working (mobile app, Stripe webhooks, bookmarks) but every browser
request on them is permanently redirected to the apex. Legacy European
customers keep their data on the EU service under a hostname of its own.

## In code (this branch)

- `src/middleware.ts`
  - reads the visitor's hostname from `X-Forwarded-Host` first, so the
    custom-domain and canonical-host logic works behind the gateway;
  - `CANONICAL_HOST` (new, optional): when set, any other own hostname is
    308-redirected to it. `/api/*` is never redirected (the matcher excludes
    it), so Stripe webhooks, the mobile app and `/healthz` are unaffected.
- `next.config.mjs`: legacy Danish routes 308 → English routes, so old
  shared links (`/klub/...`, `/book`) keep resolving after the move.
- Login page on the US deployment shows, under a failed sign-in, a link to
  the EU origin (`EU_APP_URL`) for accounts created in Europe.
- `.github/workflows/us-production-smoke.yml` takes the public origin from
  the repository variable `US_PUBLIC_ORIGIN` (default: the onrender host),
  so the same checks verify the cutover.
- Absolute URLs (metadata, sitemap, robots, e-mails, Stripe success/cancel
  and Connect return URLs, `.ics` links) all derive from `APP_URL`.

## Steps (in order; each is reversible until step 6)

1. **EU service — give it a hostname of its own.** Render → EU web service →
   Custom Domains → add `eu.racketbuddy.app`. DNS: `CNAME eu` →
   `<eu-service>.onrender.com`. Wait for the certificate. Set on the EU
   service: `APP_URL=https://eu.racketbuddy.app`. Redeploy. Verify
   `https://eu.racketbuddy.app/login` works for an existing EU customer.
2. **US core — prepare env, no visible change yet.** On the US core:
   `APP_URL=https://racketbuddy.app`, `EU_APP_URL=https://eu.racketbuddy.app`,
   `US_APP_URL=https://racketbuddy.app`. Do **not** set `CANONICAL_HOST`
   yet. Leave the EU service's `US_APP_URL` at the onrender URL for now: the
   EU middleware skips the redirect when the target origin equals the
   request origin, so pointing it at the apex before DNS moves would show
   guests the EU site. Redeploy the US core. E-mails and Stripe return URLs
   now name `racketbuddy.app`; while DNS still points at the EU service
   those links reach the EU app, which 302s guests to the US host, so
   nothing breaks in between.
3. **Third parties.**
   - Stripe (US account): add `https://racketbuddy.app/api/webhooks/stripe`
     as a second webhook endpoint with the same events; keep the onrender
     endpoint until step 7. Put the new signing secret in the US core as
     `STRIPE_WEBHOOK_SECRET` only if the endpoint is switched; otherwise
     leave the existing one — webhooks keep arriving on the onrender host.
   - Stripe Connect: no change (return/refresh URLs are built from `APP_URL`).
   - Google / Apple sign-in: add `https://racketbuddy.app` to authorised
     origins/redirect URIs alongside the onrender host.
   - Resend: `racketbuddy.app` is already the sending domain.
4. **Move the apex.** Render → US gateway service (`racketbuddy-us`) →
   Custom Domains → add `racketbuddy.app` and `www.racketbuddy.app`.
   Remove the two domains from the EU service first (Render will not attach
   one domain to two services). DNS at the registrar:
   `A @ → 216.24.57.1` (Render's apex address; confirm in the dashboard when
   adding the domain) and `CNAME www → racketbuddy-us.onrender.com`. TTL 300
   during the change. Certificates issue automatically once DNS propagates.
5. **Switch the canonical host.** US core: `CANONICAL_HOST=racketbuddy.app`.
   EU service: `US_APP_URL=https://racketbuddy.app`. Redeploy both. From now
   on `racketbuddy-us.onrender.com/courts` → 308 → `racketbuddy.app/courts`;
   `/api/*` and `/healthz` stay; EU guests arriving at `eu.racketbuddy.app`
   are sent to the apex.
6. **Verify.** Set the repository variable `US_PUBLIC_ORIGIN=https://racketbuddy.app`
   and run the "Verify USA production" workflow. Manually: sign up a new
   player on the apex, reserve and pay a $1 test court with a live card,
   confirm the booking e-mail links point at `racketbuddy.app`, cancel and
   confirm the refund; sign in as a legacy EU customer at
   `eu.racketbuddy.app`; open a mobile build and complete a booking (it
   still talks to the onrender host).
7. **After one quiet week.** Point the mobile app's `apiUrlUs` at
   `https://racketbuddy.app` in a store release, then remove the old Stripe
   webhook endpoint. Leave the onrender hostnames in place indefinitely —
   they cost nothing and every old link redirects.

## Rollback

Each step undoes independently: remove `CANONICAL_HOST` (step 5), move the
custom domains back to the EU service and revert DNS (step 4), restore
`APP_URL` values (steps 1–2). No data moves at any point; the EU and US
databases are untouched, so there is nothing to migrate back.

## Session cookies and sign-in

`tm_session` is a host-only cookie. A customer signed in on the onrender
host is signed out by the redirect to the apex once (they land on
`/login?next=…` and are returned to the page they wanted); nothing is lost.
EU and US accounts are separate by design; the login hint handles the
European customer who types the US address.

## Indexing

Canonical URLs, `sitemap.xml` and `robots.txt` derive from `APP_URL`; after
step 2 they all name `racketbuddy.app`. Submit the sitemap in Search Console
for the apex once step 4 is complete; the 308s transfer the onrender
host's standing.
