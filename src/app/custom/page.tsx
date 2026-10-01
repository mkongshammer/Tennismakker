import { CustomMeetingForm } from "./CustomMeetingForm";
import { getPreferences } from "../../lib/preferences";
import { phrase } from "../../lib/phrases";

export async function generateMetadata() {
  const {locale} = await getPreferences();
  return {title: phrase('Custom løsninger til klubber', locale) + ' — RacketBuddy', description: phrase('Få bygget en skræddersyet løsning til jeres klub: booking, hjemmeside, lysstyring, adgangskontrol, betaling og integrationer.', locale)};
}

const SOLUTIONS = [
  {
    title: "Booking system",
    body: "Baner, hold, trænere, faste tider, gæstebooking, betaling og medlemsregler samlet i én løsning.",
  },
  {
    title: "Hjemmeside",
    body: "En moderne klubhjemmeside, der hænger direkte sammen med booking, medlemskab, nyheder og betaling.",
  },
  {
    title: "Lysstyring",
    body: "Automatisk styring af bane- og hallys, så lyset kan følge bookinger og kun være tændt, når det er nødvendigt.",
  },
  {
    title: "Adgangskontrol",
    body: "Koder, døre og adgang kan kobles til aktive bookinger og medlemskaber, så adgangen passer til det, der faktisk er booket.",
  },
  {
    title: "Betaling og kontingent",
    body: "Kontingent, gæstebetaling, klippekort, trænerbetaling og andre betalinger kan samles i samme flow.",
  },
  {
    title: "Integrationer",
    body: "Behold jeres nuværende system, hvis det giver mening. Vi kan bygge en løsning omkring eksisterende booking, økonomi, låse eller andre systemer.",
  },
];

export default async function CustomPage() {
  const {locale} = await getPreferences();
  const tr = (value: string) => phrase(value, locale);
  return (
    <div className="space-y-16">
      <section className="overflow-hidden rounded-3xl bg-ink px-6 py-14 text-chalk sm:px-10 sm:py-20">
        <p className="eyebrow text-chalk/80">{tr("Klubsoftware tilpasset jer")}</p>
        <h1 className="display mt-3 max-w-4xl text-4xl leading-tight sm:text-6xl">{tr("Få bygget præcis det system jeres klub har brug for")}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-chalk/80 sm:text-lg">{tr("Booking, hjemmeside, lysstyring, adgang, betaling og integrationer — bygget som én samlet løsning omkring jeres klub i stedet for endnu et standardsystem, I skal tilpasse jer til.")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/opret-klub?plan=CUSTOM" className="rounded-xl bg-court px-5 py-3 font-semibold text-chalk hover:bg-court-dark">{tr("Vælg custom-løsning og opret klub")}</a>
          <a href="#loesninger" className="rounded-xl border border-chalk/25 px-5 py-3 font-semibold text-chalk hover:bg-chalk/10">{tr("Se mulighederne")}</a>
        </div>
      </section>

      <section id="loesninger">
        <div className="max-w-2xl">
          <p className="eyebrow">{tr("Bygget til jeres virkelighed")}</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">{tr("Én leverandør i stedet for seks forskellige systemer")}</h2>
          <p className="mt-3 text-slate">{tr("Vi kan bygge hele løsningen fra bunden eller tage udgangspunkt i det, I allerede bruger. I behøver ikke skifte alt på én gang.")}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((item) => (
            <div key={item.title} className="card">
              <h3 className="display text-xl">{tr(item.title)}</h3>
              <p className="mt-2 text-sm leading-6 text-slate">{tr(item.body)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
        <div className="rounded-2xl bg-court/5 p-6 sm:p-8">
          <p className="eyebrow">{tr("Sådan arbejder vi")}</p>
          <h2 className="display mt-2 text-3xl">{tr("Fra problem til færdigt system")}</h2>
          <div className="mt-6 space-y-5">
            {[
              ["1", "Vi tager et møde", "I viser os, hvordan klubben fungerer i dag, og hvor det gør ondt."],
              ["2", "Vi designer løsningen", "I får et konkret forslag til funktioner, integrationer og pris."],
              ["3", "Vi bygger og tester", "Løsningen bliver bygget omkring jeres arbejdsgange og testet sammen med jer."],
              ["4", "Vi sætter det i drift", "Vi hjælper med data, opsætning og overgang, så klubben faktisk kommer godt i gang."],
            ].map(([n, title, body]) => (
              <div key={n} className="flex gap-4">
                <span className="data flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-court font-bold text-chalk">{n}</span>
                <div>
                  <p className="font-bold">{tr(title)}</p>
                  <p className="mt-1 text-sm text-slate">{tr(body)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">{tr("Eksempler")}</p>
          <h2 className="display mt-2 text-2xl">{tr("Det kan være alt fra en enkelt integration til hele klubbens digitale setup")}</h2>
          <ul className="mt-5 space-y-3 text-sm text-slate">
            <li>{tr("— Booking der automatisk tænder lys på den rigtige bane")}</li>
            <li>{tr("— Hjemmeside, medlemskab og betaling i samme system")}</li>
            <li>{tr("— Gæstebooking oven på jeres eksisterende bookingsystem")}</li>
            <li>{tr("— Adgangskoder eller låse der følger bookingen")}</li>
            <li>{tr("— Trænerbooking med automatisk betaling og udbetaling")}</li>
            <li>{tr("— Specialbyggede adminflows til netop jeres klub")}</li>
          </ul>
        </div>
      </section>

      <section id="book-moede" className="scroll-mt-24">
        <div className="mb-6 max-w-2xl">
          <p className="eyebrow">{tr("Book et møde")}</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">{tr("Fortæl os, hvad I gerne vil have til at fungere bedre")}</h2>
          <p className="mt-3 text-slate">{tr("Udfyld formularen, så tager vi en kort uforpligtende snak om mulighederne. I behøver ikke have en færdig kravspecifikation.")}</p>
        </div>
        <CustomMeetingForm locale={locale} />
      </section>
    </div>
  );
}
