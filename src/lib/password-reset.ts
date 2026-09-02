// Glemt adgangskode.
//
// Linket i mailen er beviset: kan man læse postkassen, må man gerne sætte en
// ny adgangskode. Det er den samme antagelse, login i to trin hviler på, så
// der er ikke noget at vinde ved at kræve begge dele.
//
// Valgene:
//
// - Tokenet er 32 tilfældige bytes. Der er intet at gætte, og derfor er en
//   hurtig hash nok — bcrypt kan ikke slås op på.
// - En time. Længe nok til at nå at åbne mailen, kort nok til at et link,
//   der bliver liggende i en indbakke, ikke er en nøgle for evigt.
// - Alle brugerens andre nulstillinger slettes, når én bruges eller laves.
//   To gyldige links ad gangen er ét for meget.
// - Samme svar uanset om mailen findes. Ellers har man givet en liste over,
//   hvem der har en konto.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sendMail, passwordResetLink } from "./email";
import { getSettings } from "./settings";

const LIFETIME_MINUTES = 60;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Sender et nulstillingslink, hvis kontoen findes.
 *
 * Returnerer altid uden at sige noget om, hvorvidt den gjorde.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return;

  await db.passwordReset.deleteMany({ where: { userId: user.id } });

  const token = crypto.randomBytes(32).toString("base64url");
  await db.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + LIFETIME_MINUTES * 60 * 1000),
    },
  });

  const { appUrl } = await getSettings();
  await sendMail(
    passwordResetLink({
      to: user.email,
      name: user.name,
      url: `${appUrl}/login/nulstil?token=${token}`,
      minutes: LIFETIME_MINUTES,
    })
  );
}

export type ResetResult = { ok: true } | { ok: false; reason: "ugyldig" | "kort" };

/** Sætter en ny adgangskode, hvis tokenet holder. */
export async function completePasswordReset(
  token: string,
  password: string
): Promise<ResetResult> {
  if (password.length < 10) return { ok: false, reason: "kort" };

  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hash(token) } });
  if (!reset || reset.expiresAt < new Date()) {
    if (reset) await db.passwordReset.delete({ where: { id: reset.id } });
    return { ok: false, reason: "ugyldig" };
  }

  await db.user.update({
    where: { id: reset.userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  // Alt der lå og ventede på den gamle adgangskode ryddes med det samme.
  await db.passwordReset.deleteMany({ where: { userId: reset.userId } });
  await db.loginChallenge.deleteMany({ where: { userId: reset.userId } });

  return { ok: true };
}
