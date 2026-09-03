// Mærket: to ketsjere, der læner mod hinanden. En hvid og en boldgul.
//
// Ketsjeren alene sagde kun "ketsjersport". To siger "dig og en makker",
// og det er den halvdel af produktet, ingen gætter sig til — baner kan man
// booke mange steder, men det er makkeren, der er svær at finde.
//
// Samme tegning som favicon, app-ikon og splash. Skal den ændres, ændres
// src/app/icon.svg, og resten genskabes derfra.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" className="shrink-0">
        <rect width="512" height="512" rx="116" fill="#0F2138"/>
        <g transform="rotate(-20 168 236)">
          <rect x="152" y="300" width="32" height="132" rx="16" fill="#FFFFFF"/>
          <ellipse cx="168" cy="216" rx="78" ry="94" fill="#0F2138"/>
          <g stroke="#FFFFFF" strokeWidth="7" opacity="0.28">
            <path d="M168 128 V304"/><path d="M128 140 V292"/><path d="M208 140 V292"/>
            <path d="M94 216 H242"/><path d="M102 176 H234"/><path d="M102 256 H234"/>
          </g>
          <ellipse cx="168" cy="216" rx="78" ry="94" fill="none" stroke="#FFFFFF" strokeWidth="24"/>
        </g>
      
        <g transform="rotate(20 344 236)">
          <rect x="328" y="300" width="32" height="132" rx="16" fill="#D8FF3E"/>
          <ellipse cx="344" cy="216" rx="78" ry="94" fill="#0F2138"/>
          <g stroke="#D8FF3E" strokeWidth="7" opacity="0.26">
            <path d="M344 128 V304"/><path d="M304 140 V292"/><path d="M384 140 V292"/>
            <path d="M270 216 H418"/><path d="M278 176 H410"/><path d="M278 256 H410"/>
          </g>
          <ellipse cx="344" cy="216" rx="78" ry="94" fill="none" stroke="#D8FF3E" strokeWidth="24"/>
        </g>
    </svg>
  );
}
