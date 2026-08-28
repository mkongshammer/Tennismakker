import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function KlubberPage() {
  const clubs = await db.club.findMany({
    include: { _count: { select: { courts: true, members: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="display text-3xl">Klubber</h1>
        <p className="text-net/70">Klubber på Tennis Makker med online banebooking.</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {clubs.map((c) => (
          <li key={c.id} className="card">
            <p className="text-lg font-bold">{c.name}</p>
            <p className="text-sm text-net/60">{c.city}</p>
            <p className="mt-2 text-sm">
              {c._count.courts} baner · {c.priceHour} kr/time · {c._count.members} medlemmer
            </p>
            <Link href={`/klub/${c.slug}`} className="btn-bane mt-4">Se klub og book bane</Link>
          </li>
        ))}
      </ul>

      <div className="card mt-10 border-grus/30 bg-grus/5">
        <p className="display text-xl text-grus-deep">Mangler din klub?</p>
        <p className="mt-1 text-sm">
          Tennis Makker giver klubben en færdig hjemmeside, banebooking og betaling
          uden opsætningsarbejde. Skriv til os, så sætter vi en pilot op.
        </p>
      </div>
    </div>
  );
}
