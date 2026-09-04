// Fast bane — den del, der skriver i databasen.
//
// Datoregningen ligger i fixed-slots-core.ts uden importer, så den kan
// afprøves. Reglen står i FixedSlot; de enkelte timer oprettes som
// almindelige Booking-rækker.
//
// Hvorfor rigtige rækker frem for at regne dem ud, hver gang nogen ser på
// kalenderen: så virker ledighed, aflysning, kvitteringer, dørkoder og
// klubbens overblik uændret. Der er én slags booking i resten af systemet.
// En "virtuel" booking ville skulle indarbejdes i hvert eneste opslag — og
// glemmes i ét af dem.

import { db } from "./db";
import { occurrences, type FixedSlotInput } from "./fixed-slots-core";

export * from "./fixed-slots-core";

export type CreateResult = {
  created: number;
  /** Tider der ikke kunne oprettes, fordi der allerede lå noget. */
  clashes: Date[];
};

/**
 * Opretter reglen og sæsonens bookinger.
 *
 * Ligger der allerede en booking på en af tiderne, springes netop den over
 * og rapporteres tilbage. Alternativet — at afvise hele sæsonen, fordi én
 * uge er optaget — ville betyde, at en klub ikke kunne tildele en fast bane,
 * hvis nogen tilfældigvis havde booket en enkelt tid i forvejen.
 *
 * Timer, der er passeret, oprettes ikke. Man kan tildele en fast bane midt
 * i en sæson.
 */
export async function createFixedSlot(input: FixedSlotInput): Promise<CreateResult> {
  const court = await db.court.findUnique({ where: { id: input.courtId } });
  if (!court) throw new Error("Banen findes ikke.");

  const slot = await db.fixedSlot.create({
    data: {
      courtId: input.courtId,
      userId: input.userId,
      dayOfWeek: input.dayOfWeek,
      hour: input.hour,
      fromDate: input.fromDate,
      toDate: input.toDate,
      priceKr: input.priceKr,
      note: input.note ?? null,
    },
  });

  const now = new Date();
  const times = occurrences(input.fromDate, input.toDate, input.dayOfWeek, input.hour).filter(
    (t) => t > now
  );

  const clashes: Date[] = [];
  let created = 0;

  for (const startsAt of times) {
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const taken = await db.booking.findFirst({
      where: {
        courtId: input.courtId,
        status: { in: ["HOLD", "CONFIRMED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });

    if (taken) {
      clashes.push(startsAt);
      continue;
    }

    await db.booking.create({
      data: {
        kind: "COURT",
        // Bekræftet med det samme. En fast bane er tildelt, ikke reserveret
        // — der er ingen betaling at vente på, når prisen er nul.
        status: "CONFIRMED",
        startsAt,
        endsAt,
        priceKr: input.priceKr,
        userId: input.userId,
        courtId: input.courtId,
        fixedSlotId: slot.id,
      },
    });
    created++;
  }

  return { created, clashes };
}

/**
 * Fjerner reglen og de kommende timer.
 *
 * Timer der er spillet bliver stående. De er historie, og en klub skal
 * kunne se, hvem der har brugt banen — også efter at den faste bane er
 * ophørt.
 */
export async function removeFixedSlot(id: string): Promise<number> {
  const { count } = await db.booking.deleteMany({
    where: { fixedSlotId: id, startsAt: { gt: new Date() } },
  });
  await db.fixedSlot.deleteMany({ where: { id } });
  return count;
}
