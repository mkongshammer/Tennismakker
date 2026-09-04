// "Book samme time igen".
//
// Det her er ikke en bekvemmelighed, det er forretning. En elev og en
// træner, der aftaler næste time på banen og afregner med MobilePay,
// forsvinder ud af platformen — og det kan man ikke forhindre, kun gøre
// mindre attraktivt end alternativet.
//
// Derfor står knappen dér, hvor eleven i forvejen står med telefonen i
// hånden: på profilen, lige efter timen er overstået. Ét tryk mod at finde
// trænerens nummer, skrive, aftale og overføre.
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { rebookLessonNextWeek } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";
import { describeLength } from "../lib/slots";

type Lesson = {
  bookingId: string;
  coachName: string;
  startsAt: Date;
  minutes: number;
};

export function RepeatLessons({
  lessons,
  labels,
}: {
  lessons: Lesson[];
  labels: { title: string; button: string; note: string };
}) {
  if (lessons.length === 0) return null;

  return (
    <section>
      <h2 className="display mb-1 text-2xl">{labels.title}</h2>
      <p className="mb-3 text-sm text-slate">{labels.note}</p>

      <ul className="space-y-3">
        {lessons.map((l) => (
          <li key={l.bookingId} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">{l.coachName}</p>
              <p className="text-sm text-slate">
                {format(l.startsAt, "EEEE 'kl.' HH:mm", { locale: da })} ·{" "}
                {describeLength(l.minutes)}
              </p>
            </div>
            <form action={rebookLessonNextWeek}>
              <input type="hidden" name="bookingId" value={l.bookingId} />
              <SubmitButton pendingText="Sender…">{labels.button}</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
