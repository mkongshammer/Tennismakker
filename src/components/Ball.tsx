// Bolden for hver sport, tegnet frem for fotograferet.
//
// Et foto af en fjerbold kræver rettigheder, vejer hundrede gange mere og
// ser forskelligt ud fra sport til sport. Tegnede bolde deler stregtykkelse
// og størrelse, så seks sportsgrene ved siden af hinanden ligner ét sæt og
// ikke seks tilfældige billeder.
//
// Farverne er de rigtige: en squashbold ER sort med en prik, og en
// fjerbold ER hvid med kork. Det er dét, man genkender.
export function Ball({ sport, size = 56 }: { sport: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 64 64", "aria-hidden": true as const };

  switch (sport) {
    case "BADMINTON":
      return (
        <svg {...common}>
          <path d="M32 6 L48 40 H16 Z" fill="#FFFFFF" stroke="#C9D4E0" strokeWidth="1.5" />
          <path d="M32 6 V40 M24 18 L22 40 M40 18 L42 40" stroke="#C9D4E0" strokeWidth="1.5" />
          <path d="M16 40 h32 a16 16 0 0 1 -32 0" fill="#E6B980" />
          <ellipse cx="32" cy="40" rx="16" ry="4" fill="#D8A566" />
        </svg>
      );
    case "SQUASH":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#1A1A1A" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#333" strokeWidth="2" />
          <circle cx="32" cy="24" r="4" fill="#D8FF3E" />
        </svg>
      );
    case "BORDTENNIS":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="21" fill="#FF7A1A" />
          <path d="M18 22 a24 24 0 0 1 22 -8" fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.55" strokeLinecap="round" />
        </svg>
      );
    case "PICKLEBALL":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#F2E32E" />
          {[
            [24, 24], [40, 24], [32, 32], [22, 38], [42, 38], [32, 16], [32, 48],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3.2" fill="#0F2138" opacity="0.75" />
          ))}
        </svg>
      );
    case "PADEL":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#B9E24A" />
          <path d="M15 26 a26 26 0 0 1 26 -12" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M49 38 a26 26 0 0 1 -26 12" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    default: // TENNIS
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#D8FF3E" />
          <path d="M15 26 a26 26 0 0 1 26 -12" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M49 38 a26 26 0 0 1 -26 12" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
  }
}
