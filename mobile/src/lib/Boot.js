// The first thing people see after the system splash: the wordmark on the
// splash colour, easing in, with a thin progress line. No spinner, no text.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";

export const SPLASH_BACKGROUND = "#081527"; // same as the native splash

export function BootScreen({ label }) {
  const appear = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [appear, slide]);
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const x = slide.interpolate({ inputRange: [0, 1], outputRange: [-64, 128] });
  return (
    <View style={styles.screen} accessible accessibilityRole="progressbar" accessibilityLabel={label ?? "RacketBuddy"}>
      <Animated.View style={{ opacity: appear, transform: [{ scale }], alignItems: "center" }}>
        <Text style={styles.word}>Racket<Text style={styles.buddy}>Buddy</Text></Text>
        <View style={styles.track}><Animated.View style={[styles.bar, { transform: [{ translateX: x }] }]} /></View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SPLASH_BACKGROUND, alignItems: "center", justifyContent: "center" },
  word: { color: "#F7F9FC", fontSize: 34, fontWeight: "800", letterSpacing: -1.1 },
  buddy: { color: "#5B9BF0" },
  track: { width: 128, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 22 },
  bar: { width: 64, height: 3, borderRadius: 2, backgroundColor: colors.courtText },
});

// Cold start: the wordmark stays for at least ~2.5 seconds so it can be seen,
// and longer if the app is still loading, then fades out over the app.
const MIN_MS = 2500;
const startedAt = Date.now();

export function BootOverlay({ ready }) {
  const [minDone, setMinDone] = React.useState(Date.now() - startedAt >= MIN_MS);
  const [gone, setGone] = React.useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (minDone) return;
    const id = setTimeout(() => setMinDone(true), Math.max(0, MIN_MS - (Date.now() - startedAt)));
    return () => clearTimeout(id);
  }, [minDone]);
  useEffect(() => {
    if (!(ready && minDone)) return;
    Animated.timing(fade, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setGone(true));
  }, [ready, minDone, fade]);
  if (gone) return null;
  return (
    <Animated.View pointerEvents={ready && minDone ? "none" : "auto"} style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 1000 }]}>
      <BootScreen />
    </Animated.View>
  );
}
