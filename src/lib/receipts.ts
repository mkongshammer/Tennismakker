// Kvitteringer og fakturaer.
//
// Ingen ny tabel. Alt er betalt i forvejen og står i Payment, Membership,
// TeamSignup, PackagePurchase og ClubPunchPurchase — en fakturatabel ved
// siden af ville være en kopi, der kunne komme til at sige noget andet end
// betalingen selv.
//
// Det er også derfor, der ikke er et fakturanummer: nummeret skulle være
// fortløbende pr. klub for at være en rigtig faktura, og det er en
// bogføringsforpligtelse, klubben har over for SKAT — ikke en, vi kan
// påtage os på deres vegne. Det her er kvitteringer, og de hedder det.

import {formatDate} from "./international";
import { db } from "./db";

export type Receipt = {
  id: string;
  date: Date;
  kind: "Banebooking" | "Trænertime" | "Kontingent" | "Sæsonhold" | "Klippekort" | "Pakkeforløb";
  description: string;
  clubOrCoach: string;
  amountKr: number;
  currency:string;
};

/** Alt, personen har betalt hos os, nyeste først. */
export async function receiptsFor(userId: string,locale="da"): Promise<Receipt[]> {
  const [payments, memberships, signups, punches, packages] = await Promise.all([
    db.payment.findMany({
      where: { status: "PAID", booking: { userId } },
      include: {
        booking: {
          include: {
            court: { include: { club: { select: { name: true } } } },
            coachProfile: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.membership.findMany({
      where: { userId, status: "PAID" },
      include: { type: { include: { club: { select: { name: true } } } } },
    }),
    db.teamSignup.findMany({
      where: { userId, status: "PAID" },
      include: { team: { include: { club: { select: { name: true } } } } },
    }),
    db.clubPunchPurchase.findMany({ where: { userId, status: "PAID" } }),
    db.packagePurchase.findMany({
      where: { userId, status: "PAID" },
      include: { coachProfile: { include: { user: { select: { name: true } } } } },
    }),
  ]);

  const out: Receipt[] = [];

  for (const p of payments as any[]) {
    const isCoach = p.booking.kind === "COACH";
    out.push({
      id: p.id,
      date: p.createdAt,
      kind: isCoach ? "Trænertime" : "Banebooking",
      description: formatDate(p.booking.startsAt,locale,p.booking.timeZone,{dateStyle:"long",timeStyle:"short"}),
      clubOrCoach: isCoach
        ? (p.booking.coachProfile?.user.name ?? "Træner")
        : (p.booking.court?.club.name ?? "Klub"),
      amountKr: p.amountKr,currency:p.currency,
    });
  }

  for (const m of memberships as any[]) {
    out.push({
      id: m.id,
      date: m.paidAt ?? m.createdAt,
      kind: "Kontingent",
      description: `${m.type.name} — ${m.type.seasonName}`,
      clubOrCoach: m.type.club.name,
      amountKr: m.priceKr,currency:m.currency,
    });
  }

  for (const s of signups as any[]) {
    out.push({
      id: s.id,
      date: s.paidAt ?? s.createdAt,
      kind: "Sæsonhold",
      description: s.team.name,
      clubOrCoach: s.team.club.name,
      amountKr: s.priceKr,currency:s.currency,
    });
  }

  for (const p of punches as any[]) {
    out.push({
      id: p.id,
      date: p.createdAt,
      kind: "Klippekort",
      description: `${p.name} — ${p.sessions} timer`,
      clubOrCoach: "Klubben",
      amountKr: p.priceKr,currency:p.currency,
    });
  }

  for (const p of packages as any[]) {
    out.push({
      id: p.id,
      date: p.createdAt,
      kind: "Pakkeforløb",
      description: `${p.name} — ${p.sessions} timer`,
      clubOrCoach: p.coachProfile.user.name,
      amountKr: p.priceKr,currency:p.currency,
    });
  }

  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}
