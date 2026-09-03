// Anmodninger, træneren skal svare på.
//
// Ligger på trænerens egen profilside, fordi det er den side, de alligevel
// åbner. En separat side ville betyde, at en anmodning kunne ligge ubesvaret
// i en uge, fordi ingen vidste, den var der.
//
// Der er ingen "senere"-knap. Et ja eller et nej er begge et svar; en
// anmodning, der bare ligger, spærrer tiden for alle andre.
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { approveCoachBooking, declineCoachBooking } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";
import { describeLength } from "../lib/slots";

type Request = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  priceKr: number;
  user: { name: string; level: number; area: string | null };
};

export function CoachRequests({
  requests,
  credits,
}: {
  requests: Request[];
  credits: Map<string, number>;
}) {
  if (requests.length === 0) return null;

  return (
    <section className="card border-2 border-court/30">
      <h2 className="display text-2xl">
        {requests.length === 1
          ? "1 anmodning venter på dig"
          : `${requests.length} anmodninger venter på dig`}
      </h2>
      <p className="mt-1 text-sm text-slate">
        Tiden er spærret, indtil du svarer. Der er ikke trukket penge endnu —
        siger du nej, sker der ingenting.
      </p>

      <ul className="mt-4 space-y-3">
        {requests.map((r) => {
          const minutes = Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60000);
          const credit = credits.get(r.id) ?? 0;

          return (
            <li key={r.id} className="rounded-xl border border-slate/15 p-4">
              <p className="font-bold">
                {format(r.startsAt, "EEEE d. MMMM 'kl.' HH:mm", { locale: da })}
              </p>
              <p className="mt-0.5 text-sm text-slate">
                {r.user.name} · niveau {r.user.level}
                {r.user.area ? ` · ${r.user.area}` : ""} · {describeLength(minutes)}
              </p>
              <p className="mt-1 text-sm">
                {credit > 0 ? (
                  <span className="font-semibold text-court">
                    Betales med klip fra pakkeforløb ({credit} tilbage)
                  </span>
                ) : (
                  <span className="font-semibold">{r.priceKr} kr</span>
                )}
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                <form action={approveCoachBooking}>
                  <input type="hidden" name="bookingId" value={r.id} />
                  <SubmitButton pendingText="Godkender…">Godkend</SubmitButton>
                </form>
                <form action={declineCoachBooking}>
                  <input type="hidden" name="bookingId" value={r.id} />
                  <SubmitButton className="btn-ghost" pendingText="Afviser…">
                    Kan ikke
                  </SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
