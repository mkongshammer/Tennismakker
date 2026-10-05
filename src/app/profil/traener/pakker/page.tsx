
import {UiText} from "../../../../components/InternationalProvider";
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
import {getPreferences} from '../../../../lib/preferences';
import {formatMoney} from '../../../../lib/international';

export const dynamic = "force-dynamic";

export default async function PakkerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.coachProfile) redirect("/profil");
  const currency=user.coachProfile.currency;
  const {locale}=await getPreferences();

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
        <h1 className="display text-3xl"><UiText text="Pakkeforløb"/></h1>
        <p className="text-slate"><UiText text="Eleven betaler hele pakken på én gang, og hver time hos dig trækker et klip i stedet for en betaling."/></p>
      </div>

      <PackageForm priceHour={user.coachProfile.priceHour} currency={user.coachProfile.currency} />

      {packages.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl"><UiText text="Dine pakker"/></h2>
          <ul className="space-y-3">
            {packages.map((p: any) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {p.name}
                    {!p.active && <span className="ml-2 text-xs text-slate-light"><UiText text="slået fra"/></span>}
                  </p>
                  <p className="text-sm text-slate">
                    {p.sessions}{" "}<UiText text="timer ·"/>{" "}{formatMoney(p.priceKr,currency,locale)} · {formatMoney(Math.round(p.priceKr / p.sessions),currency,locale)}{" "}<UiText text="pr. time"/></p>
                  {p.description && <p className="mt-1 text-sm text-slate">{p.description}</p>}
                </div>
                {p.active && (
                  <form action={deactivatePackage}>
                    <input type="hidden" name="packageId" value={p.id} />
                    <SubmitButton className="btn-ghost" pendingText="Slår fra…"><UiText text="Slå fra"/></SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate"><UiText text="En pakke slås fra frem for at blive slettet. Elever, der har købt den, har klip tilbage, og de skal ikke forsvinde."/></p>
        </section>
      )}

      {purchases.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl"><UiText text="Solgte pakker"/></h2>
          <ul className="space-y-2">
            {purchases.map((p: any) => (
              <li key={p.id} className="card flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{p.user.name}</span>
                <span className="text-slate">
                  {p.name} · {p.sessions - p.sessionsUsed}{" "}<UiText text="af"/>{" "}{p.sessions}{" "}<UiText text="timer tilbage"/></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/profil/traener" className="btn-ghost inline-block"><UiText text="Tilbage til profilen"/></Link>
    </div>
  );
}
