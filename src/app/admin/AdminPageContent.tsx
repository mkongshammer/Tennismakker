import { phrase } from "../../lib/phrases";
import { ClubInvoices } from "../../components/ClubInvoices";
import { InternationalProvider } from "../../components/InternationalProvider";
import { InternationalForm } from "./InternationalForm";
import { getPreferences } from "../../lib/preferences";
import { formatMoney, formatDate, dayKey, wallTime, timeZoneLabel } from "../../lib/international";
import { clubHasSection, clubHasFeature } from "../../lib/club-features";
import { MemberForm } from "./MemberForm";
import { WalletForm } from "./WalletForm";
import { ManualLights } from "./ManualLights";
import { ResasportsForm } from "./ResasportsForm";
import { ImportForm } from "./ImportForm";
import { WalletBalances } from "./WalletBalances";
import React from "react";
import { ADMIN_PAGES, adminHref, type AdminSection } from "../../lib/admin-navigation";
import { AdminNavigation } from "./AdminNavigation";
import { sportLabel } from "../../lib/sports";
import { clubSports, facilityLabel } from "../../lib/club-sports";
// Klub-administration: her styrer klubben, hvordan RacketBuddy henter
// ledighed, og hvilke tider udefrakommende spillere må booke.
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { markClubEntered, syncNow, withdrawGuestSlot, toggleRule, deleteRule, setLastMinute, generateJoinCode, deletePost, setTheme, startClubSubscription, openClubBillingPortal, switchToAnnual } from "../../lib/actions";
import { clubSignupPrices } from "../../lib/club-onboarding";
import { INTEGRATION_LABELS } from "../../lib/integrations/types";
import { SURFACES } from "../../lib/levels";
import { IntegrationForm } from "./IntegrationForm";
import { ReleaseForm } from "./ReleaseForm";
import { BookingRulesForm } from "./BookingRulesForm";
import { RuleForm } from "./RuleForm";
import { SiteForm, PostForm } from "./SiteForm";
import { PeopleForm } from "./PeopleForm";
import { FixedSlotForm } from "./FixedSlotForm";
import { CourtForm } from "./CourtForm";
import { AdminsForm } from "./AdminsForm";
import { PriceRuleForm } from "./PriceRuleForm";
import { SystemLoginForm } from "./SystemLoginForm";
import { ClubControlPanel } from "./ClubControlPanel";
import { blockSummary } from "../../lib/system-blocks";
import { MembershipForm } from "./MembershipForm";
import { BillingPanel } from "./BillingPanel";
import { CommunicationPanel } from "./CommunicationPanel";
import { ReportsPanel } from "./ReportsPanel";
import { EventsPanel } from "./EventsPanel";
import { ShopPanel } from "./ShopPanel";
import { StaffPanel } from "./StaffPanel";
import { broadcastRecipients } from "../../lib/broadcast";
import { smsConfigured } from "../../lib/sms";
import { revenueLines, summarize, CATEGORIES } from "../../lib/reports";
import { ladderStandings } from "../../lib/events";
import { tournamentView } from "../../lib/tournament";
import { AccessPanel } from "./AccessPanel";
import { clubBillingOverview } from "../../lib/member-billing";
import { PunchCardForm, TeamForm } from "./TeamAndPunchForms";
import { DomainForm } from "./DomainForm";
import { ImageForms } from "./ImageForms";
import { startClubPayoutSetup } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";
import { refreshAccountStatus } from "../../lib/connect";
import { stripeEnabled } from "../../lib/stripe";
import { getSettings } from "../../lib/settings";
import { subscriptionIsActive } from "../../lib/billing";
import { loadClubDashboard } from "../../lib/club-dashboard";
import { ClubHome } from "./ClubHome";
import { CourtSchedule } from "./CourtSchedule";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPageContent({
  searchParams,
  section = "oversigt"



}: {searchParams: Promise<{stripe?: string;abonnement?: string;dag?: string;from?: string;to?: string;uge?: string;fra?: string;til?: string;quickbooks?: string;}>;section?: AdminSection;}) {
  const query = await searchParams;
  const prefs = await getPreferences();const tr=(text:string,params?:Record<string,string|number>)=>phrase(text,prefs.locale,params);
  if (section === "oversigt" && (query.stripe || query.abonnement)) redirect(`/admin/betaling?${new URLSearchParams(Object.entries(query).filter(([, v]) => v != null) as [string, string][]).toString()}`);
  const currentPage = ADMIN_PAGES.find((p) => p.id === section)!;
  const user = await getCurrentUser();
  const stripeOn = await stripeEnabled();
  const pct = Math.round((await getSettings()).commissionPct * 100);
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">{tr("Kun for klub-administratorer")}</p>
        <p className="mt-1 text-sm text-slate">{tr("Din konto er ikke tilknyttet en klub. Kontakt RacketBuddy for at f\xE5 jeres klub med.")}

        </p>
      </div>);

  }

  if (query.stripe === "return" || query.stripe === "refresh") {
    const admin = await getCurrentUser();
    if (admin?.clubId) await refreshAccountStatus("CLUB", admin.clubId).catch(() => null);
  }

  const club = await db.club.findUnique({
    where: { id: user.clubId },
    include: {
      courts: {
        orderBy: { name: "asc" },
        include: { _count: { select: { bookings: true } } }
      },
      members: true,
      posts: { orderBy: { createdAt: "desc" }, take: 10 },
      images: { orderBy: { sortOrder: "asc" } },
      people: { orderBy: { sortOrder: "asc" } }
    }
  });
  if (!club) redirect("/");
  const priceBook = section === 'betaling' ? await clubSignupPrices(club.country).catch(() => null) : null;
  const monthlyPrice = priceBook?.standard ?? club.subscriptionKr, annualPrice = priceBook?.annual ?? club.subscriptionKr * 10;
  if (club.signupManaged && club.status !== "APPROVED" && section !== "betaling") redirect("/club-start");
  if (!clubHasSection(club.solutionMode, section, club.customFeatures)) redirect("/admin");
  const selectedSports = clubSports(club.sports, club.courts);

  // Faste baner hører til banerne, ikke til klubben, så de hentes for sig.
  const [seasonTeams, punchCards] = await Promise.all([
  section === 'hold' ? db.seasonTeam.findMany({
    where: { clubId: club.id },
    orderBy: [{ active: "desc" }, { dayOfWeek: "asc" }],
    include: { _count: { select: { signups: { where: { status: "PAID" } } } } }
  }) : Promise.resolve([]),
  section === 'priser' ? db.clubPunchCard.findMany({
    where: { clubId: club.id },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }]
  }) : Promise.resolve([])]
  );

  const [systemLogin, blocks] = await Promise.all([
  section === 'integrationer' ? db.clubSystemLogin.findUnique({ where: { clubId: club.id } }) : Promise.resolve(null),
  section === 'integrationer' ? blockSummary(club.id) : Promise.resolve(null)]
  );

  const priceRules = await (section === 'priser' ? db.priceRule.findMany({
    where: { clubId: club.id },
    orderBy: { sortOrder: "asc" }
  }) : Promise.resolve([]));

  const membershipTypes = await (section === 'medlemmer' ? db.membershipType.findMany({
    where: { clubId: club.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: { _count: { select: { memberships: { where: { status: "PAID" } } } } }
  }) : Promise.resolve([]));

  const fixedSlots = await (section === 'bookinger' ? db.fixedSlot.findMany({
    where: { court: { clubId: club.id } },
    include: { court: { select: { name: true } }, user: { select: { name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { hour: "asc" }]
  }) : Promise.resolve([]));

  const clubControl = await (section === 'lys-adgang' ? db.clubControl.findUnique({
    where: { clubId: club.id },
    include: {
      devices: {
        orderBy: { createdAt: "asc" },
        include: { channels: { orderBy: { channel: "asc" } } }
      }
    }
  }) : Promise.resolve(null));

  const courtIds = club.courts.map((c: any) => c.id);
  const today = wallTime(dayKey(new Date(), club.timeZone), 0, 0, club.timeZone)!;

  const [upcoming, payments, rules, guestSlots] = await Promise.all([
  section === 'bookinger' ? db.booking.findMany({
    where: {
      courtId: { in: courtIds },
      status: "CONFIRMED",
      startsAt: { gte: today, lt: addDays(today, 8) }
    },
    include: { user: true, court: true },
    orderBy: { startsAt: "asc" }
  }) : Promise.resolve([]),
  Promise.resolve([]),
  section === 'tider' ? db.guestRule.findMany({ where: { clubId: club.id }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  section === 'tider' ? db.guestSlot.findMany({
    where: { courtId: { in: courtIds }, startsAt: { gte: new Date() } },
    include: { court: true },
    orderBy: { startsAt: "asc" },
    take: 50
  }) : Promise.resolve([])]
  );

  const toEnter = upcoming.filter((b: any) => b.needsClubEntry && !b.clubEnteredAt);

  return (
    <InternationalProvider country={club.country} locale={prefs.locale} currency={club.currency} timeZone={club.timeZone}><div className="space-y-6">
<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-slate">{tr("Klubadministration")}</p>
          <h1 className="display mt-1 text-display-md sm:text-display-lg">{club.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
            <span>{selectedSports.map((s) => sportLabel(s, prefs.locale)).join(" · ") || tr("Vælg klubbens sportsgrene for at komme i gang.")}</span>
            <span>·</span>
            <span>{club.currency} · {timeZoneLabel(club.timeZone, prefs.locale)}</span>
            <span>·</span>
            <span>{tr(INTEGRATION_LABELS[club.integrationType as keyof typeof INTEGRATION_LABELS])}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/clubs/${club.slug}`} className="btn-ghost btn-sm">View public page</Link>
          {club.status === "APPROVED" ? <span className="badge-success self-center">Live</span> : <span className="badge-warning self-center">{club.status === "PENDING" ? "Awaiting approval" : club.status}</span>}
        </div>
      </div>
{query.abonnement &&
        <p className="card border border-court/25 text-sm">
          {query.abonnement === "ok" ?
          tr("Tak — abonnementet er startet. Kvitteringen ligger i jeres indbakke.") :
          query.abonnement === "afbrudt" ?
          tr("Betalingen blev afbrudt. Abonnementet er ikke startet.") :
          query.abonnement === "portal" ?
          tr("Selvbetjeningen kunne ikke åbnes lige nu. Skriv til os, så ordner vi det.") :
          tr("Abonnementet kunne ikke startes lige nu. Prøv igen, eller skriv til os.")}
        </p>
        }
<div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
<AdminNavigation features={club.customFeatures} mode={club.solutionMode} section={section} facility={tr(facilityLabel(selectedSports))} locale={prefs.locale} />
<div className="min-w-0 space-y-6">
<header><h2 className="display text-2xl">{section === 'baner' ? tr(facilityLabel(selectedSports)) + ' ' + tr('og sportsgrene') : phrase(currentPage.label, prefs.locale)}</h2><p className="mt-1 text-sm text-slate">{phrase(currentPage.description, prefs.locale)}</p></header>
{section === 'oversigt' && <ClubHome data={await loadClubDashboard(club.id)} locale={prefs.locale} />}
{section === 'bookinger' && <>
<CourtSchedule clubId={club.id} courts={club.courts.map((c: any) => ({ id: c.id, name: c.name, sport: c.sport, indoor: c.indoor }))} openHour={club.openHour} closeHour={club.closeHour} timeZone={club.timeZone} currency={club.currency} locale={prefs.locale} dayOffset={Math.min(6, Math.max(0, Number(query.dag ?? 0) || 0))} baseHref="/admin/bookinger" />
{toEnter.length > 0 &&
              <section className="rounded-lg border-2 border-court bg-court/5 p-5">
          <p className="display text-xl text-court-dark">
            {tr("{count} bookinger skal ind i jeres eget system",{count:toEnter.length})}
                </p>
          <p className="mt-1 text-sm">{tr("G\xE6sten har betalt hos os. F\xF8r tiden ind i")}
                  {club.externalSystem || tr("klubbens bookingsystem")}{tr(", s\xE5 banen ikke bliver dobbeltbooket.")}

                </p>
          <ul className="mt-4 space-y-2">
            {toEnter.map((b: any) =>
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-3">
                <span className="text-sm">
                  <span className="font-bold capitalize">
                    {formatDate(b.startsAt, prefs.locale, b.timeZone, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>{" "}
                  · {b.court?.name} · {b.user.name}
                </span>
                <form action={markClubEntered}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="btn-ink text-sm">{tr("F\xF8rt ind")}</button>
                </form>
              </li>
                  )}
          </ul>
        </section>
              }
<section>
        <h2 className="display mb-3 text-2xl">{tr("Kommende g\xE6stebookinger")}</h2>
        {upcoming.length === 0 && <p className="text-slate">{tr("Ingen bookinger i den kommende uge.")}</p>}
        {upcoming.length > 15 && <p className="mb-2 text-xs text-slate">Showing the next 15 of {upcoming.length} bookings this week. Use the schedule above for the full picture.</p>}
        <ul className="space-y-2">
          {upcoming.slice(0, 15).map((b: any) =>
                  <li key={b.id} className="card flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span className="font-semibold capitalize">
                {formatDate(b.startsAt, prefs.locale, b.timeZone, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}–{formatDate(b.endsAt, prefs.locale, b.timeZone, { hour: "2-digit", minute: "2-digit" })} ·{" "}
                {b.court?.name}
              </span>
              <span>{b.user.name}{b.guestCount > 0 && <span className="text-slate"> +{b.guestCount}</span>}{club.checkInEnabled && b.checkedInAt && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success-ink">{tr("tjekket ind")}</span>}</span>
              <span className="text-slate">
                {formatMoney(b.priceKr, b.currency, prefs.locale)}
                {b.needsClubEntry && !b.clubEnteredAt &&
                      <span className="ml-2 font-bold text-court">{tr("skal f\xF8res ind")}</span>
                      }
              </span>
            </li>
                  )}
        </ul>
      </section>
{clubHasFeature(club.solutionMode, club.customFeatures, 'faste-bookinger') && <section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Faste baner")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Samme bane, samme ugedag, hele s\xE6sonen. Klubben tildeler dem \u2014 medlemmet booker dem ikke selv. Tiderne oprettes som almindelige bookinger, s\xE5 de sp\xE6rrer banen og kan aflyses enkeltvis.")}



                </p>
        <FixedSlotForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  members={club.members.map((m: any) => ({ id: m.id, name: m.name }))}
                  slots={fixedSlots as any}
                  defaultPrice={club.memberPriceHour ?? club.priceHour} />

      </section>}
</>}
{section === 'tider' && <>
<BookingRulesForm club={{ guestFeeKr: club.guestFeeKr, guestMax: club.guestMax, waiverText: club.waiverText, checkInEnabled: club.checkInEnabled, noShowReleaseMinutes: club.noShowReleaseMinutes }} />
{club.integrationType === "MANUAL" &&
              <section>
          <h2 className="display mb-1 text-2xl">{tr("Frigiv tider til g\xE6ster")}</h2>
          <p className="mb-3 text-sm text-slate">{tr("Kun tider, I frigiver her, kan ses og bookes af spillere udefra.")}

                </p>

          <div className="mb-4 rounded-lg border border-slate/15 bg-white p-4 text-sm">
            <p className="font-bold">{tr("S\xE6lger I ogs\xE5 baner et andet sted?")}</p>
            <p className="mt-1 text-slate">{tr("Bruger I b\xE5de os og en anden platform, kan vi ikke se hinandens bookinger. Frigiv derfor forskellige tider til hver kanal \u2014 eller afs\xE6t en bane til hver. S\xE5 kan den samme time ikke s\xE6lges to gange.")}



                  </p>
            <p className="mt-2 text-slate">{tr("Tag altid tiden ud af jeres eget system, n\xE5r I frigiver den her.")}

                  </p>
          </div>
          <RuleForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  defaultPrice={club.priceHour}
                  externalSystem={club.externalSystem ?? tr("jeres eget bookingsystem")} />


          {rules.length > 0 &&
                <>
              <h3 className="mb-2 mt-6 font-bold">{tr("Jeres regler")}</h3>
              <ul className="space-y-2">
                {rules.map((r: any) => {
                      const dayNames = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
                      const days = r.daysOfWeek.
                      split(",").
                      map((d: string) => tr(dayNames[Number(d)])).
                      join(", ");
                      const courtNames = r.courtIds ?
                      r.courtIds.
                      split(",").
                      map((id: string) => club.courts.find((c: any) => c.id === id)?.name).
                      filter(Boolean).
                      join(", ") :
                      tr("alle baner");
                      return (
                        <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className={`font-semibold ${r.active ? "" : "text-slate line-through"}`}>
                          {days} · {r.fromHour}–{r.toHour} · {courtNames}
                        </p>
                        <p className="data text-sm text-slate">{formatMoney(r.priceKr, club.currency, prefs.locale)}{tr("/time")}</p>
                      </div>
                      <div className="flex gap-2">
                        <form action={toggleRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-sm font-semibold text-court underline">
                            {r.active ? tr("Sæt på pause") : tr("Aktivér")}
                          </button>
                        </form>
                        <form action={deleteRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-sm text-slate underline">{tr("Slet")}</button>
                        </form>
                      </div>
                    </li>);

                    })}
              </ul>
            </>
                }

          <div className="card mt-6">
            <p className="font-bold">{tr("Sidste \xF8jeblik")}</p>
            <p className="mt-1 text-sm text-slate">{tr("Frigiv automatisk alt, der stadig st\xE5r tomt t\xE6t p\xE5 spilletidspunktet. En bane der er ledig om en time er tabt indt\xE6gt uanset hvad.")}


                  </p>
            <form action={setLastMinute} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="hours">{tr("Timer f\xF8r start")}</label>
                <input
                        className="input w-32"
                        id="hours"
                        name="hours"
                        type="number"
                        min={0}
                        max={72}
                        defaultValue={club.lastMinuteHours} />

              </div>
              <button className="btn-ghost">{tr("Gem")}</button>
            </form>
            <p className="mt-2 text-xs text-slate">{tr("0 sl\xE5r det fra.")}</p>
          </div>

          <h3 className="mb-2 mt-6 font-bold">{tr("Enkelte tider")}</h3>
          <p className="mb-3 text-sm text-slate">{tr("Til undtagelser \u2014 en enkelt aften der alligevel blev fri.")}

                </p>
          <ReleaseForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  defaultPrice={club.priceHour}
                  externalSystem={club.externalSystem ?? tr("jeres eget bookingsystem")} />


          <h3 className="mb-2 mt-6 font-bold">{tr("Frigivne enkelttider")}</h3>
          {guestSlots.length === 0 ?
                <p className="text-sm text-slate">{tr("Ingen tider er frigivet endnu.")}</p> :

                <ul className="card divide-y divide-slate/10">
              {guestSlots.map((s: any) =>
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="capitalize">
                    {formatDate(s.startsAt,prefs.locale,club.timeZone,{weekday:"short",day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"})} · {s.court.name} ·{" "}
                    {formatMoney(s.priceKr, club.currency, prefs.locale)}
                  </span>
                  <form action={withdrawGuestSlot}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-court underline">{tr("Fjern")}</button>
                  </form>
                </li>
                  )}
            </ul>
                }
        </section>
              }
</>}
{section === 'medlemmer' && await (async () => { const billing = await clubBillingOverview(club.id); return <BillingPanel
  types={billing.types}
  members={billing.members}
  chargesEnabled={club.stripeChargesEnabled}
  settings={{ dueDays: club.billingDueDays, reminders: club.billingReminders, replyTo: club.billingReplyTo ?? '', note: club.billingNote ?? '', contactEmail: club.contactEmail ?? '' }} />; })()}
{section === 'medlemmer' && <>
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Kontingent")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Medlemmerne tilmelder sig fra jeres side og betaler online. Pengene g\xE5r direkte til klubbens konto. Er kontingentet betalt og s\xE6sonen i gang, booker medlemmet til medlemspris.")}



                </p>
        <MembershipForm
                  types={membershipTypes.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    seasonName: t.seasonName,
                    description: t.description,
                    fromDate: t.fromDate,
                    toDate: t.toDate,
                    priceKr: t.priceKr,
                    capacity: t.capacity,
                    active: t.active,
                    paid: t._count.memberships,
                    interval: t.interval,
                    familySize: t.familySize
                  }))} />

      </section>
<MemberForm types={membershipTypes.map((t) => ({ id: t.id, name: t.name }))} />
{clubHasFeature(club.solutionMode, club.customFeatures, 'import') && <ImportForm membersOnly />}
<BillingPanel part="settings" types={[]} members={0} chargesEnabled={club.stripeChargesEnabled}
  settings={{ dueDays: club.billingDueDays, reminders: club.billingReminders, replyTo: club.billingReplyTo ?? '', note: club.billingNote ?? '', contactEmail: club.contactEmail ?? '' }} />
</>}
{section === 'kommunikation' && await (async () => {
  const [all, paid, history] = await Promise.all([broadcastRecipients(club.id, 'ALL'), broadcastRecipients(club.id, 'PAID'), db.clubBroadcast.findMany({ where: { clubId: club.id }, orderBy: { createdAt: 'desc' }, take: 30 })]);
  return <CommunicationPanel counts={{ all: all.length, paid: paid.length }} history={history} smsReminders={club.smsReminders} smsReady={smsConfigured()} />;
})()}
{section === 'rapporter' && await (async () => {
  const todayKey = dayKey(new Date(), club.timeZone);
  const defaultFrom = `${todayKey.slice(0, 4)}-01-01`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(query.from ?? '')) ? String(query.from) : defaultFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(query.to ?? '')) ? String(query.to) : todayKey;
  const lines = await revenueLines(club.id, wallTime(from, 0, 0, club.timeZone)!, new Date(wallTime(to, 0, 0, club.timeZone)!.getTime() + 86_400_000), club.timeZone);
  const { accountingStatus, quickBooksConfigured } = await import('../../lib/quickbooks');
  const qbNotice: Record<string, string> = { connected: 'QuickBooks er forbundet. Omsætningen bogføres fra i dag; vælg en tidligere dag under "Bogfør fra", hvis du vil have historikken med.', cancelled: 'Forbindelsen blev afbrudt, før den var færdig.', denied: 'Log ind som klubbens administrator og prøv igen.', error: 'QuickBooks afviste forbindelsen. Prøv igen.', 'not-configured': 'QuickBooks-koblingen er ikke slået til på denne server endnu.' };
  const accounting = { configured: quickBooksConfigured(), notice: qbNotice[String(query.quickbooks ?? '')] ?? null, status: await accountingStatus(club.id) };
  return <ReportsPanel accounting={accounting} months={summarize(lines, club.timeZone)} categories={CATEGORIES} from={from} to={to} recent={lines.slice(-25).reverse().map((l) => ({ ...l, date: l.date.toISOString() }))} />;
})()}
{section === 'events' && await (async () => {
  const [events, ladders] = await Promise.all([
    db.clubEvent.findMany({ where: { clubId: club.id }, orderBy: { startsAt: 'desc' }, take: 40, include: { signups: { where: { status: 'PAID' }, include: { user: { select: { name: true, email: true } } } } } }),
    db.ladder.findMany({ where: { clubId: club.id }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { entries: true } } } }),
  ]);
  const ladderViews = [];
  for (const l of ladders) ladderViews.push({ id: l.id, name: l.name, sport: l.sport, active: l.active, players: l._count.entries, top: (await ladderStandings(l.id)).slice(0, 6) });
  const whenOf = (d: Date | null) => (d ? formatDate(d, prefs.locale, club.timeZone, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null);
  const draws = new Map<string, Awaited<ReturnType<typeof tournamentView>>>();
  for (const e of events) if (e.drawnAt) draws.set(e.id, await tournamentView(e.id));
  const sports = selectedSports.length ? selectedSports : ['TENNIS'];
  return <EventsPanel slug={club.slug} sports={sports as string[]} sportLabels={Object.fromEntries((sports as string[]).map((s) => [s, sportLabel(s as any, prefs.locale)]))} ladders={ladderViews}
    events={events.map((e) => ({ id: e.id, name: e.name, kind: e.kind, sport: e.sport, startsAt: e.startsAt, endsAt: e.endsAt, priceKr: e.priceKr, capacity: e.capacity, active: e.active, format: e.format, drawnAt: e.drawnAt, draw: draws.has(e.id) ? { ...draws.get(e.id)!, matches: draws.get(e.id)!.matches.map((m) => ({ ...m, when: whenOf(m.scheduledAt) })) } : null, signups: e.signups.map((s) => ({ id: s.id, name: s.user.name, email: s.user.email, status: s.status, paidAt: s.paidAt })) }))} />;
})()}
{section === 'butik' && await (async () => {
  const [items, sales, gifts] = await Promise.all([
    db.shopItem.findMany({ where: { clubId: club.id }, orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }] }),
    db.shopSale.findMany({ where: { clubId: club.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    db.giftCard.findMany({ where: { clubId: club.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  const buyers = new Map((await db.user.findMany({ where: { id: { in: sales.map((s) => s.userId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const { readersWithStatus } = await import('../../lib/terminal');
  const readers = (await readersWithStatus(club.id).catch(() => [])).map((r) => ({ id: r.id, label: r.label, status: r.status, deviceType: r.deviceType }));
  const { getSettings: settingsForShop } = await import('../../lib/settings');
  const stripeReady = (await settingsForShop()).paymentProvider !== 'stripe' || Boolean(club.stripeAccountId && club.stripeChargesEnabled);
  return <ShopPanel slug={club.slug} items={items} gifts={gifts} readers={readers} stripeReady={stripeReady} sales={sales.map((s) => ({ id: s.id, items: s.items, totalKr: s.totalKr, method: s.method, status: s.status, createdAt: s.createdAt, buyer: s.userId ? buyers.get(s.userId) ?? null : null }))} />;
})()}
{section === 'vagtplan' && await (async () => {
  const todayKey = dayKey(new Date(), club.timeZone);
  const offset = Math.max(-52, Math.min(52, Number(query.uge ?? 0) || 0));
  const monday = (() => { const d = new Date(`${todayKey}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow + offset * 7); return d.toISOString().slice(0, 10); })();
  const keys = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${monday}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const start = wallTime(keys[0], 0, 0, club.timeZone)!, end = new Date(wallTime(keys[6], 0, 0, club.timeZone)!.getTime() + 86_400_000);
  const shifts = await db.staffShift.findMany({ where: { clubId: club.id, startsAt: { gte: start, lt: end } }, orderBy: { startsAt: 'asc' } });
  const staff = await db.staffMember.findMany({ where: { clubId: club.id }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  const people = [...new Set([...staff.filter((s) => s.active).map((s) => s.name), ...(await db.staffShift.findMany({ where: { clubId: club.id }, select: { personName: true }, distinct: ['personName'], take: 50 })).map((p) => p.personName)])];
  const { timeEntriesBetween, payrollPreview, onTheClock } = await import('../../lib/payroll');
  const { workedMinutes } = await import('../../lib/payroll-core');
  const weekEntries = await timeEntriesBetween(club.id, start, end);
  const scheduledMinutes: Record<string, number> = {};
  for (const sft of shifts) scheduledMinutes[sft.personName] = (scheduledMinutes[sft.personName] ?? 0) + Math.round((sft.endsAt.getTime() - sft.startsAt.getTime()) / 60_000);
  // Pay period: the query's range, else the two weeks ending with this week.
  const dayOf = (k: string) => k;
  const periodFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(query.fra ?? '')) ? String(query.fra) : (() => { const d = new Date(`${keys[0]}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); })();
  const periodTo = /^\d{4}-\d{2}-\d{2}$/.test(String(query.til ?? '')) ? String(query.til) : dayOf(keys[6]);
  const pStart = wallTime(periodFrom, 0, 0, club.timeZone)!, pEnd = new Date(wallTime(periodTo, 0, 0, club.timeZone)!.getTime() + 86_400_000);
  const [{ lines: preview, unpaidOpen }, onClock, runs] = await Promise.all([payrollPreview(club.id, pStart, pEnd, club.timeZone), onTheClock(club.id), db.payrollRun.findMany({ where: { clubId: club.id }, orderBy: { periodStart: 'desc' }, take: 24 })]);
  const payroll = { staff, currency: club.currency, onClock: onClock.length, clockUrl: `/clubs/${club.slug}/clock`, period: { from: periodFrom, to: periodTo }, preview, unpaidOpen, scheduledMinutes,
    entries: weekEntries.map((e) => ({ id: e.id, staffId: e.staffId, name: e.staff.name, clockIn: e.clockIn, clockOut: e.clockOut, breakMinutes: e.breakMinutes, minutes: workedMinutes(e), note: e.note, source: e.source, locked: Boolean(e.payrollRunId) })),
    runs: runs.map((r) => ({ id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd, totalCents: r.totalCents, currency: r.currency, people: (JSON.parse(r.lines) as unknown[]).length, createdAt: r.createdAt })) };
  return <StaffPanel weekStart={start} prevHref={`/admin/vagtplan?uge=${offset - 1}`} nextHref={`/admin/vagtplan?uge=${offset + 1}`} people={people} payroll={payroll}
    days={keys.map((k) => ({ key: k, date: wallTime(k, 12, 0, club.timeZone)!, shifts: shifts.filter((s) => dayKey(s.startsAt, club.timeZone) === k) }))} />;
})()}
{section === 'hold' && <>
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("S\xE6sonhold")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Tr\xE6ningshold over en s\xE6son. Medlemmerne tilmelder sig fra jeres side og betaler online. Pengene g\xE5r til klubbens konto.")}


                </p>
        <TeamForm
                  teams={seasonTeams.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    dayOfWeek: t.dayOfWeek,
                    hour: t.hour,
                    fromDate: t.fromDate,
                    toDate: t.toDate,
                    priceKr: t.priceKr,
                    capacity: t.capacity,
                    active: t.active,
                    paid: t._count.signups
                  }))}
                  locale={prefs.locale} />

      </section>
</>}
{section === 'nyheder' && <>
<section>
        <h2 className="display mb-1 text-2xl">{tr("Nyheder")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Vises \xF8verst p\xE5 jeres side. Til lukkedage, turneringer og andet, folk skal vide.")}


                </p>
        <PostForm />

        {club.posts.length > 0 &&
                <ul className="mt-4 space-y-2">
            {club.posts.map((post: any) =>
                  <li key={post.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {post.pinned && <span className="text-court">★ </span>}
                    {post.title}
                  </p>
                  <p className="text-xs text-slate">
                    {formatDate(post.createdAt,prefs.locale,club.timeZone,{dateStyle:"long"})}
                  </p>
                </div>
                <form action={deletePost}>
                  <input type="hidden" name="id" value={post.id} />
                  <button className="text-sm text-slate underline">{tr("Slet")}</button>
                </form>
              </li>
                  )}
          </ul>
                }
      </section>
</>}
{section === 'baner' && <>
<section id="sportsgrene">
        <h2 className="display mb-1 text-2xl">{tr(facilityLabel(selectedSports))}</h2>
        <p className="mb-4 text-sm text-slate">{tr("V\xE6lg sportsgrene, og opret klubbens")}
                  {tr(facilityLabel(selectedSports)).toLowerCase()}{tr("med egne navne, underlag og priser.")}
                </p>
        <CourtForm
                  sports={selectedSports}
                  courts={club.courts.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    sport: c.sport,
                    surface: c.surface,
                    indoor: c.indoor,
                    priceHour: c.priceHour,
                    memberPriceHour: c.memberPriceHour,
                    bookings: c._count?.bookings ?? 0
                  }))} />

      </section>
</>}
{section === 'lys-adgang' && <>
<ManualLights channels={await db.clubControlChannel.findMany({ where: { device: { control: { clubId: club.id, enabled: true } }, kind: { in: ['COURT_LIGHT', 'COMMON_LIGHT'] }, setupConfirmedAt: { not: null } }, select: { id: true, label: true } })} />
<section>
        <h2 className="display mb-1 text-2xl">{tr("Automatisk lys og adgang")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Knyt klubbens Shelly-controllere til de bookbare omr\xE5der og d\xF8ren. RacketBuddy t\xE6nder lyset ud fra bookingerne, og spilleren kan kun \xE5bne d\xF8ren i tidsvinduet omkring sin egen bekr\xE6ftede booking.")}



                </p>
        <ClubControlPanel
                  courts={club.courts.map((court: any) => ({ id: court.id, name: court.name }))}
                  control={clubControl ? {
                    enabled: clubControl.enabled,
                    serverUrl: clubControl.serverUrl,
                    hasAuthKey: Boolean(clubControl.authKeyCipher),
                    accessBeforeMinutes: clubControl.accessBeforeMinutes,
                    accessAfterMinutes: clubControl.accessAfterMinutes,
                    doorPulseSeconds: clubControl.doorPulseSeconds,
                    lightsBeforeMinutes: clubControl.lightsBeforeMinutes,
                    lightsAfterMinutes: clubControl.lightsAfterMinutes,
                    lastCheckedAt: clubControl.lastCheckedAt?.toISOString() ?? null,
                    lastOkAt: clubControl.lastOkAt?.toISOString() ?? null,
                    lastError: clubControl.lastError,
                    devices: clubControl.devices.map((device: any) => ({
                      id: device.id,
                      name: device.name,
                      externalId: device.externalId,
                      model: device.model,
                      channelCount: device.channelCount,
                      online: device.online,
                      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
                      channels: device.channels.map((channel: any) => ({
                        id: channel.id,
                        channel: channel.channel,
                        kind: channel.kind,
                        label: channel.label,
                        courtId: channel.courtId,
                        lastState: channel.lastState,
                        lastCommandAt: channel.lastCommandAt?.toISOString() ?? null,
                        setupTestedAt: channel.setupTestedAt?.toISOString() ?? null,
                        setupConfirmedAt: channel.setupConfirmedAt?.toISOString() ?? null,
                        lastError: channel.lastError
                      }))
                    }))
                  } : null} />

      </section>
{await (async () => {
  const { ensureAccessSettings, accessApiKey, listCredentials, recentAccessEvents, kisiLocksForClub } = await import('../../lib/access');
  const { settingsSnapshot } = await import('../../lib/settings');
  const [settings, apiKey, creds, events, staff] = await Promise.all([ensureAccessSettings(club.id), accessApiKey(club.id), listCredentials(club.id), recentAccessEvents(club.id), db.staffMember.findMany({ where: { clubId: club.id, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })]);
  const kisiLocks = settings.kisiApiKeyCipher ? await kisiLocksForClub(club.id) : [];
  return <AccessPanel apiKey={apiKey} checkUrl={`${settingsSnapshot().appUrl}/api/access/check`} staff={staff} kisiLocks={kisiLocks.map((l) => ({ id: String(l.id), name: l.name, online: l.online }))}
    settings={{ beforeMinutes: settings.beforeMinutes, afterMinutes: settings.afterMinutes, memberWithoutBooking: settings.memberWithoutBooking, memberFromHour: settings.memberFromHour, memberUntilHour: settings.memberUntilHour, kisiConnected: Boolean(settings.kisiApiKeyCipher), kisiLockId: settings.kisiLockId, kisiLockName: settings.kisiLockName, kisiPlaceName: settings.kisiPlaceName }}
    credentials={creds.map((c) => ({ id: c.id, label: c.label, kind: c.kind, uidTail: c.uidTail, active: c.active, validUntil: c.validUntil, lastUsedAt: c.lastUsedAt, holder: c.staff?.name ?? c.user?.name ?? '?', holderKind: c.staffId ? 'staff' as const : 'member' as const }))}
    events={events.map((e) => ({ id: e.id, at: e.at, uidTail: e.uidTail, door: e.door, allowed: e.allowed, reason: e.reason, source: e.source, who: e.credential?.staff?.name ?? e.credential?.user?.name ?? null }))} />;
})()}
</>}
{section === 'priser' && <>
<WalletForm enabled={club.walletEnabled} tiers={JSON.parse(club.walletTiers || '[]')} />
<WalletBalances clubId={club.id} locale={prefs.locale} />
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Priser efter tidspunkt")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Prime time koster mere. Uden regler her g\xE6lder banens pris, og har banen ingen, g\xE6lder klubbens.")}


                </p>
        <PriceRuleForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  rules={priceRules as any} />

      </section>
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Klippekort")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Flere banetimer betalt p\xE5 \xE9n gang. Klippet tr\xE6kkes automatisk, n\xE5r medlemmet booker \u2014 i stedet for en betaling.")}


                </p>
        <PunchCardForm cards={punchCards as any} />
      </section>
</>}
{section === 'betaling' && <>
{stripeOn &&
              <section className="card">
          <p className="display text-xl">{tr("Udbetalinger")}</p>
          {club.stripeChargesEnabled ?
                <p className="mt-2 text-sm">
              <span className="font-bold text-court">{tr("Aktivt.")}</span>{tr("G\xE6ster kan betale, og pengene sendes automatisk til jeres konto minus vores andel.")}

                </p> :

                <>
              <p className="mt-2 rounded-xl border border-court/30 bg-court/5 p-3 text-sm font-semibold">{tr("G\xE6ster kan ikke booke hos jer endnu. Jeres tider vises, men en booking afvises, indtil dette er p\xE5 plads.")}


                  </p>
              <p className="mt-2 text-sm text-slate">{tr("Stripe beder om klubbens virksomhedsform, registreringsoplysninger, identitet og bankkonto. Kravene afhænger af jeres land.")}



                  </p>
              <form action={startClubPayoutSetup} className="mt-3">
                <SubmitButton pendingText={tr("\xC5bner Stripe\u2026")}>
                  {club.stripeAccountId ? tr("Fortsæt opsætning") : tr("Sæt udbetalinger op")}
                </SubmitButton>
              </form>
            </>
                }
        </section>
              }
<section className="card">
        <p className="display text-xl">{tr("Jeres aftale")}</p>
        <>
          <>
            <p className="mt-2">
              <span className="font-bold">{formatMoney(club.subscriptionKr,club.billingCurrency,prefs.locale)}/{club.subscriptionInterval === "YEAR" ? tr("år") : tr("måned")}</span>{" "}{tr("I beholder hele bel\xF8bet for hver g\xE6stebooking.")}

                    </p>
            <p className="mt-1 text-sm text-slate">{tr("Tider kan kun frigives, mens abonnementet er aktivt. Bookinger, en g\xE6st har betalt for, st\xE5r ved magt uanset hvad.")}


                    </p>
            <p className="mt-1 text-sm text-slate">{tr("Fast pris uanset hvor mange bookinger der kommer ind. Vi tager intet af den enkelte booking \u2014 hele bel\xF8bet g\xE5r til jer.")}


                    </p>

            {subscriptionIsActive(club) ?
                    <>
                <p className="mt-3 text-sm">
                  <span className="font-bold text-court">{tr("Betaling aktiv.")}</span>{" "}
                  {club.subscriptionRenewsAt ?
                        tr("Fornyes {date}.",{date:formatDate(club.subscriptionRenewsAt,prefs.locale,club.timeZone,{day:"numeric",month:"long"})}) :
                        tr("Fornyes automatisk hver måned.")}
                </p>
                {query.abonnement === "aarlig" && <p role="status" className="mt-2 text-sm font-semibold text-success">{tr("I er skiftet til årlig betaling. Forskellen for resten af perioden er opkrævet nu.")}</p>}
                {query.abonnement === "maanedlig" && <p role="status" className="mt-2 text-sm font-semibold text-success">{tr("I er skiftet til månedlig betaling.")}</p>}
                {query.abonnement === "skift-fejl" && <p role="alert" className="mt-2 text-sm font-semibold text-[#a2401c]">{tr("Skiftet kunne ikke gennemføres. Prøv igen, eller skriv til support@racketbuddy.app.")}</p>}
                {club.subscriptionInterval !== "YEAR" ? (
                  <form action={switchToAnnual} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-mist p-3">
                    <input type="hidden" name="interval" value="YEAR" />
                    <p className="flex-1 text-sm">{tr("Betal årligt og spar to måneder: {price} om året i stedet for {monthly} om måneden.", { price: formatMoney(annualPrice, club.billingCurrency, prefs.locale), monthly: formatMoney(monthlyPrice, club.billingCurrency, prefs.locale) })}</p>
                    <SubmitButton className="btn-court" pendingText={tr("Skifter\u2026")}>{tr("Skift til årlig betaling")}</SubmitButton>
                  </form>
                ) : (
                  <form action={switchToAnnual} className="mt-3 text-sm text-slate">
                    <input type="hidden" name="interval" value="MONTH" />
                    {tr("I betaler årligt.")}{" "}<SubmitButton className="font-semibold text-court underline-offset-2 hover:underline" pendingText="…">{tr("Skift tilbage til månedlig")}</SubmitButton>
                  </form>
                )}
              </> :

                    <>
                <p className="mt-3 text-sm">
                  <span className="font-bold text-court-dark">
                    {club.subscriptionStatus === "past_due" || club.subscriptionStatus === "unpaid" ?
                          tr("Betalingen fejlede.") :
                          club.subscriptionStatus === "canceled" ?
                          tr("Abonnementet er opsagt.") :
                          tr("Abonnementet er ikke startet.")}
                  </span>{" "}{club.signupManaged ? tr("Opdatér betalingskortet i betalingsportalen. Klubben vises igen, når betalingen er bekræftet.") : <>{tr("Indtil det betales, tr\xE6kkes")}{pct}{tr("% af hver g\xE6stebooking i stedet.")}</>}
                      </p>
                {(!club.subscriptionId || ['canceled','incomplete_expired'].includes(club.subscriptionStatus??'')) && <form action={startClubSubscription} className="mt-3">
                  <SubmitButton pendingText={tr("\xC5bner Stripe\u2026")}>
                    {club.stripeCustomerId ? tr("Forny betaling") : tr("Start abonnement")}
                  </SubmitButton>
                </form>}
              </>
                    }
          </>
        </>
        {club.stripeCustomerId && <form action={openClubBillingPortal} className="mt-3"><SubmitButton className="btn-ghost" pendingText={tr("Åbner Stripe…")}>{tr("Kort, fakturaer og opsigelse")}</SubmitButton></form>}
        <p className="mt-3 text-sm text-slate">{tr("Vil I skifte model, s\xE5 skriv til os.")}

                </p>
      </section>
</>}
{section === 'betaling' && <ClubInvoices clubId={club.id} locale={prefs.locale} timeZone={club.timeZone}/>}
{section === 'integrationer' && <>
{clubHasFeature(club.solutionMode, club.customFeatures, 'import') && <><ResasportsForm courts={club.courts.map((c) => ({ id: c.id, name: c.name }))} /><ImportForm /></>}
<section>
        <h2 className="display mb-1 text-2xl">{tr("S\xE5dan finder vi jeres ledige tider")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("I beholder jeres eget bookingsystem. V\xE6lg hvordan vi skal vide, hvad der er ledigt.")}

                </p>
        <IntegrationForm
                  integrationType={club.integrationType}
                  icalUrl={club.icalUrl ?? ""}
                  externalSystem={club.externalSystem ?? ""} />


        {club.integrationType === "ICAL" &&
                <div className="card mt-4">
            <p className="font-bold">{tr("Synkronisering")}</p>
            <p className="mt-1 text-sm text-slate">
              {club.lastSyncAt ?
                    tr("Sidst hentet {date}.",{date:formatDate(club.lastSyncAt,prefs.locale,club.timeZone,{dateStyle:"medium",timeStyle:"short"})}) :
                    tr("Feed er ikke hentet endnu.")}
            </p>
            {club.lastSyncError &&
                  <p className="mt-2 text-sm font-semibold text-court">{tr(club.lastSyncError)}</p>
                  }
            <form action={syncNow} className="mt-3">
              <button className="btn-ink">{tr("Synkronis\xE9r nu")}</button>
            </form>
          </div>
                }
      </section>
{club.integrationType !== "NATIVE" &&
              <section className="card">
          <h2 className="display mb-1 text-2xl">{tr("Lad os sp\xE6rre tiderne i")}
                  {club.externalSystem ?? tr("jeres system")}
          </h2>
          <p className="mb-4 text-sm text-slate">{tr("Giver I os et login, sp\xE6rrer vi selv de tider, I frigiver \u2014 s\xE5 skal I ikke g\xF8re det i h\xE5nden hver gang.")}


                </p>
          <SystemLoginForm
                  system={club.externalSystem ?? tr("jeres system")}
                  saved={systemLogin ? { baseUrl: systemLogin.baseUrl, username: systemLogin.username } : null}
                  lastOkAt={systemLogin?.lastOkAt ?? null}
                  lastError={systemLogin?.lastError ?? null}
                  summary={systemLogin ? blocks : null} />

        </section>
              }
</>}
{section === 'hjemmeside' && <>
<section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl">{tr("Jeres side")}</h2>
          <Link href={`/clubs/${club.slug}`} className="text-sm font-semibold text-court underline">{tr("Se den som g\xE6sterne g\xF8r")}

                  </Link>
        </div>
        <p className="mb-4 text-sm text-slate">{tr("Bruger I os som jeres eneste system, er det her jeres hjemmeside.")}

                </p>
        <ImageForms
                  logoId={club.logoId}
                  heroId={club.heroId}
                  photos={club.images.
                  filter((i: any) => i.kind === "PHOTO").
                  map((i: any) => ({ id: i.id, alt: i.alt }))} />


        <div className="mt-4">
          <SiteForm club={club} />
        </div>

        <div className="card mt-4">
          <p className="font-bold">{tr("Udseende")}</p>
          <p className="mt-1 text-sm text-slate">{tr("Tre m\xE5der at vise klubben p\xE5. Skift frit \u2014 det \xE6ndrer kun forsiden, ikke indholdet.")}


                  </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
                    ["KLASSISK", "Klassisk", "Farvet hoved med banemotiv"],
                    ["MARKANT", "Markant", "Mørkt hoved, stort klubnavn"],
                    ["ENKEL", "Enkel", "Lyst og roligt"]].
                    map(([value, label, hint]) =>
                    <form action={setTheme} key={value}>
                <input type="hidden" name="theme" value={value} />
                <button
                        className={`rounded-xl border px-4 py-3 text-left ${
                        club.theme === value ?
                        "border-court bg-court/5" :
                        "border-slate/20"}`
                        }>

                  <span className="block font-semibold">{tr(label)}</span>
                  <span className="block text-xs text-slate">{tr(hint)}</span>
                </button>
              </form>
                    )}
          </div>
        </div>

        <div className="card mt-4">
          <p className="font-bold">{tr("Eget dom\xE6ne")}</p>
          <p className="mt-1 text-sm text-slate">{tr("Jeres side kan ligge p\xE5 klubbens eget dom\xE6ne i stedet for hos os. S\xE5 st\xE5r der jerklub.dk i adresselinjen, og vores navigation vises ikke.")}



                  </p>
          <div className="mt-4">
            <DomainForm
                      clubId={club.id}
                      domain={club.customDomain}
                      status={club.domainStatus} />

          </div>
        </div>
        <p className="mt-2 text-xs text-slate">{tr("Laver I en ny kode, holder den gamle op med at virke. Medlemmer der allerede er meldt ind, bliver ved med at v\xE6re det.")}


                </p>
      </section>
</>}
{section === 'indstillinger' && <>
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Hvem kan administrere klubben")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("\xC9n person med n\xF8glen er \xE9n person for lidt. Stopper vedkommende i bestyrelsen, mister klubben adgangen til sine egne bookinger og indt\xE6gter.")}



                </p>
        <InternationalForm club={club} locale={prefs.locale} /><AdminsForm
                  meId={user.id}
                  members={club.members.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    isAdmin: m.role === "CLUB_ADMIN"
                  }))} />

      </section>
{clubHasFeature(club.solutionMode, club.customFeatures, 'hjemmeside') && <section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Bestyrelse og kontaktpersoner")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Vises p\xE5 jeres side under Kontakt. I vedligeholder den selv \u2014 der skal ikke sendes en mail til os, n\xE5r kassereren skifter.")}


                </p>
        <PeopleForm people={club.people as any} />
      </section>}
</>}
{section === 'tider' && club.integrationType !== 'MANUAL' && <div className="card"><p>{tr("Ledige tider styres gennem klubbens bookingsystem.")}</p><Link href="/admin/integrationer" className="font-semibold text-court underline">{tr("\xC5bn bookingsystemets indstillinger")}</Link></div>}
</div></div></div></InternationalProvider>);

}
