# RacketBuddy — store listing

Release owner: RacketBuddy LLC

## Apple App Store

**Name:** RacketBuddy

**Subtitle:** Find spillere, trænere og baner

**Primary category:** Sports

**Promotional text:** Find en medspiller på dit niveau, book en bane eller find en træner direkte i RacketBuddy.

**Keywords:** tennis,padel,badminton,racketsport,makker,bane,booking,træner,squash,pickleball

**Description:**
RacketBuddy samler racketsport ét sted.

Find andre spillere på dit niveau og i dit område, book ledige baner hos tilknyttede klubber og centre, og find trænere med ledige tider.

Med RacketBuddy kan du blandt andet:
- finde medspillere på dit niveau
- oprette og svare på spilleopslag
- booke ledige baner
- finde og booke trænere
- skrive med andre spillere
- se dine kommende bookinger

Klubber og centre kan bruge RacketBuddy til at åbne udvalgte ledige tider for medlemmer og gæster.

Betaling for baner og træning vedrører fysiske ydelser og gennemføres via RacketBuddys sikre betalingsside.

**Support URL:** https://racketbuddy.app

**Privacy Policy URL:** https://racketbuddy.app/privatliv

**Account deletion URL:** https://racketbuddy.app/slet-konto

**Terms URL:** https://racketbuddy.app/vilkaar

### App Review notes
RacketBuddy lets users create an account directly in the app. A reviewer can choose “Ny her? Opret profil” on the login screen. New accounts must confirm that the user is 18+ and accept the Terms and Privacy Policy.

The app contains user-generated profiles, match posts, messages and reviews. Users can report profiles, match posts, conversations and reviews from inside the app. Users can also block another user from a player card, a match post or a conversation. Blocked users are hidden from each other and cannot start or continue contact. Blocked users can be managed under “Min profil” → “Sikkerhed”. Server-side checks reject selected high-risk objectionable text and moderation reports are stored for review.

Court and coach payments are for real-world physical services. The app opens RacketBuddy's secure web checkout to complete those payments; the native app does not receive card numbers.

Account deletion is available inside the app under “Min profil” → “Slet konto permanent”. The public account-deletion information is also available at https://racketbuddy.app/slet-konto.

For App Review, create a dedicated reviewer account with enough test data to inspect player discovery, messaging and at least one club/coach booking flow. Put those credentials only in App Store Connect review notes, never in this repository.

## Google Play

**App name:** RacketBuddy

**Category:** Sports

**Short description:** Find medspillere, book baner og trænere til din racketsport.

**Full description:**
RacketBuddy gør det nemmere at komme ud og spille.

Find andre spillere på dit niveau og i dit område, opret spilleopslag, book ledige baner hos tilknyttede klubber og centre, og find trænere med ledige tider.

RacketBuddy giver dig mulighed for at:
- finde relevante medspillere
- oprette og svare på spilleopslag
- booke baner
- booke træning
- sende beskeder til andre spillere
- holde styr på kommende bookinger

For klubber og centre fungerer RacketBuddy samtidig som en kanal til at gøre udvalgte ledige tider tilgængelige for medlemmer og eksterne spillere.

**Privacy policy:** https://racketbuddy.app/privatliv

**Account deletion:** https://racketbuddy.app/slet-konto

**Support:** racketbuddy.app@gmail.com

### Play review notes
The same user-generated-content safety controls described above are available on Android: in-app report actions, user blocking, moderation checks and account deletion. RacketBuddy does not use an advertising SDK or cross-app tracking SDK in the current mobile project.

## Store data checklist

Verify every answer against the production build and server configuration immediately before submission:

- Account information: name and email are collected to create and operate an account.
- User-generated content: profile text, match posts, messages and reviews are processed to provide the service and enforce safety rules.
- Safety/moderation data: reports and block relationships are processed for abuse prevention and moderation.
- App activity: bookings, conversations and match activity are processed to provide the service.
- Approximate location: the app asks for a user-selected Danish region/area; it does not request GPS permission in the current mobile code.
- Payment data: checkout is hosted by the payment provider. The native app does not receive full card numbers; confirm the stores' current privacy definitions before answering their payment-data questions.
- Advertising/tracking: no advertising or cross-app tracking SDK is currently included in the mobile project.
- Account deletion: available in-app and at the public deletion URL above.
- Age: RacketBuddy's terms require account holders to be 18+, and signup requires an age confirmation. Complete each store's age/content-rating questionnaire accurately rather than inferring a store rating from this rule alone.

## Assets and release checklist

Before submission, obtain real screenshots from the signed production-candidate build on representative supported devices. Do not use mock screens that show flows or data the production build cannot reproduce. Verify the app icon, adaptive icon, splash screen, store screenshots, privacy/data-safety forms, content-rating forms and review credentials in both consoles.

Do not submit the privacy/data-safety questionnaires by copying this file blindly; confirm the production SDKs, server-side processing and store wording on the day of submission.
