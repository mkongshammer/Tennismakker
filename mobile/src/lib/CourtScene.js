import React from "react";
import { Svg, Rect, Line, Circle, G } from "react-native-svg";
import { colors } from "./theme";

// Decorative court artwork stays sharp at every size and needs no photo download.
export function CourtScene({ height = 160 }) {
  return <Svg width="100%" height={height} viewBox="0 0 380 200" accessible={false}>
    <G transform="translate(28 8) rotate(-12 170 95)">
      <Rect x="24" y="16" width="294" height="174" rx="20" fill={colors.court} />
      <Rect x="56" y="36" width="230" height="134" fill="none" stroke="#B8D5FF" strokeWidth="2" />
      <Line x1="56" y1="60" x2="286" y2="60" stroke="#B8D5FF" strokeWidth="2" />
      <Line x1="56" y1="146" x2="286" y2="146" stroke="#B8D5FF" strokeWidth="2" />
      <Line x1="116" y1="60" x2="116" y2="146" stroke="#B8D5FF" strokeWidth="2" />
      <Line x1="226" y1="60" x2="226" y2="146" stroke="#B8D5FF" strokeWidth="2" />
      <Line x1="116" y1="103" x2="226" y2="103" stroke="#B8D5FF" strokeWidth="2" />
      <Line x1="171" y1="26" x2="171" y2="180" stroke="white" strokeWidth="4" />
      <Circle cx="269" cy="139" r="14" fill={colors.optic} />
      <Line x1="262" y1="127" x2="275" y2="151" stroke={colors.ink} strokeWidth="1.5" />
    </G>
  </Svg>;
}
