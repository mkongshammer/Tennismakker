# RacketBuddy product direction and implementation plan

Companion to `product-audit-2026-10.md`. This is the direction the October 2026 transformation work follows and the order it ships in.

## Direction

**One product, three doors.** Players discover and book. Coaches get found and get paid. Clubs run the facility. The same design system, the same navigation grammar, the same copy voice on web and mobile.

**Honest marketplace.** No invented clubs, reviews or availability. When a city has no supply yet, the product says so, captures intent (notify me when courts open near a ZIP), and offers the next best real thing (coaches, players, listing a club).

**American by default.** `en-US` is the product language. Public routes keep working at their existing slugs, but every new surface uses English naming, US address and time conventions, USD, and American copy. Nothing European is reintroduced to the public marketplace.

**Powerful technology, effortless experiences.** Every screen states its purpose in one line, puts the primary action within reach of a thumb, and makes the next step obvious.

### Design system: "Hard court"

Built on the palette already in the codebase, formalised into tokens and primitives:

- Colors: `ink` (surfaces of authority), `court` (primary action), `optic` (one accent per screen), `mist` (page), `chalk` (cards). Semantic additions: `success`, `warning`, `danger`, `info` with soft/strong pairs.
- Type: Bricolage Grotesque display, Inter Tight body, Martian Mono for times and money. Scale: display-xl 56/60, display-lg 40/44, display-md 28/32, title 20/28, body 16/24, small 14/20, micro 12/16.
- Radius: 12 (controls), 16 (cards), 24 (sections), 999 (pills). Shadows: `card`, `lift`, `pop`.
- Motion: 150 ms ease-out for state, 250 ms for enter/exit, honour `prefers-reduced-motion`.
- Primitives (`src/components/ui`): `Button`, `Card`, `Badge`, `Pill`, `Field`, `PageHeader`, `StatTile`, `EmptyState`, `Skeleton`, `Toast`, `SectionNav`.
- Signature: the court tile. Available times are pieces of court; the sport's real surface color carries meaning.

## Implementation order

Each step is a complete, tested increment on `racketbuddy/product-transformation`.

| # | Increment | Why first | Verification |
|---|---|---|---|
| 1 | **Foundation**: tokens, `ui/` primitives, en-US client dictionary split (ship only English to browsers), `lang`/provider defaults to en-US | Unblocks every later screen; largest performance win | `tsc`, unit tests, build size before/after |
| 2 | **Public website**: hero, three journeys, how it works, honest trust, pricing (unchanged), SEO (metadata, Open Graph, sitemap, robots, JSON-LD), American copy | Five-second comprehension | Screenshots phone/desktop, Lighthouse-style timings |
| 3 | **Discovery**: city/state/ZIP search with US geocoding of the query, distance, filters (sport, indoor, price, available today), map/list, favorites (local), the empty state that captures intent (`MarketInterest`) | Core player journey; makes zero-supply honest and useful | DB tests for the interest capture, screenshots |
| 4 | **Club page + booking**: clearer header, availability by day with sticky price summary, confirmation and next steps, cancellation clarity | Conversion | Existing booking tests + journey test |
| 5 | **Coach marketplace**: richer cards and profile, location search, lesson booking summary | Second supply type | Screenshots |
| 6 | **Club admin home**: today, utilization, upcoming, revenue, tasks, quick actions; rule-based alerts | Differentiator | DB-backed tests of the metrics |
| 7 | **Club self-service onboarding**: stepper with live preview of the public listing | Reduces drop-off | Onboarding test suite |
| 8 | **Mobile**: theme parity, discovery empty states, remove country step, copy | App parity | Mobile unit tests, Expo export |
| 9 | **Validation**: type check, unit, DB, onboarding, build, screenshots, accessibility checks, before/after metrics | Release gate | Documented in `docs/qa-2026-10.md` |

## Not in scope (owner decisions)

- Moving the public origin off `racketbuddy-us.onrender.com` (DNS/Render change).
- Any pricing change. Standard remains USD 30/month; Custom remains the configured one-time setup price.
- Removing legacy EU data or routes that existing contracts depend on.
