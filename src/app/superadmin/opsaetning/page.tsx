// Opsætning af RacketBuddy selv. Kun for platformens ejer.
//
// Modstykket til selvtesten: den svarer på, om tingene virker, og denne side
// er der, hvor man retter dem. Alt, der før krævede en tur forbi Renders
// panel og en genstart, kan ændres her — se src/lib/settings.ts for hvorfor
// og hvordan.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/session";
import { getSettingsWithSource, maskSecret, settingsTableReady } from "../../../lib/settings";
import { SettingsForm } from "./SettingsForm";
import { WebhookCard } from "./WebhookCard";
import { inspectWebhook } from "../../../lib/webhook-setup";

export const dynamic = "force-dynamic";

export default async function OpsaetningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">Ikke adgang</p>
        <p className="mt-1 text-sm text-slate">Denne side er kun for RacketBuddys administratorer.</p>
      </div>
    );
  }

  const [{ settings, source }, tableReady, webhook] = await Promise.all([
    getSettingsWithSource(),
    settingsTableReady(),
    inspectWebhook(),
  ]);

  const anyFromDatabase = Object.values(source).includes("database");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">Opsætning</h1>
        <p className="text-slate">
          Nøgler, provision og adresser for hele platformen. Ændringer gælder
          med det samme, uden genstart.
        </p>
      </div>

      {!tableReady ? (
        <p className="card border border-court-dark/30 text-sm">
          <span className="font-bold text-court-dark">Databasen mangler tabellen til indstillinger.</span>{" "}
          Indtil den er lagt ind, læses værdierne herunder fra serverens
          variabler, og siden kan vise dem, men ikke gemme dem. Kør{" "}
          <code className="font-data text-xs">npx prisma db push</code> mod
          produktionsdatabasen, så virker den.
        </p>
      ) : null}

      <WebhookCard state={webhook} />

      <SettingsForm
        values={{
          paymentProvider: settings.paymentProvider,
          commissionPct: settings.commissionPct,
          appUrl: settings.appUrl,
          emailFrom: settings.emailFrom,
          ordersEmail: settings.ordersEmail,
        }}
        secrets={{
          stripeSecretKey: {
            set: Boolean(settings.stripeSecretKey),
            hint: maskSecret(settings.stripeSecretKey),
          },
          stripeWebhookSecret: {
            set: Boolean(settings.stripeWebhookSecret),
            hint: maskSecret(settings.stripeWebhookSecret),
          },
          emailApiKey: {
            set: Boolean(settings.emailApiKey),
            hint: maskSecret(settings.emailApiKey),
          },
        }}
        source={source}
        anyFromDatabase={anyFromDatabase}
      />

      <div className="card">
        <p className="text-sm font-bold">To ting bliver på serveren</p>
        <p className="mt-1 text-sm text-slate">
          Adgangen til databasen og nøglen, der låser de gemte hemmeligheder op,
          kan ikke ligge i den database, de selv låser op. De to —{" "}
          <code className="font-data text-xs">DATABASE_URL</code> og{" "}
          <code className="font-data text-xs">AUTH_SECRET</code> — rettes fortsat
          hos Render. Alt andet står ovenfor.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/superadmin/selvtest" className="btn-court">
          Kør selvtesten
        </Link>
        <Link href="/superadmin" className="btn-ghost">
          Tilbage
        </Link>
      </div>
    </div>
  );
}
