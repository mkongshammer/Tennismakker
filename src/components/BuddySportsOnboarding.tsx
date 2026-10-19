"use client";
import {UiText} from "./InternationalProvider";


import { useEffect, useId, useState } from "react";
import { useFormState } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { SPORTS, sportLabel, type Locale } from "../lib/sports";
import { saveBuddySports } from "../app/onboarding-sports/actions";
import { SubmitButton } from "./SubmitButton";

// Where asking about sports helps rather than interrupts: the social
// features, where sports drive matching. Never on the profile (someone who
// just paid is reading their confirmation), on the court or coach pages,
// or on top of a payment result. "Not now" hides it for the rest of the
// browser session; the next visit asks once more.
const PROMPT_PATHS = ["/players", "/matches", "/messages"];
const DISMISS_KEY = "rb_sports_prompt_dismissed";

export function BuddySportsOnboarding({ locale }: { locale: Locale }) {
  const [state, action] = useFormState(saveBuddySports, null);
  const pathname = usePathname();
  const params = useSearchParams();
  const titleId = useId();
  const [dismissed, setDismissed] = useState(true); // render nothing until the client has checked storage
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
  }, []);
  const da = locale === "da";
  if (dismissed) return null;
  if (!PROMPT_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"))) return null;
  if (params.has("betalt") || params.has("betaling") || params.has("afventer")) return null;
  const notNow = () => { try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {} setDismissed(true); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form action={action} className="card w-full max-w-lg space-y-5 shadow-2xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-court">
            {da ? <UiText text="Find din næste buddy"/> : <UiText text="Find your next buddy"/>}
          </p>
          <h2 id={titleId} className="display mt-2 text-2xl">
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
        <button type="button" onClick={notNow} className="btn-ghost w-full">{da ? "Ikke nu" : "Not now"}</button>
      </form>
    </div>
  );
}
