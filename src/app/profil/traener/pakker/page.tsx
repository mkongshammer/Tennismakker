// Trænerens pakkeforløb.
//
// Eleven betaler hele pakken på én gang, og hver booking hos træneren
// trækker et klip i stedet for en betaling. Provisionen tages af hele
// pakken ved købet — se src/lib/packages.ts.
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { SubmitButton } from "../../../../components/SubmitButton";
import { PackageForm } from "./PackageForm";
import { deactivatePackage } from "./actions";

export const dynamic = "force-dynamic";

export default async function PakkerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.coachProfile) redirect("/profil");

  const [packages, purchases] = await Promise.all([
    db.coachPackage.findMany({
      where: { coachProfileId: user.coachProfile.id },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    }),
    db.packagePurchase.findMany({
      where: { coachProfileId: user.coachProfile.id, status: "PAID" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">Pakkeforløb</h1>
        <p className="text-slate">
          Eleven betaler hele pakken på én gang, og hver time hos dig trækker
          et klip i stedet for en betaling.
        </p>
      </div>

      <PackageForm />

      {packages.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">Dine pakker</h2>
          <ul className="space-y-3">
            {packages.map((p: any) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {p.name}
                    {!p.active && <span className="ml-2 text-xs text-slate-light">slået fra</span>}
                  </p>
                  <p className="text-sm text-slate">
                    {p.sessions} timer · {p.priceKr} kr · {Math.round(p.priceKr / p.sessions)} kr pr. time
                  </p>
                  {p.description && <p className="mt-1 text-sm text-slate">{p.description}</p>}
                </div>
                {p.active && (
                  <form action={deactivatePackage}>
                    <input type="hidden" name="packageId" value={p.id} />
                    <SubmitButton className="btn-ghost" pendingText="Slår fra…">
                      Slå fra
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate">
            En pakke slås fra frem for at blive slettet. Elever, der har købt
            den, har klip tilbage, og de skal ikke forsvinde.
          </p>
        </section>
      )}

      {purchases.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">Solgte pakker</h2>
          <ul className="space-y-2">
            {purchases.map((p: any) => (
              <li key={p.id} className="card flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{p.user.name}</span>
                <span className="text-slate">
                  {p.name} · {p.sessions - p.sessionsUsed} af {p.sessions} timer tilbage
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/profil/traener" className="btn-ghost inline-block">
        Tilbage til profilen
      </Link>
    </div>
  );
}
