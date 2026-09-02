"use client";

// Formularen på opsætningssiden.
//
// To ting er værd at vide om den:
//
// 1. Hemmeligheder sendes aldrig ud til browseren. Feltet står tomt med et
//    maskeret spor af den nuværende nøgle i pladsholderen, og et tomt felt
//    betyder "behold den, der står". Man kan altså gemme siden uden at have
//    nøglen ved hånden.
// 2. Provisionen regnes om, mens man skriver. Satsen er let at taste forkert,
//    og forskellen mellem 10 og 1 procent ses hurtigere på kronebeløbene end
//    på tallet i feltet.

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "../../../components/SubmitButton";
import { updatePlatformSettings, resetPlatformSettings } from "./actions";
import type { Source } from "../../../lib/settings";

type Props = {
  values: {
    paymentProvider: "stripe" | "mock";
    commissionPct: number;
    appUrl: string;
    emailFrom: string;
    ordersEmail: string;
  };
  secrets: {
    stripeSecretKey: { set: boolean; hint: string };
    stripeWebhookSecret: { set: boolean; hint: string };
    emailApiKey: { set: boolean; hint: string };
  };
  source: Record<string, Source>;
  anyFromDatabase: boolean;
};

function Origin({ source }: { source: Source }) {
  if (source === "database") return null; // det normale — ingen grund til at sige noget
  return (
    <span className="ml-2 text-xs text-slate-light">
      {source === "miljø" ? "sat på serveren" : "standardværdi"}
    </span>
  );
}

function Field({
  label,
  help,
  source,
  children,
}: {
  label: string;
  help?: string;
  source?: Source;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">
        {label}
        {source ? <Origin source={source} /> : null}
      </span>
      {children}
      {help ? <span className="mt-1 block text-xs text-slate">{help}</span> : null}
    </label>
  );
}

export function SettingsForm({ values, secrets, source, anyFromDatabase }: Props) {
  const [state, action] = useFormState(updatePlatformSettings, null);
  const [pct, setPct] = useState(String(Math.round(values.commissionPct * 1000) / 10));
  const [provider, setProvider] = useState(values.paymentProvider);

  const rate = Number(pct.replace(",", ".")) / 100;
  const examples = [100, 150, 250].map((price) => {
    const fee = Number.isFinite(rate) ? Math.round(price * rate) : 0;
    const stripeFee = Math.round((price * 0.015 + 1.8) * 100) / 100;
    return { price, fee, club: price - fee, net: Math.round((fee - stripeFee) * 100) / 100 };
  });

  return (
    <form action={action} className="space-y-8">
      <section className="card space-y-4">
        <h2 className="display text-2xl">Betalinger</h2>

        <div className="space-y-2">
          <span className="text-sm font-bold">
            Tilstand
            <Origin source={source.paymentProvider} />
          </span>
          {(
            [
              ["mock", "Test", "Bookinger bekræftes med det samme. Ingen bliver trukket penge."],
              ["stripe", "Rigtige betalinger", "Gæster betaler med kort, og pengene deles automatisk."],
            ] as const
          ).map(([value, title, note]) => (
            <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-slate/15 p-3">
              <input
                type="radio"
                name="paymentProvider"
                value={value}
                checked={provider === value}
                onChange={() => setProvider(value)}
                className="mt-1"
              />
              <span>
                <span className="block font-bold">{title}</span>
                <span className="block text-xs text-slate">{note}</span>
              </span>
            </label>
          ))}
        </div>

        <Field
          label="Stripes hemmelige nøgle"
          source={source.stripeSecretKey}
          help={
            secrets.stripeSecretKey.set
              ? "Lad feltet stå tomt for at beholde den nuværende nøgle."
              : "Findes i Stripe under Udviklere → API-nøgler. Begynder med sk_."
          }
        >
          <input
            type="password"
            name="stripeSecretKey"
            autoComplete="off"
            placeholder={secrets.stripeSecretKey.hint || "sk_live_…"}
            className="input mt-1"
          />
          <input type="hidden" name="hasStripeSecretKey" value={secrets.stripeSecretKey.set ? "1" : "0"} />
        </Field>

        <Field
          label="Webhook-hemmelighed"
          source={source.stripeWebhookSecret}
          help={
            secrets.stripeWebhookSecret.set
              ? "Lad feltet stå tomt for at beholde den nuværende. Uden den bliver ingen booking bekræftet."
              : "Findes i Stripe under Udviklere → Webhooks, når endepunktet er tilføjet. Begynder med whsec_."
          }
        >
          <input
            type="password"
            name="stripeWebhookSecret"
            autoComplete="off"
            placeholder={secrets.stripeWebhookSecret.hint || "whsec_…"}
            className="input mt-1"
          />
        </Field>

        <Field
          label="Vores andel"
          source={source.commissionPct}
          help="Procent af hver booking. Stripes eget gebyr trækkes fra vores andel, ikke klubbens."
        >
          <div className="mt-1 flex items-center gap-2">
            <input
              name="commissionPct"
              inputMode="decimal"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="input w-24"
            />
            <span className="text-slate">%</span>
          </div>
        </Field>

        <div className="rounded-xl bg-mist p-3">
          <p className="text-xs font-bold text-slate">Sådan deles pengene</p>
          <ul className="mt-2 space-y-1 text-sm">
            {examples.map((e) => (
              <li key={e.price} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold">{e.price} kr</span>
                <span className="text-slate">
                  klub {e.club} kr · os {e.fee} kr
                </span>
                <span className={e.net > 0 ? "ml-auto text-court" : "ml-auto text-court-dark"}>
                  {e.net > 0 ? `+${e.net}` : e.net} kr til os efter Stripes gebyr
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="display text-2xl">E-mail</h2>

        <Field
          label="Nøgle til mailudbyderen"
          source={source.emailApiKey}
          help={
            secrets.emailApiKey.set
              ? "Lad feltet stå tomt for at beholde den nuværende nøgle."
              : "Fra Resend. Uden den skrives kvitteringer kun i serverloggen."
          }
        >
          <input
            type="password"
            name="emailApiKey"
            autoComplete="off"
            placeholder={secrets.emailApiKey.hint || "re_…"}
            className="input mt-1"
          />
        </Field>

        <Field
          label="Afsender"
          source={source.emailFrom}
          help="Domænet skal være verificeret hos udbyderen, ellers afvises mailen eller den lander i spam."
        >
          <input name="emailFrom" defaultValue={values.emailFrom} className="input mt-1" />
        </Field>

        <Field
          label="Henvendelser sendes til"
          source={source.ordersEmail}
          help="Klubhenvendelser, hjemmesidebestillinger og selvtestens testmail."
        >
          <input
            name="ordersEmail"
            type="email"
            defaultValue={values.ordersEmail}
            placeholder="dig@eksempel.dk"
            className="input mt-1"
          />
        </Field>
      </section>

      <section className="card space-y-4">
        <h2 className="display text-2xl">Adresse</h2>
        <Field
          label="Appens adresse"
          source={source.appUrl}
          help="Bruges i alle links i mails og ved returnering fra Stripe. Uden skråstreg til sidst."
        >
          <input name="appUrl" defaultValue={values.appUrl} className="input mt-1" />
        </Field>
      </section>

      {state?.error ? (
        <p className="card border border-court-dark/30 text-sm font-semibold text-court-dark">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="card border border-court/30 text-sm font-semibold text-court">{state.ok}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Gemmer…">Gem ændringer</SubmitButton>
        {anyFromDatabase ? (
          <button
            type="submit"
            formAction={resetPlatformSettings}
            className="btn-ghost"
            title="Sletter det, der er gemt her, så serverens egne variabler gælder igen"
          >
            Nulstil til serverens værdier
          </button>
        ) : null}
      </div>
    </form>
  );
}
