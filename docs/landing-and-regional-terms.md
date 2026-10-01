# Landing page and regional terms — 2026-10-01

The landing page presents RacketBuddy as club operations connected to a court, coach and playing-partner marketplace. It does not query or display signup totals, coach totals, club totals or an advertised inventory count. Discovery saves country and sport and sends users to the actual court, coach or partner page. Destinations are server-whitelisted. The club discovery preference does not change venue currency, time zone or payout details.

Standard and Custom are labelled separately. Prices come from the same configured tariff as signup. The Custom CTA preselects Custom; hardware and third-party access are explicitly prerequisites. The mobile app is described as upcoming, not available in stores. All landing copy covers da/en/en-US/de/sv/no.

## Legal pages

- `/vilkaar/eu`: EU/EEA terms in Danish or English, with an explicit language toggle.
- `/vilkaar/usa`: United States terms in English.
- `/vilkaar`: saved-country routing for EU/EEA and US, otherwise an explicit region selector. IP/language is not represented as proof of applicable law.
- Signup terms links follow the country currently selected in the form. The footer exposes both documents.

The document version is 2026-10-01. The terms describe the actual monthly start at payment, pending club approval, fixed Custom setup fee, billing portal/email cancellation, booking confirmation and checkout deadline, 24-hour ordinary booking policy, wallet/pass distinctions, provider responsibilities and hardware prerequisites. They preserve mandatory consumer remedies and avoid mandatory arbitration or class-action waivers. The old ODR link is removed.

This change creates customer-facing documents, not a certification of legal compliance. No lawyer has reviewed them. Other markets need their own applicability assessment; privacy policy and data-processing agreement are still the existing documents. No new automatic tax, refund, renewal-notice or payment integration is introduced by publishing these terms. Existing agreements are not represented as retrospectively accepted. Signup already stores acceptance time and country; a versioned acceptance register remains separate work.

## Sources checked on 2026-10-01

- EU Commission, withdrawal rights and exceptions: https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm
- EU Commission, closure of ODR and current ADR directory: https://consumer-redress.ec.europa.eu/site-relocation_en
- EU consumer contract rules: https://europa.eu/youreurope/business/selling-in-eu/consumer-contracts-guarantees/consumer-contracts/index_en.htm
- Rome I consumer protection: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32008R0593
- US FTC, subscription disclosures and cancellation: https://consumer.ftc.gov/articles/getting-and-out-free-trials-auto-renewals-and-negative-option-subscriptions
- US FTC, ROSCA: https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act
- California current automatic-renewal statute: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=17602.&lawCode=BPC

The vacated 2024 FTC negative-option rule is not represented as current law. No claim is made that club B2B subscriptions are automatically consumer contracts.

## Image asset

Final project asset: `public/images/club-life-hero.webp` (1536 × 1024, optimised locally). Created with the built-in imagegen tool. It is editorial artwork, not a photograph of an actual bookable listing. No synthetic club names, availability or reviews accompany it.

The pre-compressed 341 KB WebP is served directly with explicit dimensions and priority loading. Live verification found that Render's image-optimiser route rejected this local asset, while the static image route served valid WebP bytes. Direct delivery avoids that runtime dependency; the HTTP regression suite also verifies the asset's MIME type, signature and size.

Final prompt: “Use case: photorealistic-natural. Asset type: original editorial hero photograph for the RacketBuddy racket-sports ecosystem website. Primary request: aspirational but authentic club tennis atmosphere, like tasteful premium travel editorial photography. Scene: a beautiful blue-green outdoor tennis court beside a contemporary club house, tree-lined surroundings, two adult recreational players in simple tennis clothing rallying in the distance. Natural late-afternoon sunlight, warm green foliage, credible physical court markings and a taut net, no staging or glamorous luxury. Composition: landscape 1536x1024, elevated three-quarter view, court and people on the right and centre, generous foliage and club edge on the left; enough room to crop into a tall mobile frame. Medium: natural camera photograph, realistic materials and humans, quiet, inviting, editorial colour grading. Constraints: no text, no logos, no watermarks, no interface, no charts; not a specific real club, no claims of a real listing; no invented facilities beyond the simple club house and tennis court.”
