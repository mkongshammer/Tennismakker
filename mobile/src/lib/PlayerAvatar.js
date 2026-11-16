// Faces for players who have no photo.
//
// Every player gets their own two colours, always the same ones, so a profile
// without a picture is still recognisable in a row of twenty. The ring marks
// a player who has an open post right now — the same idea as the website.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Circle, Rect } from "react-native-svg";
import { colors } from "./theme";

export const GRADIENTS = [
  ["#1B62C4", "#7AB0FF"], ["#0D7D5A", "#7BE0B5"], ["#B4541E", "#FFB37A"], ["#6B3FA0", "#C9A6FF"],
  ["#0F6E8C", "#7FD8F0"], ["#A0284B", "#FF9DB8"], ["#3D5A1E", "#C8E86B"], ["#1F3A8A", "#9CB6FF"],
];

/** Pure: the same id always picks the same pair of colours. */
export function gradientFor(id) {
  let h = 0;
  const key = String(id ?? "");
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Pure: up to two initials from a name. */
export function initialsOf(name) {
  return String(name ?? "").split(/\s+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/** Pure: the first name, for the narrow label under a story bubble. */
export function firstName(name) {
  return String(name ?? "").split(/\s+/)[0] ?? "";
}

export function PlayerAvatar({ id, name, size = 56, ring = false }) {
  const [from, to] = gradientFor(id);
  const gap = ring ? 3 : 0;
  const outer = size + (ring ? 12 : 0);
  const gid = `a${String(id ?? "x").replace(/[^a-zA-Z0-9]/g, "")}`;
  // One drawing, in paint order: the ring, the gap in the card's own colour,
  // then the face. Two stacked <Svg>s looked right on a phone but the ring
  // covered the face in a browser, where an absolutely placed box paints on
  // top of its siblings.
  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      <Svg width={outer} height={outer}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} /><Stop offset="1" stopColor={to} />
          </LinearGradient>
          <LinearGradient id={`${gid}r`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D8FF3E" /><Stop offset="0.5" stopColor="#3B84E8" /><Stop offset="1" stopColor="#FF8A4C" />
          </LinearGradient>
        </Defs>
        {ring ? (
          <>
            <Circle cx={outer / 2} cy={outer / 2} r={(outer - 3) / 2} stroke={`url(#${gid}r)`} strokeWidth={3} fill="none" />
            <Circle cx={outer / 2} cy={outer / 2} r={(size + gap * 2) / 2} fill={colors.surface} />
          </>
        ) : null}
        <Circle cx={outer / 2} cy={outer / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.36), position: "absolute" }]} allowFontScaling={false}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

/** The coloured band across the top of a profile card. */
export function CardBand({ id, height = 56 }) {
  const [from, to] = gradientFor(id);
  const gid = `b${String(id ?? "x").replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width="100%" height={height}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} /><Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill={`url(#${gid})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  initials: { color: "#FFFFFF", fontWeight: "800", letterSpacing: -0.4 },
});
