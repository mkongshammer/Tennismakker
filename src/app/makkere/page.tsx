import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { respondToMatchPost } from "./actions";
import { LevelBadge } from "../../components/LevelBadge";
import { getPreferences } from "../../lib/preferences";
import { SportPicker } from "../../components/SportPicker";
import { translator } from "../../lib/i18n";
import { LEVELS, MATCH_TYPES } from "../../lib/levels";
import { DK_REGIONS, regionForArea } from "../../lib/regions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function pageHref(page: number, region: string, level: string) {
  const params = new URLSearchParams();
  if (region || level) params.set("filtrer", "1");
  if (region) params.set("region", region);
  if (level) params.set("niveau", level);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/makkere?${query}` : "/makkere";
}

export default async function MakkerePage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; niveau?: string; page?: string; filtrer?: string }>;
}) {
  const query = await searchParams;
  const user = await getCurrentUser();
  const prefs = await getPreferences();
  const t = translator(prefs.locale);
  const hasUserFilters = query.filtrer === "1";
  const selectedRegion = hasUserFilters ? query.region?.trim() ?? "" : "";
  const selectedLevel = hasUserFilters ? query.niveau?.trim() ?? "" : "";
  const level = selectedLevel ? Number(selectedLevel) : undefined;
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const [openRequests, myResponses] = await Promise.all([
    db.matchRequest.findMany({
      where: {
        status: "OPEN",
        source: "POST",
        sport: prefs.sport,
        ...(level && level >= 1 && level <= 7 ? { level } : {}),
      },
      include: { requester: true },
      orderBy: { createdAt: "desc" },
    }),
    user
      ? db.matchRequest.findMany({
          where: {
            acceptedById: user.id,
            source: { startsWith: "POST_RESPONSE:" },
          },
          select: { source: true },
        })
      : Promise.resolve([]),
  ]);

  const respondedPostIds = new Set(
    myResponses
      .map((r) => r.source.replace("POST_RESPONSE:", ""))
      .filter(Boolean)
  );

  const filteredRequests = openRequests.filter((request) => {
    if (request.requesterId !== user?.id && respondedPostIds.has(request.id)) return false;
    if (selectedRegion && regionForArea(request.area) !== selectedRegion) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const requests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl">{t("partners.title")}</h1>
          <div className="mt-3">
            <SportPicker active={prefs.sport} locale={prefs.locale} />
          </div>
          <p className="text-slate/70">{t("partners.intro")}</p>
        </div>
        <Link href="/makkere/ny" className="btn-court">{t("partners.createPost")}</Link>
      </div>

      <form className="card mb-6 flex flex-wrap items-end gap-4">
        <input type="hidden" name="filtrer" value="1" />
        <div>
          <label className="label" htmlFor="region">Region</label>
          <select className="input" id="region" name="region" defaultValue={selectedRegion}>
            <option value="">Alle regioner</option>
            {DK_REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="niveau">Niveau</label>
          <select className="input" id="niveau" name="niveau" defaultValue={selectedLevel}>
            <option value="">Alle niveauer</option>
            {Object.entries(LEVELS).map(([num, item]) => (
              <option key={num} value={num}>{num} — {item.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-ink">{t("common.filter")}</button>
        {(selectedRegion || selectedLevel) && (
          <Link href="/makkere" className="btn-ghost">Nulstil</Link>
        )}
      </form>

      {requests.length === 0 && (
        <div className="card text-center text-slate/60">
          {t("partners.none")}{" "}
          <Link href="/makkere/ny" className="font-semibold text-court underline">{t("partners.createFirst")}</Link>
        </div>
      )}

      <ul className="space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{r.requester.name}</span>
                <LevelBadge level={r.level} />
                <span className="rounded-full bg-court/10 px-2.5 py-0.5 text-xs font-bold text-court-dark">
                  {MATCH_TYPES[r.matchType] ?? r.matchType}
                </span>
              </div>
              <p className="mt-1">{r.message}</p>
              <p className="mt-1 text-sm text-slate/60">
                {regionForArea(r.area) ?? r.area} · {formatDistanceToNow(r.createdAt, { addSuffix: true, locale: da })}
              </p>
            </div>
            {user && user.id !== r.requesterId ? (
              <form action={respondToMatchPost}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn-court">{t("partners.respond")}</button>
              </form>
            ) : !user ? (
              <Link href="/login" className="btn-ghost">{t("partners.loginToRespond")}</Link>
            ) : (
              <span className="text-sm text-slate/50">{t("partners.yours")}</span>
            )}
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Sider">
          {currentPage > 1 && (
            <Link href={pageHref(currentPage - 1, selectedRegion, selectedLevel)} className="btn-ghost px-4 py-2">
              Forrige
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              href={pageHref(page, selectedRegion, selectedLevel)}
              className={page === currentPage
                ? "rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-chalk"
                : "btn-ghost px-4 py-2"}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </Link>
          ))}
          {currentPage < totalPages && (
            <Link href={pageHref(currentPage + 1, selectedRegion, selectedLevel)} className="btn-ghost px-4 py-2">
              Næste
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
