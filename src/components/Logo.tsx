// Mærket. Samme tegning som app-ikonet og favicon'et, så det er den samme
// ketsjer, uanset om man møder den i en fane, på en telefon eller i toppen
// af siden.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="512" height="512" rx="116" fill="#0F2138" />
      <g transform="rotate(-32 236 236)">
        <rect x="218" y="300" width="36" height="150" rx="18" fill="#FFFFFF" />
        <ellipse cx="236" cy="196" rx="106" ry="128" fill="#0F2138" />
        <g stroke="#FFFFFF" strokeWidth="9" opacity="0.32">
          <path d="M236 76 V316" /><path d="M180 90 V302" /><path d="M292 90 V302" />
          <path d="M132 196 H340" /><path d="M142 140 H330" /><path d="M142 252 H330" />
        </g>
        <ellipse cx="236" cy="196" rx="106" ry="128" fill="none" stroke="#FFFFFF" strokeWidth="30" />
      </g>
      <circle cx="372" cy="384" r="66" fill="#D8FF3E" />
      <path
        d="M324 424 A 68 68 0 0 1 404 336"
        fill="none"
        stroke="#0F2138"
        strokeWidth="11"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
