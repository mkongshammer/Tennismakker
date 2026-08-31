import { rebookNextWeek } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";

// "Spil igen": gentag en tid, man allerede har spillet.
//
// Det er den vigtigste knap i appen. En bane bookes sjældent én gang —
// den bookes hver tirsdag kl. 18. At gøre gentagelsen til ét tryk er
// langt stærkere end at presse folk til den første booking.

const DAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

export type Repeatable = {
  bookingId: string;
  what: string;
  startsAt: Date;
  withName: string | null;
};

export function PlayAgain({ items }: { items: Repeatable[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="display mb-1 text-2xl">Spil igen</h2>
      <p className="mb-4 text-sm text-slate">
        Samme bane, samme tid, næste uge.
      </p>

      <ul className="space-y-3">
        {items.map((item) => {
          const day = DAYS[item.startsAt.getDay()];
          const time = `${String(item.startsAt.getHours()).padStart(2, "0")}:${String(
            item.startsAt.getMinutes()
          ).padStart(2, "0")}`;

          return (
            <li
              key={item.bookingId}
              className="card flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-bold">{item.what}</p>
                <p className="data mt-1 text-sm text-slate">
                  {day} {time}
                </p>
                {item.withName && (
                  <p className="mt-1 text-sm text-slate">Sidst med {item.withName}</p>
                )}
              </div>
              <form action={rebookNextWeek}>
                <input type="hidden" name="bookingId" value={item.bookingId} />
                <SubmitButton pendingText="Åbner betaling…">Book næste {day}</SubmitButton>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
