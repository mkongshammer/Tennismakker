# App design refresh — 1 October 2026

The app now has a navy and blue visual identity with a small yellow accent,
vector court artwork, clear screen headings and a shared reading width.
Login, club discovery, coach cards, player cards, messages, profile and booking
review use the same spacing and typography. Authentication, payment and door
authorization remain handled by the existing services.

Club search filters names and cities in the currently selected sport. Clearing
the query restores the results without another API call. All six sports are
visible as wrapping buttons. Scrolling the list also scrolls its heading and
filters so the mobile screen keeps space for results.

Controls retain their accessibility labels, loading/disabled states and minimum
touch sizes. Long names can wrap, text inputs preserve their autofill settings,
and illustrations need no network request. Larger web screens retain the sidebar
and get a two-column login layout. Message reading width and form width are bounded.

Verification: 23 mobile tests passed, including search/clear/navigation, role-specific
club login, booking review, duplicate taps and door availability/errors. Expo
exports passed for iOS, Android and web. Hardware, live payments and native device
testing are outside this visual change. Publishing the web export does not update
an installed App Store/Google Play build; a signed app release remains required.
