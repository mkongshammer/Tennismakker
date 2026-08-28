import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TraenerePage({
  searchParams,
}: {
  searchParams: { omraade?: string };
}) {
  const area = searchParams.omraade?.trim();
  const coaches = await db.coachProfile.findMany({
    where: area ? { area: { contains: area } } : {},
    include: { user: true },
    orderBy: { priceHour: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="display text-3xl">Trænere</h1>
        <p className="text-net/70">Book en time direkte — betaling sker ved bookingen.</p>
      </div>

      <form className="card mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="omraade">Område</label>
          <input className="input" id="omraade" name="omraade" defaultValue={area} placeholder="fx Aarhus" />
        </div>
        <button className="btn-bane">Søg</button>
      </form>

      {coaches.length === 0 && (
        <div className="card text-center text-net/60">Ingen trænere i det område endnu.</div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {coaches.map((c) => (
          <li key={c.id} className="card">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-bold">{c.user.name}</p>
              <p className="display text-xl text-grus">{c.priceHour} kr/t</p>
            </div>
            <p className="mt-1 text-sm">{c.headline}</p>
            <p className="mt-1 text-sm text-net/60">{c.area}</p>
            {c.specialties && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.specialties.split(",").filter(Boolean).map((s) => (
                  <span key={s} className="rounded-full bg-bane/10 px-2 py-0.5 text-xs font-semibold text-bane">
                    {s.trim()}
                  </span>
                ))}
              </div>
            )}
            <Link href={`/traenere/${c.id}`} className="btn-grus mt-4">
              Se ledige tider
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
