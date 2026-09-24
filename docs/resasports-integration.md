# Resasports import

Custom club administrators can open `/admin/integrationer`, choose **Hent direkte fra Resasports**, provide the Nubapp credentials, fetch a preview, explicitly map source facilities to their own courts, and confirm the existing atomic import.

This is a one-way migration snapshot, not a live availability adapter or two-way synchronization. It does not update or cancel existing imported bookings on subsequent reads. Do not keep selling the same court times in both systems after migration without an agreed cutover. Source bookings, charges, memberships, balances and notifications are never changed. Imported bookings have price 0; no historical payment or membership status is inferred. New users use password reset to choose their own password; the import itself sends no email.

## Vendor access

Primary contract retrieved 2026-09-24: https://sport.nubapp.com/api/v4/docs.json . Nubapp identifies v4 as deprecated and requires approved endpoint access. Its v5 documentation at https://sport.nubapp.com/api/v5/docs.json documents ApiKey authentication, but does not provide the same complete collection contracts needed here. This connector implements the documented v4 credential contract, not speculative v5 routes.

Ask Nubapp for server-side read access to these methods for the club's `id_application` and administrator `action_by`:

- POST `/api/v4/users/getUsers.php` (pagination, athlete user type 5)
- POST `/api/v4/facilities/getFacilities.php`
- POST `/api/v4/bookings/getBookings.php` (explicit date range)

Inputs are API username `u`, password `p`, application ID and administrator ID, plus token if Nubapp requires it for these credentials. A normal member password or a v5 API key is not a substitute for this contract. Live and sandbox origins are fixed in code; credentials go in the request body, never the URL, and are neither stored nor returned in preview state. Redirects are rejected. Sandbox contains a nightly copy of production data according to Nubapp; it is not necessarily synthetic.

## Guardrails and limits

- Only CUSTOM club admins can fetch; the existing importer rechecks role and club ownership before committing.
- Up to 500 member + booking rows combined, 100-member pagination, 5 MB per response, 20-second request timeout. Larger clubs use split CSV import; nothing is silently truncated.
- Only name, email, phone, source IDs, facility names and booking times are returned to the browser. Other vendor fields are discarded.
- Requires unique member emails and IDs, known member/facility references, explicit court mapping and review. Unsupported expiring booking states fail closed.
- Danish local timestamps require explicit acknowledgement; ambiguous/nonexistent DST times fail instead of being shifted. Other timezones use CSV with explicit offsets.
- No automatic court creation or inferred sport/surface mapping. Destination courts already belong to the signed-in club.
- Existing import logic checks future dates (up to a year), overlaps and imported IDs and rolls back the whole transaction on failure. Source namespace is `Resasports:<applicationId>`; keep it unchanged to preserve duplicate detection.

## Validation and remaining acceptance

Contract-shaped offline provider tests cover fixed origin, credential placement, application scope, pagination failures, invalid data, timezone conversion and authorization. SQL integration tests exercise the actual importer and wallet against an isolated PGlite database. These do not prove vendor permissions, actual response compatibility for a particular club, or multi-session PostgreSQL concurrency.

Before a real migration: obtain Nubapp access, fetch the club's preview, reconcile member count, booking count, source club ID and sample dates/courts, agree the cutover date, then confirm. No real club API credentials were available during development, so a real Resasports pull remains unverified.
