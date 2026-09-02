import Link from "next/link";
import { db } from "../../lib/db";
import { coachRatings } from "../../lib/reviews";
import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { SportPicker } from "../../components/SportPicker";
import { Stars } from "../../components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function TraenerePage({
  searchParams,
}: {
  searchParams: { omraade?: string };
}) {
  const prefs = await getPreferences();
  const t = translator(prefs.locale);
  const area = searchParams.omraade?.trim();

  const coaches = await db.coachProfile.findMany({
    where: {
      sports: { contains: prefs.sport },
      ...(area ? { area: { contains: area } } : {}),
    },
    include: { user: true, packages: { where: { active: true } } },
    orderBy: { priceHour: "asc" },
  });

  const ratings = await coachRatings(coaches.map((c: any) => c.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="display text-3xl">{t("coach.title")}</h1>
        <p className="text-slate/70">{t("coach.intro")}</p>
      </div>

      <SportPicker active={prefs.sport} locale={prefs.locale} />

      <form className="card mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="omraade">{t("common.area")}</label>
          <input className="input" id="omraade" name="omraade" defaultValue={area} placeholder="fx Aarhus" />
        </div>
        <button className="btn-ink">{t("common.search")}</button>
      </form>

      {coaches.length === 0 && (
        <div className="card text-center text-slate/60">{t("coach.noneInArea")}</div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {coaches.map((c) => (
          <li key={c.id} className="card">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-bold">{c.user.name}</p>
              <p className="display text-xl text-court">{c.priceHour} kr/t</p>
            </div>
            <div className="mt-1">
              <Stars
                average={ratings.get(c.id)?.average ?? 0}
                count={ratings.get(c.id)?.count ?? 0}
              />
            </div>
            <p className="mt-2 text-sm">{c.headline}</p>
            <p className="mt-1 text-sm text-slate/60">{c.area}</p>
            {c.specialties && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.specialties.split(",").filter(Boolean).map((s) => (
                  <span key={s} className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink">
                    {s.trim()}
                  </span>
                ))}
              </div>
            )}
            {c.packages.length > 0 && (
              <p className="mt-3 text-sm font-semibold text-ink">
                {c.packages.length === 1
                  ? t("coach.alsoOffersOne", { name: c.packages[0].name })
                  : t("coach.alsoOffersMany", { n: c.packages.length })}
              </p>
            )}
            <Link href={`/traenere/${c.id}`} className="btn-court mt-4">
              {t("coach.seeTimes")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
