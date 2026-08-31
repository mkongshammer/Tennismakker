// Banemotiv i klubbens farve — samme rettede version som websitet
// (nettet står på tværs, ikke på langs). Erstatter et generisk farvefelt,
// fordi klubberne ikke har rigtige fotos endnu.
import React from "react";
import { Svg, Rect, Line } from "react-native-svg";

export function CourtGraphic({ color, width = 96, height = 64 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 72">
      <Rect width="120" height="72" fill={color} />
      <Rect x="14" y="10" width="92" height="52" stroke="#FAF7F0" strokeWidth={1.5} fill="none" opacity={0.9} />
      <Line x1="14" y1="17" x2="106" y2="17" stroke="#FAF7F0" strokeWidth={1.5} opacity={0.9} />
      <Line x1="14" y1="55" x2="106" y2="55" stroke="#FAF7F0" strokeWidth={1.5} opacity={0.9} />
      <Line x1="38" y1="17" x2="38" y2="55" stroke="#FAF7F0" strokeWidth={1.5} opacity={0.9} />
      <Line x1="82" y1="17" x2="82" y2="55" stroke="#FAF7F0" strokeWidth={1.5} opacity={0.9} />
      <Line x1="38" y1="36" x2="82" y2="36" stroke="#FAF7F0" strokeWidth={1.5} opacity={0.9} />
      <Line x1="60" y1="6" x2="60" y2="66" stroke="#FAF7F0" strokeWidth={2.6} />
    </Svg>
  );
}
