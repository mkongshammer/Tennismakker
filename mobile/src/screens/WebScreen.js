// A RacketBuddy page shown inside the app.
//
// Everything on racketbuddy.app can be opened here instead of throwing the
// player out into Safari, so pages we only build on the website (a club's
// place page, the vote page, pricing, the legal pages) are part of the app
// too — and get every website update the moment it ships.
//
// The page is asked to render in the app's own theme, and the site's header,
// footer and tab bar are hidden so what is left is the content, inside the
// app's own navigation.
import React, { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { checkoutUrl } from "../lib/api";
import { colors, themeName } from "../lib/theme";
import { Loading, ErrorMessage } from "../lib/ui";
import { tr, useInternational } from "../lib/international";

/** Pure: our own page with the app's theme asked for; anything else is left alone. */
export function appUrl(path, theme) {
  const url = new URL(checkoutUrl(path));
  url.searchParams.set("rb_theme", theme === "light" ? "light" : "night");
  return url.href;
}

/** Pure: true when a link should stay in the app (our own site), false to hand it to the browser. */
export function staysInApp(target, base) {
  try { return new URL(target).origin === new URL(base).origin; } catch { return false; }
}

const HIDE_SITE_CHROME =
  "(function(){var s=document.createElement('style');" +
  "s.textContent='body > header, body > footer, body > nav.fixed, .rb-app-hide {display:none!important} " +
  "main {padding-top:16px!important;padding-bottom:28px!important}';" +
  "(document.head||document.documentElement).appendChild(s);})();true;";

export default function WebScreen({ route }) {
  useInternational();
  const web = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const path = route?.params?.url ?? route?.params?.path ?? "/";
  let href = null;
  try { href = appUrl(path, themeName); } catch { href = null; }

  const retry = useCallback(() => { setError(null); setLoading(true); web.current?.reload(); }, []);

  if (!href) return <ErrorMessage message={tr("The link isn’t valid.")} />;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;
  return (
    <View style={styles.fill}>
      <WebView
        ref={web}
        source={{ uri: href }}
        style={styles.fill}
        containerStyle={styles.fill}
        injectedJavaScript={HIDE_SITE_CHROME}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError(tr("The page couldn’t be loaded. Please try again.")); }}
        onHttpError={({ nativeEvent }) => { if (nativeEvent.statusCode >= 500) { setLoading(false); setError(tr("The page couldn’t be loaded. Please try again.")); } }}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url === href || request.url === "about:blank" || staysInApp(request.url, href)) return true;
          Linking.openURL(request.url).catch(() => {});
          return false;
        }}
        allowsBackForwardNavigationGestures
        decelerationRate="normal"
        sharedCookiesEnabled={false}
        incognito
      />
      {loading ? <View style={[styles.cover, { backgroundColor: colors.mist }]}><Loading label={tr("Henter…")} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
