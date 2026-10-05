
import {UiText} from "./InternationalProvider";
// Anmodninger, træneren skal svare på.
//
// Ligger på trænerens egen profilside, fordi det er den side, de alligevel
// åbner. En separat side ville betyde, at en anmodning kunne ligge ubesvaret
// i en uge, fordi ingen vidste, den var der.
//
// Der er ingen "senere"-knap. Et ja eller et nej er begge et svar; en
// anmodning, der bare ligger, spærrer tiden for alle andre.
import {getPreferences} from "../lib/preferences";
import {formatDate,formatMoney,marketFor} from "../lib/international";
import {phrase} from "../lib/phrases";

import { approveCoachBooking, declineCoachBooking } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";
import { describeLength } from "../lib/slots";

type Request = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  priceKr: number;
  currency: string;
  timeZone: string;
  user: { name: string; level: number; area: string | null };
};

export async function CoachRequests({
  requests,
  credits,
}: {
  requests: Request[];
  credits: Map<string, number>;
}) {
  const {locale}=await getPreferences();
  if (requests.length === 0) return null;

  return (
    <section className="card border-2 border-court/30">
      <h2 className="display text-2xl">
        {requests.length === 1
          ? <UiText text="1 anmodning venter på dig"/>
          : phrase("{count} anmodninger venter på dig",locale,{count:requests.length})}
      </h2>
      <p className="mt-1 text-sm text-slate"><UiText text="Tiden er spærret, indtil du svarer. Der er ikke trukket penge endnu — siger du nej, sker der ingenting."/></p>

      <ul className="mt-4 space-y-3">
        {requests.map((r) => {
          const minutes = Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60000);
          const credit = credits.get(r.id) ?? 0;

          return (
            <li key={r.id} className="rounded-xl border border-slate/15 p-4">
              <p className="font-bold">
                {formatDate(r.startsAt,locale,r.timeZone,{dateStyle:"long",timeStyle:"short"})}
              </p>
              <p className="mt-0.5 text-sm text-slate">
                {r.user.name}{" "}<UiText text="· niveau"/>{" "}{r.user.level}
                {r.user.area ? ` · ${r.user.area}` : ""} · {describeLength(minutes,locale)}
              </p>
              <p className="mt-1 text-sm">
                {credit > 0 ? (
                  <span className="font-semibold text-court"><UiText text="Betales med klip fra pakkeforløb ("/>{credit}{" "}<UiText text="tilbage)"/></span>
                ) : (
                  <span className="font-semibold">{formatMoney(r.priceKr,r.currency,locale)}</span>
                )}
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                <form action={approveCoachBooking}>
                  <input type="hidden" name="bookingId" value={r.id} />
                  <SubmitButton pendingText="Godkender…"><UiText text="Godkend"/></SubmitButton>
                </form>
                <form action={declineCoachBooking}>
                  <input type="hidden" name="bookingId" value={r.id} />
                  <SubmitButton className="btn-ghost" pendingText="Afviser…"><UiText text="Kan ikke"/></SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
