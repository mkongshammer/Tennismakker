# RacketBuddy push notifications

## Implemented
Opt-in from Profile → Notifikationer on physical iOS/Android installations. Independent account-wide preferences for bookings, reminders, messages and coaching. Per-device disable, explicit OS-settings link, logout unregister, session-bound token lifetime, account erasure cleanup.

Events: newly confirmed bookings; confirmed/requested cancellations; confirmed booking time changes; reminders in 15-minute windows approximately 24 hours and 1 hour before start; incoming unread chat (coalesced into five-minute buckets); coach requests and player acceptance/payment prompts. Expired unpaid holds do not trigger cancellations. Generic lock-screen text, no message bodies, names, access codes or payment details.

Tap opens the relevant chat or profile. Coach requests open /profil/traener in the browser, which may require separate web login. This is not a native coach inbox.

Existing authenticated minute cron /api/cron/club-control processes push after hardware reconciliation. No new cron service is required. This does not enable email sending. Durable per-device event deduplication, claims, stale-event/consent checks, expiring tokens, bounded retries and Expo receipt inspection. Expo acceptance is not proof of device delivery. Ambiguous network timeouts can cause duplicate delivery. Round-robin scanning and bounded work can delay alerts; push is not a guaranteed real-time or safety channel. Status transitions that happen entirely between scans may not produce an alert.

## Required native setup (not completed by backend deploy)
1. Link the existing owned Expo/EAS project. Set EAS_PROJECT_ID for preview and production builds to its actual UUID. Do not create another project unless intended.
2. Configure the Apple push authentication key for dk.racketbuddy.app via EAS credentials.
3. Configure Firebase Cloud Messaging v1 credentials for Android in EAS, and GOOGLE_SERVICES_JSON as an EAS file environment variable pointing to the matching google-services.json. Never commit private keys.
4. If enhanced Expo push security is enabled, configure EXPO_ACCESS_TOKEN on Render. Never embed it in the mobile app.
5. Build and distribute new signed native apps with EAS preview/production. A Render deploy or Expo web export alone cannot enable native push. Expo Go does not support this Android flow.
6. Test on physical iPhone and Android, foreground/background/terminated states, consent denied then enabled, category toggles, logout and account switch, account erasure, token rotation, stale cancelled bookings, and tap navigation. Use isolated test data, not actual payments, emails or club hardware.

No APNs/FCM keys or actual EAS project ID were available in this workspace during implementation. Device delivery remains unverified until the above setup and physical tests pass.

## Verification
Offline policy/API/queue tests and Next production build. Expo export validates JS bundles for iOS, Android and web; it does not validate provisioning, credentials, store acceptance or delivery.
