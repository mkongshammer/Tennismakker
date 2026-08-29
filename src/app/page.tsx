import Link from "next/link";
import { db } from "../lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [players, coaches, clubs] = await Promise.all([
    db.user.count({ where: { role: "PLAYER" } }),
    db.coachProfile.count(),
    db.club.count(),
  ]);

  return (
    <div className="space-y-14">
      {/* Hero: banen som scene */}
      <section className="relative overflow-hidden rounded-xl bg-grus px-5 py-10 text-kridt sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 chalk-line" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-kridt/80">
            Dansk tennis, samlet ét sted
          </p>
          <h1 className="display text-3xl leading-tight sm:text-6xl">
            Find din næste modstander, træner eller banetid
          </h1>
          <p className="mt-4 max-w-xl text-lg text-kridt/90">
            Tennis Makker matcher dig med spillere på dit niveau, lader dig booke
            certificerede trænere, og giver din klub banebooking med betaling —
            uden papirlister og forældede systemer.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/spillere" className="btn w-full text-center bg-kridt text-grus-deep hover:bg-white sm:w-auto">
              Find en makker
            </Link>
            <Link href="/klubber" className="btn w-full text-center border-2 border-kridt text-kridt hover:bg-kridt/10 sm:w-auto">
              Book en bane
            </Link>
          </div>
        </div>
      </section>

      {/* De tre moduler */}
      <section className="grid gap-6 sm:grid-cols-3">
        <Link href="/spillere" className="card hover:border-grus">
          <p className="display text-2xl text-grus">Makkere</p>
          <p className="mt-2 text-sm text-net/70">
            Se spillere på dit niveau i dit område, én ad gangen. Siger I begge
            ja, åbner der en samtale.
          </p>
          <p className="mt-4 text-sm font-bold">{players} spillere på platformen</p>
        </Link>
        <Link href="/traenere" className="card hover:border-grus">
          <p className="display text-2xl text-grus">Trænere</p>
          <p className="mt-2 text-sm text-net/70">
            Se pris, specialer og ledige tider — book og betal med det samme.
          </p>
          <p className="mt-4 text-sm font-bold">{coaches} trænere klar til booking</p>
        </Link>
        <Link href="/klubber" className="card hover:border-grus">
          <p className="display text-2xl text-grus">Klubber</p>
          <p className="mt-2 text-sm text-net/70">
            Klubside, banebooking og betaling ud af boksen. Plug-n-play for
            bestyrelsen, nemt for medlemmerne.
          </p>
          <p className="mt-4 text-sm font-bold">{clubs} klubber er med</p>
        </Link>
      </section>

      {/* Klub-pitch */}
      <section className="rounded-xl bg-bane px-5 py-8 text-kridt sm:px-12 sm:py-10">
        <h2 className="display text-3xl">Sidder du i en klubbestyrelse?</h2>
        <p className="mt-3 max-w-2xl text-kridt/85">
          Få en færdig klub-hjemmeside med banebooking og MobilePay/kort-betaling
          på under en uge — og et netværk af spillere og trænere i jeres område
          med i købet. Ingen bindingsperiode under piloten.
        </p>
        <Link href="/signup" className="btn-grus mt-5">Kontakt os om en pilot</Link>
      </section>
    </div>
  );
}
