// Vejen ind, første gang.
//
// Hønen og ægget: superadmin-konti oprettes af en superadmin, og login i to
// trin sender koden til kontoens egen mail. Er den eneste superadmin en
// demo-konto på en adresse, ingen kan læse, findes der ingen vej ind.
//
// Siden her er den vej, og den er lukket som udgangspunkt. Den virker kun,
// når BOOTSTRAP_TOKEN er sat i miljøet, og kun med præcis det token. Kun
// den, der kan sætte miljøvariabler på serveren, kan altså bruge den — og
// det er allerede den samme person, der kunne læse databasen.
//
// Slet variablen igen, når kontoen er oprettet. Så er døren muret til.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../../../lib/db";
import { generatePassword } from "../../../lib/twofactor";

export const dynamic = "force-dynamic";

/** Sammenligning der tager lige lang tid uanset hvor tokenet er forkert. */
function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function BootstrapPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  const expected = process.env.BOOTSTRAP_TOKEN;

  // Uden variablen findes siden reelt ikke. Samme svar som ved forkert
  // token, så ingen kan aflæse, om der overhovedet er en dør her.
  if (!expected || !searchParams.token || !sameToken(searchParams.token, expected)) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">Ikke fundet</p>
      </div>
    );
  }

  const email = (searchParams.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return (
      <div className="card mx-auto max-w-md">
        <p className="font-bold">Tilføj en adresse</p>
        <p className="mt-2 text-sm text-slate">
          Sæt <code className="font-data text-xs">&amp;email=din@adresse.dk</code> på
          adressen i browseren. Kontoen oprettes for netop den mail.
        </p>
      </div>
    );
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { role: "SUPERADMIN", passwordHash },
    });
  } else {
    await db.user.create({
      data: {
        email,
        name: "RacketBuddy",
        role: "SUPERADMIN",
        passwordHash,
        level: 3,
        countryChosen: true,
      },
    });
  }

  return (
    <div className="card mx-auto max-w-md">
      <p className="display text-2xl">Kontoen er klar</p>
      <p className="mt-2 text-sm text-slate">{email}</p>

      <p className="mt-4 text-xs font-bold text-slate">Adgangskode</p>
      <p className="select-all font-data text-lg tracking-wide">{password}</p>

      <p className="mt-4 text-sm text-court-dark">
        Gem den i en adgangskodemanager nu. Genindlæser du siden, laves en ny
        adgangskode, og den her holder op med at virke.
      </p>
      <p className="mt-3 text-sm text-slate">
        Slet derefter <code className="font-data text-xs">BOOTSTRAP_TOKEN</code> på
        Render. Så kan siden her ikke bruges af nogen.
      </p>
    </div>
  );
}
