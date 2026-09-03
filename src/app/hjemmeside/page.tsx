// Salgsside for den betalte hjemmesideydelse.
//
// Målgruppen er en frivillig bestyrelse, der ikke har en webansvarlig og
// ikke vil have et projekt. Derfor: fast pris, kort liste over hvad de
// får, og hvad vi skal bruge fra dem.
import { OrderForm } from "./OrderForm";

export const metadata = {
  title: "Hjemmeside til klubben — RacketBuddy",
  description:
    "En færdig klubhjemmeside med banebooking og betaling, på jeres eget domæne. Fast pris for opsætning.",
};

const INCLUDED = [
  "Hjemmeside på jeres eget domæne",
  "Banebooking og betaling indbygget",
  "Medlemspris og gæstepris",
  "Nyheder I selv skriver",
  "Kontakt, praktisk info og vejviser",
  "Virker på telefon",
];

const NEEDED = [
  "Jeres logo og klubfarve, hvis I har",
  "Adgang til jeres domæne, eller hjælp til at købe et",
  "Baner, priser og åbningstider",
  "En kontaktperson vi kan ringe til",
];

export default function HjemmesidePage() {
  return (
    <div className="space-y-14">
      <section className="rounded-2xl bg-ink px-6 py-12 text-chalk sm:px-10 sm:py-16">
        <p className="eyebrow text-chalk/90">Til klubber</p>
        <h1 className="display mt-2 max-w-2xl text-3xl sm:text-5xl">
          En hjemmeside klubben ikke skal passe
        </h1>
        <p className="mt-4 max-w-xl text-chalk/85">
          Vi bygger den, sætter jeres domæne op og fylder den med jeres
          indhold. Bagefter skriver I nyheder i et almindeligt tekstfelt, og
          banebooking og betaling kører af sig selv.
        </p>
        <p className="data mt-8 text-5xl font-bold">5.000 kr</p>
        <p className="mt-1 text-chalk/70">
          engangsbeløb for opsætning · derefter jeres almindelige aftale
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="card">
          <h2 className="display text-xl">Det får I</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-court">—</span>
                {i}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="display text-xl">Det skal vi bruge fra jer</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {NEEDED.map((i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-court">—</span>
                {i}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Sådan foregår det</h2>
        <p className="mb-5 text-sm text-slate">
          Fra bestilling til færdig side går der typisk to uger. Det meste af
          tiden går med at vente på jeres tekst og på domænet.
        </p>
        <ol className="space-y-3">
          {[
            ["Vi ringer", "Vi taler om hvad klubben har brug for, og hvad I allerede har."],
            ["Vi bygger", "I får et udkast at se på, med jeres farver og indhold."],
            ["Vi sætter domænet op", "Vi ordner det tekniske. I skal højst godkende en mail."],
            ["I overtager", "Siden er jeres. Nyheder og priser retter I selv."],
          ].map(([title, body], i) => (
            <li key={title} className="card flex gap-4">
              <span className="data shrink-0 text-2xl font-bold text-court">{i + 1}</span>
              <span>
                <span className="block font-bold">{title}</span>
                <span className="block text-sm text-slate">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Bestil eller spørg</h2>
        <p className="mb-5 text-sm text-slate">
          Udfyld felterne, så ringer vi. Det forpligter jer ikke til noget.
        </p>
        <OrderForm />
      </section>
    </div>
  );
}
