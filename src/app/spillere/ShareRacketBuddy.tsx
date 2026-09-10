"use client";

import { useState } from "react";

const SHARE_URL = "https://racketbuddy.app";
const SHARE_TEXT = "Kom med på RacketBuddy – find spillere på dit niveau til tennis, padel, badminton og andre racketsportsgrene.";

export function ShareRacketBuddy() {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "RacketBuddy",
          text: SHARE_TEXT,
          url: SHARE_URL,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Kopiér linket og del det med en ven:", SHARE_URL);
    }
  }

  return (
    <div className="card mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-bold">Mangler du nogen at spille med?</p>
        <p className="mt-1 text-sm text-slate/60">
          Invitér en ven til RacketBuddy – jo flere spillere, jo nemmere er det at finde et godt match.
        </p>
      </div>
      <button type="button" onClick={share} className="btn-court shrink-0 px-4 py-2.5">
        {copied ? "Link kopieret ✓" : "Del RacketBuddy med en ven"}
      </button>
    </div>
  );
}
