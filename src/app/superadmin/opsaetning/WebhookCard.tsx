"use client";

// Webhookens tilstand, og knappen der retter den.
//
// Knappen findes, fordi alternativet er at oprette endpointet i hånden i
// Stripes panel — hvor det er let at ramme en anden sandkasse end den,
// nøglen hører til, og hvor signeringsnøglen bagefter skal kopieres rigtigt
// over. Appen bruger sin egen nøgle og gemmer den returnerede
// signeringsnøgle i samme kald, så de to per definition passer sammen.

import { useFormState } from "react-dom";
import { SubmitButton } from "../../../components/SubmitButton";
import { createWebhookEndpoint } from "./actions";

const TONE = {
  ok: "text-court",
  advarsel: "text-slate",
  fejl: "text-court-dark",
} as const;

export function WebhookCard({
  state,
}: {
  state: { status: "ok" | "advarsel" | "fejl"; detail: string; fixable: boolean };
}) {
  const [result, action] = useFormState(createWebhookEndpoint, null);

  return (
    <section className="card space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display text-2xl">Webhook</h2>
        <span className={`text-xs font-bold ${TONE[state.status]}`}>
          {state.status === "ok" ? "OK" : state.status === "advarsel" ? "Bemærk" : "Fejl"}
        </span>
      </div>

      <p className="text-sm text-slate">{state.detail}</p>

      {state.status !== "ok" && (
        <p className="text-sm text-slate">
          Uden en webhook, der virker, bliver en booking aldrig bekræftet — selv
          når pengene er trukket. Fejlen siger ingenting af sig selv.
        </p>
      )}

      {result?.ok && (
        <p className="rounded-xl border border-court/30 p-3 text-sm font-semibold text-court">
          {result.ok}
        </p>
      )}
      {result?.error && (
        <p className="rounded-xl border border-court-dark/30 p-3 text-sm font-semibold text-court-dark">
          {result.error}
        </p>
      )}

      {state.fixable && (
        <form action={action}>
          <SubmitButton pendingText="Taler med Stripe…">
            Opret webhooken hos Stripe
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
