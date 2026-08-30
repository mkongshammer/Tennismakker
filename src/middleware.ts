import { NextResponse, type NextRequest } from "next/server";

// Egne domæner.
//
// Ligger klubbens side på soendermarktennis.dk, skal værtsnavnet afgøre,
// hvilken klub der vises. Middleware kan ikke slå op i databasen (den
// kører på edge), så den sender bare værtsnavnet videre som en sti, og
// siden slår klubben op.
//
// Vores egne værtsnavne skal naturligvis fortsætte som normalt.

const OWN_HOSTS = [
  "localhost",
  "127.0.0.1",
  "racketbuddy.dk",
  "www.racketbuddy.dk",
  "tennis-makker.onrender.com",
];

function isOwnHost(host: string): boolean {
  const clean = host.split(":")[0].toLowerCase();
  return (
    OWN_HOSTS.includes(clean) ||
    clean.endsWith(".onrender.com") ||
    clean.endsWith(".vercel.app")
  );
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (isOwnHost(host)) return NextResponse.next();

  const clean = host.split(":")[0].toLowerCase();
  const url = req.nextUrl.clone();

  // Klubbens egen side serveres fra roden af deres domæne. Alt andet —
  // login, betaling, beskeder — kører videre på vores eget domæne, så vi
  // ikke skal håndtere sessioner på tværs af mange domæner.
  if (url.pathname === "/") {
    url.pathname = `/domaene/${clean}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Statiske filer og API skal ikke igennem
  matcher: ["/((?!api|_next|app|favicon.ico).*)"],
};
