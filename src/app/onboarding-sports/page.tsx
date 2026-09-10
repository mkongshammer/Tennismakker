import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { SPORTS, sportLabel } from "../../lib/sports";
import { getPreferences } from "../../lib/preferences";
import { saveSportsAndContinue } from "./actions";

export const dynamic = "force-dynamic";

export default async function OnboardingSportsPage({
  searchParams,
}: {
  searchParams: { fejl?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { locale } = await getPreferences();
  const selected = new Set(
    (user.coachProfile?.sports ?? user.sports ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const coach = user.role === "COACH";

  return (
    <div className="mx-auto max-w-lg">
      <div className="card">
        <h1 className="display text-3xl">
          {coach ? "Hvilke sportsgrene træner du i?" : "Hvilke sportsgrene spiller du?"}
        </h1>
        <p className="mt-2 text-slate">
          {coach
            ? "Vælg alle de sportsgrene, du vil tilbyde træning i på RacketBuddy. Du kan vælge flere."
            : "Vælg de sportsgrene, du gerne vil finde medspillere til. Du kan vælge flere."}
        </p>

        {searchParams.fejl && (
          <p className="mt-4 rounded-xl border border-court/20 bg-court/5 p-3 text-sm font-semibold text-court-dark">
            {searchParams.fejl}
          </p>
        )}

        <form action={saveSportsAndContinue} className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SPORTS.map((sport) => (
              <label key={sport} className="flex items-center gap-2 rounded-xl border border-slate/15 p-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  name="sports"
                  value={sport}
                  defaultChecked={selected.has(sport)}
                />
                {sportLabel(sport, locale)}
              </label>
            ))}
          </div>
          <button className="btn-court w-full">Gem sportsgrene</button>
        </form>
      </div>
    </div>
  );
}
