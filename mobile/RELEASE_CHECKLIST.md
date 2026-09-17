# RacketBuddy mobile release checklist

This file tracks the final App Store and Google Play release gates for the Expo app in `mobile/`.

## Code / build configuration

- [x] App name: `RacketBuddy`
- [x] Version: `1.0.0`
- [x] iOS bundle identifier: `dk.racketbuddy.app`
- [x] Android package name: `dk.racketbuddy.app`
- [x] iOS build number configured
- [x] Android version code configured
- [x] Production API URL points to `https://racketbuddy.app`
- [x] App icon, adaptive icon and splash assets are configured
- [x] EAS production build profile exists and auto-increments store build numbers
- [x] Expo SDK 54 / Android API 36 baseline
- [x] CI validates Expo config and exports iOS, Android and web bundles

## Store review requirements implemented in the app

- [x] Users can create an account in the app
- [x] Users can permanently delete their account in the app
- [x] Public account-deletion page exists at `https://racketbuddy.app/slet-konto`
- [x] Privacy policy is linked in-app at `https://racketbuddy.app/privatliv`
- [x] Terms are linked in-app at `https://racketbuddy.app/vilkaar`
- [x] Court and coach payments are for real-world services and use the external RacketBuddy checkout
- [x] No advertising or cross-app tracking SDK is currently declared in the mobile project

## Apple App Store — external account/setup gates

- [ ] RacketBuddy LLC Apple Developer Organization enrollment is approved
- [ ] Create the App Store Connect app under the RacketBuddy LLC team using bundle ID `dk.racketbuddy.app`
- [ ] Link this Expo project to the RacketBuddy Expo/EAS account (`eas init`) and create signing credentials
- [ ] Build the production iOS binary with EAS
- [ ] Upload the production build to App Store Connect
- [ ] Add App Store screenshots for every supported device class (the current config has iPad support enabled)
- [ ] Complete App Privacy answers using the production data flows
- [ ] Complete age rating, support/contact and review-information fields
- [ ] Add a review account if Apple cannot fully review the app by creating a fresh account
- [ ] Submit version 1.0.0 for App Review

## Google Play — external account/setup gates

- [ ] Google Play Console developer account is active
- [ ] Create the Play app with package name `dk.racketbuddy.app`
- [ ] Link the Expo project / Android keystore and build a production Android App Bundle (AAB)
- [ ] Upload the AAB to Play Console
- [ ] Add phone screenshots and a 1024 × 500 feature graphic
- [ ] Complete Data safety from the production data flows
- [ ] Complete App access, Ads, Content rating, Target audience and other policy declarations
- [ ] Confirm the public account-deletion URL in the Play account-deletion declaration
- [ ] Create a production release and submit it for review

## Store copy

The current App Store and Google Play titles, descriptions, keywords, review notes and URLs live in `STORE_LISTING.md`.

## Before pressing Submit

Run a final physical-device smoke test for signup, login, player discovery, match posts, messages, club/coach browsing, booking checkout, logout and permanent account deletion. Do not submit until both signed production builds have passed this test.
