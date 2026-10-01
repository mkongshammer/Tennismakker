import {phrase} from "../../../lib/phrases";
import {getPreferences} from "../../../lib/preferences";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import {
  CLUB_MODULES,
  getClubCustomConfig,
  getClubIntegrations,
  moduleStatus,
} from "../../../lib/club-custom";
import { requestClubModule, saveGenericIntegration } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Kan tilføjes",
  REQUESTED: "Ønsket",
  BUILDING: "Under udvikling",
  ACTIVE: "Aktiv",
  PAUSED: "Sat på pause",
};

export default async function CustomAdminPage() {
  const user = await getCurrentUser();
  const {locale}=await getPreferences(),tr=(value:string)=>phrase(value,locale);
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) redirect("/admin");

  const [club, config, integrations] = await Promise.all([
    db.club.findUnique({
      where: { id: user.clubId },
      select: {
        id: true,
        solutionMode:true,
        name: true,
        slug: true,
        customDomain: true,
        domainStatus: true,
        integrationType: true,
        externalSystem: true,
      },
    }),
    getClubCustomConfig(user.clubId),
    getClubIntegrations(user.clubId),
  ]);
  if (!club || club.solutionMode !== "CUSTOM") redirect("/admin");

  // Funktioner som allerede findes i kernesystemet vises som aktive. Det
  // betyder ikke, at klubben automatisk faktureres for nye custom-moduler.
  const runtimeStatus = (key: string) => {
    if (key === "WEBSITE" && (club.customDomain || config.modules.WEBSITE === "ACTIVE")) return "ACTIVE";
    if (key === "BOOKING" && club.integrationType === "NATIVE") return "ACTIVE";
    return moduleStatus(config, key as any);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-court">{club.name}</p>
          <h1 className="display text-3xl">{tr("Custom løsninger")}</h1>
          <p className="mt-2 max-w-2xl text-slate">
            {tr("Alt bygges oven på jeres RacketBuddy-klub. I beholder samme login, medlemmer og bookingdata, mens nye moduler bliver koblet på efter behov.")}</p>
        </div>
        <Link href="/admin" className="btn-ghost">{tr("Tilbage til klubadmin")}</Link>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="display text-xl">{tr("Hjemmeside")}</h2>
            <p className="mt-1 text-sm text-slate">
              {tr("Hjemmesiden styres fra samme klublogin som booking, medlemmer og betaling.")}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/hjemmeside" className="btn-court">{tr("Rediger hjemmeside")}</Link>
            <Link href={`/klub/${club.slug}`} className="btn-ghost">{tr("Se siden")}</Link>
          </div>
        </div>
        {club.customDomain && (
          <p className="mt-3 text-sm">
            {tr("Domæne:")}<span className="font-semibold">{club.customDomain}</span> · {club.domainStatus === "LIVE" ? tr("aktivt") : tr("under opsætning")}
          </p>
        )}
      </section>

      <section>
        <h2 className="display text-2xl">{tr("Moduler")}</h2>
        <p className="mt-1 text-sm text-slate">
          {tr("Det her er grundmodellen. Når I får et nyt ønske, kan vi bygge det som et modul i stedet for et separat system.")}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {CLUB_MODULES.map((module) => {
            const status = runtimeStatus(module.key);
            return (
              <article key={module.key} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{tr(module.label)}</h3>
                    <p className="mt-1 text-sm text-slate">{tr(module.description)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === "ACTIVE" ? "bg-court/10 text-court" : "bg-mist text-slate"}`}>
                    {tr(STATUS_LABELS[status] ?? status)}
                  </span>
                </div>

                {status === "AVAILABLE" && (
                  <form action={requestClubModule} className="mt-4 space-y-2">
                    <input type="hidden" name="module" value={module.key} />
                    <textarea
                      name="wish"
                      className="input"
                      rows={2}
                      placeholder={tr("Beskriv kort hvad I ønsker, fx automatisk lys 10 min før en booking.")}
                    />
                    <button className="btn-ghost text-sm">{tr("Bed om dette modul")}</button>
                  </form>
                )}

                {status === "REQUESTED" && (
                  <p className="mt-4 text-sm font-semibold text-court">{tr("RacketBuddy har modtaget ønsket.")}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="display text-xl">{tr("Forbind et eksisterende system")}</h2>
        <p className="mt-1 text-sm text-slate">
          {tr("Regnskab, adgang, lys, booking eller et andet API kan kobles på her. Oplysningerne ligger på klubbens RacketBuddy-konto; credentials gemmes krypteret.")}</p>

        <form action={saveGenericIntegration} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="type">{tr("Type")}</label>
            <select className="input" id="type" name="type" defaultValue="ACCOUNTING">
              <option value="ACCOUNTING">{tr("Regnskab")}</option>
              <option value="LIGHTING">{tr("Lysstyring")}</option>
              <option value="ACCESS">{tr("Adgangskontrol")}</option>
              <option value="BOOKING">{tr("Bookingsystem")}</option>
              <option value="PAYMENTS">{tr("Betaling")}</option>
              <option value="CUSTOM_API">{tr("Andet API/system")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="provider">{tr("System")}</label>
            <input className="input" id="provider" name="provider" placeholder={tr("fx e-conomic, Dinero, Halbooking, Salto")} required />
          </div>
          <div>
            <label className="label" htmlFor="endpoint">{tr("API-adresse (hvis relevant)")}</label>
            <input className="input" id="endpoint" name="endpoint" placeholder={tr("https://api...")} />
          </div>
          <div>
            <label className="label" htmlFor="accountRef">{tr("Konto / reference")}</label>
            <input className="input" id="accountRef" name="accountRef" placeholder={tr("Kundenr., tenant eller lignende")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="apiKey">{tr("API-nøgle / token (valgfri)")}</label>
            <input className="input" id="apiKey" name="apiKey" type="password" autoComplete="off" placeholder={tr("Gemmes krypteret")} />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-court">{tr("Gem integration")}</button>
          </div>
        </form>

        {integrations.length > 0 && (
          <div className="mt-6 border-t border-slate/10 pt-5">
            <p className="font-bold">{tr("Jeres integrationer")}</p>
            <ul className="mt-3 divide-y divide-slate/10">
              {integrations.map((integration) => (
                <li key={integration.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="font-semibold">{integration.provider}</span>{" "}
                    <span className="text-slate">· {integration.type}</span>
                  </span>
                  <span className="font-semibold text-court">{integration.status === "ACTIVE" ? tr("Aktiv") : tr("Klargøres")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-court/25 bg-court/5 p-5">
        <h2 className="font-bold">{tr("Sådan bygger vi videre")}</h2>
        <p className="mt-2 text-sm text-slate">
          {tr("Nye klubønsker skal som udgangspunkt blive til genbrugelige RacketBuddy-moduler. Klubspecifik kode kan stadig laves, men den kører med samme login, rettigheder og data som resten af platformen.")}</p>
      </section>
    </div>
  );
}
