"use client";
import {UiText} from "./InternationalProvider";


import { useFormState } from "react-dom";
import { SPORTS, sportLabel, type Locale } from "../lib/sports";
import { saveBuddySports } from "../app/onboarding-sports/actions";
import { SubmitButton } from "./SubmitButton";

export function BuddySportsOnboarding({ locale }: { locale: Locale }) {
  const [state, action] = useFormState(saveBuddySports, null);
  const da = locale === "da";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm">
      <form action={action} className="card w-full max-w-lg space-y-5 shadow-2xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-court">
            {da ? <UiText text="Find din næste buddy"/> : <UiText text="Find your next buddy"/>}
          </p>
          <h2 className="display mt-2 text-2xl">
            {da ? <UiText text="Hvilke sportsgrene spiller du?"/> : <UiText text="Which sports do you play?"/>}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate">
            {da
              ? <UiText text="Vælg den eller de sportsgrene, du spiller og gerne vil finde medspillere til. Så viser vi dig de mest relevante buddies og opslag."/>
              : <UiText text="Choose the sports you play and want to find partners for. We’ll use them to show you the most relevant buddies and posts."/>}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SPORTS.map((sport) => (
            <label
              key={sport}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate/15 px-3 py-3 text-sm font-medium hover:border-court/50"
            >
              <input type="checkbox" name="sports" value={sport} />
              <span>{sportLabel(sport, locale)}</span>
            </label>
          ))}
        </div>

        {state?.error ? (
          <p className="text-sm font-semibold text-court-dark">{<UiText text={state.error}/>}</p>
        ) : null}

        <SubmitButton className="btn-court w-full" pendingText={da ? "Gemmer…" : "Saving…"}>
          {da ? <UiText text="Gem mine sportsgrene"/> : <UiText text="Save my sports"/>}
        </SubmitButton>
      </form>
    </div>
  );
}
