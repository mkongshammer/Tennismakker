// Login i to trin for superadmins.
//
// Adgangskoden alene er ikke nok til den konto, der kan se og ændre alt.
// Den kan lækkes fra et andet site, gættes eller kigges over skulderen. Et
// andet trin, der kræver adgang til selve postkassen, gør det svært at
// bruge en stjålet adgangskode alene.
//
// Nogle valg, der er værd at kende:
//
// - Koden gemmes hashet. Et udtræk af databasen skal ikke give adgang.
// - Fem forsøg, så er udfordringen død. Uden det kan seks cifre gættes.
// - Ti minutter. Længe nok til at finde mailen, kort nok til at en kode,
//   der bliver liggende i en indbakke, ikke er en nøgle for evigt.
// - Rækken slettes i samme øjeblik, koden er brugt. En kode, der stadig
//   ligger i databasen efter brug, er en kode, der kan bruges igen.
//
// Risikoen ved det her er reel og værd at sige højt: virker afsendelsen af
// e-mail ikke, kan ingen superadmin logge ind. Derfor tjekker selvtesten
// e-mail hver gang, den køres.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sendMail, loginCode } from "./email";

const CODE_LENGTH = 6;
const LIFETIME_MINUTES = 10;
const MAX_ATTEMPTS = 5;

/** Seks cifre, trukket med en generator der er beregnet til hemmeligheder. */
function newCode(): string {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** Skal denne bruger igennem to trin? */
export function needsEmailCode(user: { role: string }): boolean {
  return user.role === "SUPERADMIN";
}

/**
 * Starter et login i to trin: laver koden, sender den, og returnerer id'et
 * på udfordringen. Id'et er ikke en hemmelighed — koden er.
 */
export async function startEmailChallenge(user: {
  id: string;
  email: string;
  name: string;
}): Promise<string> {
  // Gamle udfordringer for samme bruger ryddes, så en tidligere mail ikke
  // kan bruges efter en ny er sendt.
  await db.loginChallenge.deleteMany({ where: { userId: user.id } });

  const code = newCode();
  const challenge = await db.loginChallenge.create({
    data: {
      userId: user.id,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + LIFETIME_MINUTES * 60 * 1000),
    },
  });

  await sendMail(
    loginCode({ to: user.email, name: user.name, code, minutes: LIFETIME_MINUTES })
  );

  return challenge.id;
}

export type ChallengeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "udloebet" | "forkert" | "opbrugt" };

/**
 * Tjekker en indtastet kode.
 *
 * Samme svar til "udfordringen findes ikke" og "koden er udløbet": der er
 * ingen grund til at fortælle nogen, hvilken af delene der gik galt.
 */
export async function verifyEmailChallenge(
  challengeId: string,
  code: string
): Promise<ChallengeResult> {
  const challenge = await db.loginChallenge.findUnique({ where: { id: challengeId } });

  if (!challenge || challenge.expiresAt < new Date()) {
    if (challenge) await db.loginChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, reason: "udloebet" };
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await db.loginChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, reason: "opbrugt" };
  }

  if (!(await bcrypt.compare(code.trim(), challenge.codeHash))) {
    await db.loginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "forkert" };
  }

  await db.loginChallenge.delete({ where: { id: challenge.id } });
  return { ok: true, userId: challenge.userId };
}

/**
 * En adgangskode, et menneske kan skrive af fra en skærm, men som ikke kan
 * gættes: fire grupper à fire tegn fra et alfabet uden de bogstaver, der
 * ligner hinanden (0/O, 1/l/I). Omkring 80 bits — rigeligt.
 */
export function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}
