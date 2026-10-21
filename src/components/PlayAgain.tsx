
import {getPreferences} from "../lib/preferences";
import {formatDate,marketFor} from "../lib/international";
import {UiText} from "./InternationalProvider";
import { rebookNextWeek } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";

// "Spil igen": gentag en tid, man allerede har spillet.

const DAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

export type Repeatable = {
  bookingId: string;
  what: string;
  startsAt: Date;
  withName: string | null;
};

export async function PlayAgain({ items }: { items: Repeatable[] }) {
  const {locale,country}=await getPreferences();
  const zone=marketFor(country)!.timeZone;
  return (
    <>
      {items.length > 0 && (
        <section>
          <h2 className="display mb-1 text-2xl"><UiText text="Spil igen"/></h2>
          <p className="mb-4 text-sm text-slate"><UiText text="Samme bane, samme tid, næste uge."/></p>

          <ul className="space-y-3">
            {items.map((item) => {
              const day = formatDate(item.startsAt,locale,zone,{weekday:"long"});
              const time = formatDate(item.startsAt,locale,zone,{hour:"numeric",minute:"2-digit"});

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
                      <p className="mt-1 text-sm text-slate"><UiText text="Sidst med"/>{" "}{item.withName}</p>
                    )}
                  </div>
                  <form action={rebookNextWeek}>
                    <input type="hidden" name="bookingId" value={item.bookingId} />
                    <SubmitButton pendingText="Åbner betaling…"><UiText text="Book næste"/>{" "}{day}</SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
