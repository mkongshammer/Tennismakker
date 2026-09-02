// Bolden for hver sport, tegnet frem for fotograferet.
//
// Et foto kræver rettigheder, vejer hundrede gange mere, og seks fotos ved
// siden af hinanden ligner seks tilfældige billeder frem for ét sæt. Tegnede
// bolde deler stregtykkelse og størrelse, så rækken hænger sammen.
//
// Farverne og formerne er til gengæld de rigtige: en squashbold ER sort med
// en lille farveprik, en fjerbold har korken NEDERST og fjerene bredende sig
// opad, og en pickleball er perforeret. Det er præcis dét, man genkender —
// og en fjerbold på hovedet ser forkert ud, længe før man kan sige hvorfor.
export function Ball({ sport, size = 56 }: { sport: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 64 64", "aria-hidden": true as const };

  switch (sport) {
    case "BADMINTON":
      return (
        <svg {...common}>
          <path
            d="M25 44 L13 12 h38 L39 44 z"
            fill="#FCFCFA"
            stroke="#C4CEDB"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <g stroke="#C4CEDB" strokeWidth="1.4">
            <path d="M32 13 V44" />
            <path d="M22.5 13 L26.5 44" />
            <path d="M41.5 13 L37.5 44" />
            <path d="M17 24 H47" />
          </g>
          <path d="M24 44 h16 a8 9 0 0 1 -16 0" fill="#E8C68F" stroke="#C9A468" strokeWidth="1.4" />
          <path d="M24 44 h16" stroke="#C9A468" strokeWidth="1.6" />
        </svg>
      );

    case "SQUASH":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#1C1C20" />
          <circle cx="32" cy="32" r="3.4" fill="#D8FF3E" />
        </svg>
      );

    case "BORDTENNIS":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#FDFDFD" stroke="#C4CEDB" strokeWidth="1.8" />
          <path
            d="M18 24 a20 20 0 0 1 14 -9"
            fill="none"
            stroke="#E4EAF1"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case "PICKLEBALL":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#EFE43B" stroke="#C9BE22" strokeWidth="1.5" />
          <g fill="#B9AE1C">
            <circle cx="32" cy="19" r="3" />
            <circle cx="21" cy="26" r="3" />
            <circle cx="43" cy="26" r="3" />
            <circle cx="32" cy="33" r="3.2" />
            <circle cx="21" cy="41" r="2.8" />
            <circle cx="43" cy="41" r="2.8" />
            <circle cx="32" cy="47" r="2.6" />
          </g>
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
