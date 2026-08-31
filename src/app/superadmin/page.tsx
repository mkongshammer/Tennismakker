// Godkendelse af klubber.
//
// Klubber oprettes selv, men bliver først synlige når en af os har set dem
// efter i sømmene. En klub der påstår at have baner, den ikke har, koster
// os tilliden hos alle andre — og hos den gæst der står foran en låst låge.
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { approveClub, rejectClub, updateOrderStatus, markDomainLive } from "../../lib/actions";
import { DomainForm } from "./OrderTools";
import { CreateClubForm } from "./CreateClubForm";
import { updateLeadStatus } from "../../lib/actions";
import { sportLabel } from "../../lib/sports";

export const dynamic = "force-dynamic";

export default async function SuperadminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">Ikke adgang</p>
        <p className="mt-1 text-sm text-slate/60">
          Denne side er for RacketBuddys egne administratorer.
        </p>
      </div>
    );
  }

  const [pending, decided, orders, domainClubs, leads] = await Promise.all([
    db.club.findMany({
      where: { status: "PENDING" },
      include: { courts: true, members: true },
      orderBy: { createdAt: "asc" },
    }),
    db.club.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.websiteOrder.findMany({
      where: { status: { notIn: ["LIVE", "CANCELLED"] } },
      orderBy: { createdAt: "asc" },
    }),
    db.club.findMany({
      where: { status: "APPROVED" },
      select: { id: true, name: true, customDomain: true, domainStatus: true },
      orderBy: { name: "asc" },
    }),
    db.clubLead.findMany({
      where: { status: { in: ["NEW", "CONTACTED"] } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl">Klubgodkendelser</h1>
          <p className="text-slate/70">
            {pending.length} venter · {decided.length} behandlet
          </p>
        </div>
        <Link href="/superadmin/selvtest" className="btn-ghost">Selvtest af betaling</Link>
      </div>

      <section>
        <h2 className="display mb-1 text-2xl">Klubhenvendelser</h2>
        <p className="mb-4 text-sm text-slate">
          {leads.length === 0
            ? "Ingen åbne henvendelser."
            : `${leads.length} venter på at blive taget kontakt til.`}
        </p>

        {leads.length > 0 && (
          <ul className="mb-6 space-y-3">
            {leads.map((lead: any) => (
              <li key={lead.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold">{lead.clubName}, {lead.city}</p>
                  <p className="data text-xs text-slate">
                    {format(lead.createdAt, "d. MMM", { locale: da })}
                  </p>
                </div>
                <p className="mt-1 text-sm">
                  {lead.contactName} · {lead.email}
                  {lead.phone ? ` · ${lead.phone}` : ""}
                </p>
                {lead.message && <p className="mt-2 text-sm">{lead.message}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/superadmin?leadId=${lead.id}&clubName=${encodeURIComponent(lead.clubName)}&city=${encodeURIComponent(lead.city)}&adminName=${encodeURIComponent(lead.contactName)}&adminEmail=${encodeURIComponent(lead.email)}#opret-klub`}
                    className="btn-court text-sm"
                  >
                    Opret klub ud fra denne
                  </Link>
                  {lead.status === "NEW" && (
                    <form action={updateLeadStatus}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="status" value="CONTACTED" />
                      <button className="btn-ghost text-sm">Markér som ringet op</button>
                    </form>
                  )}
                  <form action={updateLeadStatus}>
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="status" value="DECLINED" />
                    <button className="text-sm text-slate underline">Afvis</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="opret-klub">
        <h2 className="display mb-1 text-2xl">Opret klub</h2>
        <p className="mb-4 text-sm text-slate">
          Kun her klubber bliver til — der er ingen offentlig oprettelse.
          Udfyldes en henvendelse ovenfor ind i, er felterne udfyldt på forhånd.
        </p>
        <CreateClubForm />
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Venter på svar</h2>
        {pending.length === 0 && (
          <p className="text-slate/60">Ingen klubber venter lige nu.</p>
        )}

        <ul className="space-y-4">
          {pending.map((club: any) => {
            const admin = club.members.find((m: any) => m.role === "CLUB_ADMIN");
            const sports = Array.from(
              new Set(club.courts.map((c: any) => c.sport))
            ) as string[];

            return (
              <li key={club.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-bold">{club.name}</p>
                  <p className="text-sm text-slate/50">
                    Oprettet {format(club.createdAt, "d. MMM yyyy", { locale: da })}
                  </p>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-slate/50">Adresse</dt>
                    <dd>{club.address ? `${club.address}, ${club.city}` : club.city}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate/50">Baner</dt>
                    <dd>
                      {club.courts.length} ·{" "}
                      {sports.map((s) => sportLabel(s, "da")).join(", ")}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate/50">Pris</dt>
                    <dd>{club.priceHour} kr/time</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate/50">Model</dt>
                    <dd>
                      {club.billingModel === "SUBSCRIPTION"
                        ? `Abonnement ${club.subscriptionKr} kr/md`
                        : "10% provision"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate/50">System</dt>
                    <dd>{club.externalSystem ?? "ikke oplyst"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate/50">Kontakt</dt>
                    <dd>
                      {admin ? `${admin.name} · ${admin.email}` : "ingen admin"}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-xs text-slate/50">
                  Tjek at klubben findes, at adressen passer, og at kontaktpersonen
                  hører til klubben — helst med et opkald.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={approveClub}>
                    <input type="hidden" name="id" value={club.id} />
                    <button className="btn-ink">Godkend</button>
                  </form>
                  <form action={rejectClub} className="flex flex-1 gap-2">
                    <input type="hidden" name="id" value={club.id} />
                    <input
                      className="input flex-1"
                      name="note"
                      placeholder="Intern note (valgfri)"
                    />
                    <button className="btn-ghost">Afvis</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Hjemmesidebestillinger</h2>
        <p className="mb-4 text-sm text-slate">
          {orders.length === 0
            ? "Ingen åbne bestillinger."
            : `${orders.length} i gang. 5.000 kr pr. opsætning.`}
        </p>

        <ul className="space-y-3">
          {orders.map((o: any) => (
            <li key={o.id} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{o.clubName}</p>
                <p className="data text-xs text-slate">
                  {format(o.createdAt, "d. MMM", { locale: da })} ·{" "}
                  {o.id.slice(-6).toUpperCase()}
                </p>
              </div>
              <p className="mt-1 text-sm">
                {o.contactName} · {o.email}
                {o.phone ? ` · ${o.phone}` : ""}
              </p>
              <p className="text-sm text-slate">
                {o.domain ? `Domæne: ${o.domain}` : "Har ikke et domæne endnu"}
              </p>
              {o.notes && <p className="mt-2 text-sm">{o.notes}</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["CONTACTED", "Ringet op"],
                  ["BUILDING", "Bygger"],
                  ["LIVE", "Færdig"],
                  ["CANCELLED", "Aflyst"],
                ].map(([value, label]) => (
                  <form action={updateOrderStatus} key={value}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value={value} />
                    <button
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        o.status === value
                          ? "bg-ink text-chalk"
                          : "border border-slate/20 text-slate"
                      }`}
                    >
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Egne domæner</h2>
        <p className="mb-4 text-sm text-slate">
          Knyt et domæne til en klub. Det virker først, når DNS peger på os.
        </p>
        <DomainForm clubs={domainClubs} />

        {domainClubs.filter((c: any) => c.customDomain).length > 0 && (
          <ul className="card mt-4 divide-y divide-slate/10">
            {domainClubs
              .filter((c: any) => c.customDomain)
              .map((c: any) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-semibold">{c.name}</span>
                  <span className="data text-slate">{c.customDomain}</span>
                  {c.domainStatus === "LIVE" ? (
                    <span className="font-bold text-court">Aktivt</span>
                  ) : (
                    <form action={markDomainLive}>
                      <input type="hidden" name="clubId" value={c.id} />
                      <button className="text-sm font-semibold text-court underline">
                        Marker som aktivt
                      </button>
                    </form>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Behandlet</h2>
        <ul className="card divide-y divide-slate/10">
          {decided.map((club: any) => (
            <li key={club.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span className="font-semibold">{club.name}</span>
              <span className="text-slate/60">{club.city}</span>
              <span
                className={
                  club.status === "APPROVED" ? "text-ink font-bold" : "text-court font-bold"
                }
              >
                {club.status === "APPROVED" ? "Godkendt" : "Afvist"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
