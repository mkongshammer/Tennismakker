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
import { MATCH_TYPES } from "../../lib/levels";

export const dynamic = "force-dynamic";

export default async function MakkerePage({
  searchParams,
}: {
  searchParams: { omraade?: string; niveau?: string };
}) {
  const user = await getCurrentUser();
  const prefs = await getPreferences();
  const t = translator(prefs.locale);
  const area = searchParams.omraade?.trim();
  const level = searchParams.niveau ? Number(searchParams.niveau) : undefined;

  const [openRequests, myResponses] = await Promise.all([
    db.matchRequest.findMany({
      where: {
        status: "OPEN",
        source: "POST",
        sport: prefs.sport,
        ...(area ? { area: { contains: area } } : {}),
        ...(level ? { level: { gte: level - 1, lte: level + 1 } } : {}),
      },
      include: { requester: true },
      orderBy: { createdAt: "desc" },
      take: 50,
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

  const requests = openRequests.filter(
    (r) => r.requesterId === user?.id || !respondedPostIds.has(r.id)
  );

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
        <div>
          <label className="label" htmlFor="omraade">{t("common.area")}</label>
          <input className="input" id="omraade" name="omraade" defaultValue={area} placeholder="fx København" />
        </div>
        <div>
          <label className="label" htmlFor="niveau">{t("partners.yourLevel")}</label>
          <input className="input" id="niveau" name="niveau" type="number" min={1} max={7} defaultValue={searchParams.niveau ?? user?.level ?? ""} />
        </div>
        <button className="btn-ink">{t("common.filter")}</button>
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
                {r.area} · {formatDistanceToNow(r.createdAt, { addSuffix: true, locale: da })}
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
    </div>
  );
}
