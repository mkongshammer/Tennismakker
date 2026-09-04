// Fast bane — datoregningen.
//
// Uden importer, så den kan afprøves. Det er den del, der kan gå galt uden
// at nogen ser det: en sæson der mangler den sidste uge, eller får en for
// meget.
//
// Samme bane, samme ugedag, samme klokkeslæt, hele sæsonen. Reglen står i
// FixedSlot; de enkelte timer oprettes som almindelige Booking-rækker.
//
// Hvorfor rigtige rækker frem for at regne dem ud, hver gang nogen ser på
// kalenderen: så virker ledighed, aflysning, kvitteringer, dørkoder og
// klubbens overblik uændret. Der er én slags booking i resten af systemet,
// og det er den, alt andet allerede kan håndtere. En "virtuel" booking
// ville skulle indarbejdes i hvert eneste opslag — og glemmes i ét af dem.

export type FixedSlotInput = {
  courtId: string;
  userId: string;
  dayOfWeek: number;
  hour: number;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  note?: string | null;
};

/** Alle datoer i perioden, der falder på den ugedag. */
export function occurrences(from: Date, to: Date, dayOfWeek: number, hour: number): Date[] {
  const out: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(hour, 0, 0, 0);

  // Frem til den første forekomst af ugedagen.
  while (cursor.getDay() !== dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

