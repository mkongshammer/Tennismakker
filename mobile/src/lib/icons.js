// Samme streg-ikoner som websitets bundlinje (src/components/TabBar.tsx),
// bare tegnet med react-native-svg i stedet for HTML <svg>. Farven sendes
// ind som prop, så den aktive fane kan være banens blå og resten skifergrå
// — nøjagtig samme regel som på websitet.
import React from "react";
import { Svg, Path, Rect, Circle } from "react-native-svg";

function strokeWidth(active) {
  return active ? 2.2 : 1.7;
}

export function IconCourt({ active, color, size = 24 }) {
  const w = strokeWidth(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="4.5" width="17" height="15" rx="1.5" stroke={color} strokeWidth={w} />
      <Path
        d="M12 4.5v15M3.5 12h17M8 8.5h8M8 15.5h8"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconCoach({ active, color, size = 24 }) {
  const w = strokeWidth(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="7.5" r="3.5" stroke={color} strokeWidth={w} />
      <Path
        d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconPlayers({ active, color, size = 24 }) {
  const w = strokeWidth(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="8.5" cy="8" r="3" stroke={color} strokeWidth={w} />
      <Circle cx="16" cy="10.5" r="2.5" stroke={color} strokeWidth={w} />
      <Path
        d="M2.5 19c0-3 2.7-5 6-5s6 2 6 5M14.5 19c.3-2.3 2.3-3.6 4.6-3.6 1.3 0 2.4.4 3.2 1.1"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconMessages({ active, color, size = 24 }) {
  const w = strokeWidth(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5h16v11H9.5L4.5 20V5.5Z"
        stroke={color}
        strokeWidth={w}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
