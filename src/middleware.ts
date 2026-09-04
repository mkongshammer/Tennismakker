import { NextResponse, type NextRequest } from "next/server";

// Egne domæner.
//
// Ligger klubbens side på soendermarktennis.dk, skal værtsnavnet afgøre,
// hvilken klub der vises. Middleware kan ikke slå op i databasen (den
// kører på edge), så den sender bare værtsnavnet videre som en sti, og
// siden slår klubben op.
//
// Vores egne værtsnavne skal naturligvis fortsætte som normalt.

import { isOwnHost } from "./lib/hosts";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (isOwnHost(host)) return NextResponse.next();

  const clean = host.split(":")[0].toLowerCase();
  const url = req.nextUrl.clone();

  // Klubbens egen side serveres fra roden af deres domæne.
  if (url.pathname === "/") {
    url.pathname = `/domaene/${clean}`;
    return NextResponse.rewrite(url);
  }

  // Alt andet — login, betaling, beskeder, profiler — hører på vores eget
  // domæne. To grunde: sessionscookien skal ikke findes i tyve varianter,
  // og Stripes returadresser peger på appUrl uanset hvor man kom fra.
  //
  // Uden denne omdirigering ville en klubs domæne kunne vise hele
  // RacketBuddy — inklusive andre klubbers sider — hvilket er forvirrende
  // for den besøgende og noget rod for søgemaskiner.
  const own = new URL(req.url);
  own.host = "racketbuddy.app";
  own.protocol = "https:";
  own.port = "";
  return NextResponse.redirect(own, 308);
}

export const config = {
  // Statiske filer og API skal ikke igennem
  matcher: ["/((?!api|_next|app|favicon.ico).*)"],
};
