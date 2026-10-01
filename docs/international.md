# International support

The website and Expo app share `shared/international.mjs`. Supported discovery and signup countries are DK, SE, NO, DE, GB, US, CA, FR, ES, IT, NL, BE, AT, CH, FI, IE, PT, PL and CZ. Language and country are independent preferences.

## Prices and payments

Clubs choose DKK, EUR, GBP, SEK, NOK, USD, CAD, CHF, PLN or CZK. Coaches choose their currency when creating a profile. These currencies all use two decimal places in Stripe. Existing integer `priceKr` fields represent whole major currency units; wallet balances and Stripe amounts represent minor units. Changing the customer's language does not convert a venue's price.

Bookings, payments, memberships, team purchases, passes, packages and wallet deposits store currency snapshots. Payment confirmation checks amount, currency and order identity. A club with bookings, credit or catalog prices cannot change currency through the settings form. Receipts retain purchase currency and financial reports show a separate total for each currency.

The RacketBuddy tariff remains **199 DKK per month**, plus **14,995 DKK once** for Custom, independent of selected features. These platform charges are not converted to the club's booking currency.

Stripe Connect onboarding uses the club or coach account country, independently of the customer's discovery preference. A configured destination account with active capabilities is still required. Exporting the app does not verify country-specific Stripe account eligibility or execute an international payment.

## Dates, maps and language

Opening hours, pricing rules, coach availability and recurring court reservations use an explicit IANA venue time zone. Booking timestamps remain UTC instants, with a venue-zone snapshot for display. Missing spring-forward hours are skipped or rejected. A repeated autumn hour uses its earliest occurrence; Resasports local-time imports reject ambiguity and require an explicit-offset CSV instead.

The website map uses actual club coordinates and the selected country as its initial viewport. The mobile club page opens directions with coordinates or the address and country. Geocoding is country-specific, serialized, cached and limited to address setup; it is not autocomplete.

Language choices are Danish, English, American English, German, Swedish and Norwegian. The existing dictionary covers these languages. Newly added copy has Danish and English coverage, with English fallback where a German, Swedish or Norwegian translation is unavailable. User-authored club content and all secondary/legal pages are not automatically translated. Update `src/lib/i18n.ts`, then run `node --import tsx scripts/sync-translations.ts` to refresh the app dictionary. Supplementary English phrases live in `shared/phrases.json`.

## Verification and release

- `npm test`: offline server regression tests, including currency proof, local pricing, DST and availability.
- `npm run test:database`: real SQL against an isolated PGlite database; tests foreign-currency wallet debits, currency locks, receipts and separate totals.
- `npm run test:onboarding`: isolated club signup and simulated Stripe subscription/approval scenarios, including US club defaults and fixed DKK tariffs.
- `npm run test:app`: actual local Next server with the isolated database; tests authenticated admin pages, foreign-country filtering and signup API.
- `cd mobile && npm test`: isolated app regressions, including live language updates and venue-day grouping.
- Expo exports validate bundling for iOS, Android and web; they are not signed TestFlight or store releases. EAS project configuration, signing and APNs/FCM credentials remain required as described in `mobile/README.md`.

Tests do not send email, contact real payment providers, execute hardware commands or create production customer records. PGlite tests do not establish multi-session PostgreSQL concurrency guarantees.
