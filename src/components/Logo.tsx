// Mærket: en ketsjer med bolden i midten af strengene.
//
// Tre former i alt — ring, bold, skaft. De to tidligere forsøg havde
// strengegitter og to ketsjere, og begge dele blev til grød under 64 px.
// Et app-ikon skal tegnes for den mindste størrelse, det skal overleve.
//
// Hovedet er ovalt og ikke rundt. En cirkel med et skaft ligner et
// forstørrelsesglas; en oval ligner en ketsjer.
//
// Samme tegning som favicon, app-ikon og splash. Skal den ændres, ændres
// src/app/icon.svg, og resten genskabes derfra.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" className="shrink-0">
      <rect width="512" height="512" rx="116" fill="#0F2138" />
      <g transform="rotate(-14 256 236)">
        <rect x="236" y="332" width="40" height="126" rx="20" fill="#FFFFFF" />
        <ellipse cx="256" cy="222" rx="120" ry="140" fill="none" stroke="#FFFFFF" strokeWidth="40" />
        <circle cx="256" cy="222" r="62" fill="#D8FF3E" />
      </g>
    </svg>
  );
}
