# Store pictures

Two scripts make the App Store and Google Play screenshots from the real app,
so they always show what the app actually looks like.

```bash
# 1. the app and the site must be running locally
cd mobile && RACKETBUDDY_US_API_URL=http://127.0.0.1:3000 npx expo start --web --port 8088

# 2. photograph the screens (signs in as the demo player)
node store/capture.mjs /tmp/shots night

# 3. lay them out for the stores
node store/compose.mjs /tmp/shots /tmp/store
```

Out comes:

- `ios/01..05-*.png` — 1290×2796, the size Apple asks for (6.7").
- `android/01..05-*.png` — 1080×1920 for Google Play.
- `android/feature-graphic.png` — 1024×500, the banner Play shows at the top.

Upload them by hand: App Store Connect → the version → Previews and
Screenshots, and Play Console → Store listing → Phone screenshots.

The headlines live at the top of `compose.mjs`.
