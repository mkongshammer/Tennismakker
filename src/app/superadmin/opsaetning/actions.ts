"use server";

// Handlingerne bag /superadmin/opsaetning.
//
// Ligger for sig selv frem for i lib/actions.ts: det er det ene sted i
// koden, der kan ændre, hvordan alt andet opfører sig, og det er lettere at
// holde øje med, når det ikke er gemt inde midt i en fil på tusind linjer.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../../lib/session";
import { saveSettings, settingsTableReady, SETTING_KEYS, type SettingKey } from "../../../lib/settings";
import { ensureWebhookEndpoint } from "../../../lib/webhook-setup";

export type SettingsFormState = { error?: string; ok?: string } | null;

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPERADMIN") {
    throw new Error("Kun RacketBuddys administratorer har adgang til dette.");
  }
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function updatePlatformSettings(
  _prev: unknown,
  formData: FormData
): Promise<SettingsFormState> {
  await requireSuperadmin();

  if (!(await settingsTableReady())) {
    return {
      error:
        "Tabellen til indstillinger findes ikke i databasen endnu. Kør `npx prisma db push` mod produktionsdatabasen, og prøv igen.",
    };
  }

  const patch: Partial<Record<SettingKey, string | null>> = {};

  // --- Betalinger ---
  const provider = text(formData, "paymentProvider") === "stripe" ? "stripe" : "mock";
  const stripeKey = text(formData, "stripeSecretKey");
  const hasStripeKey = formData.get("hasStripeSecretKey") === "1";

  if (provider === "stripe" && !stripeKey && !hasStripeKey) {
    return {
      error:
        "Rigtige betalinger kræver en Stripe-nøgle. Indsæt nøglen, eller lad betalinger stå på test.",
    };
  }
  patch.paymentProvider = provider;
  if (stripeKey) patch.stripeSecretKey = stripeKey;

  const webhookSecret = text(formData, "stripeWebhookSecret");
  if (webhookSecret) patch.stripeWebhookSecret = webhookSecret;

  const pctInput = text(formData, "commissionPct").replace(",", ".");
  const pct = Number(pctInput);
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
    return { error: "Provisionen skal være et tal mellem 0 og 50 procent." };
  }
  patch.commissionPct = String(pct / 100);

  // --- Adresse ---
  const appUrl = text(formData, "appUrl").replace(/\/+$/, "");
  if (!/^https?:\/\/.+\..+/.test(appUrl)) {
    return { error: "Adressen skal være en fuld webadresse, fx https://racketbuddy.app." };
  }
  patch.appUrl = appUrl;

  // --- E-mail ---
  const emailKey = text(formData, "emailApiKey");
  if (emailKey) patch.emailApiKey = emailKey;

  const emailFrom = text(formData, "emailFrom");
  if (!emailFrom.includes("@")) {
    return {
      error: "Afsenderen skal indeholde en e-mailadresse, fx RacketBuddy <ikke-svar@racketbuddy.app>.",
    };
  }
  patch.emailFrom = emailFrom;

  const ordersEmail = text(formData, "ordersEmail");
  if (ordersEmail && !ordersEmail.includes("@")) {
    return { error: "Modtageradressen ser ikke ud som en e-mailadresse." };
  }
  patch.ordersEmail = ordersEmail;

  await saveSettings(patch);
  revalidatePath("/superadmin/opsaetning");
  revalidatePath("/superadmin/selvtest");

  return {
    ok:
      provider === "stripe"
        ? "Gemt. Ændringerne gælder med det samme — kør selvtesten, hvis du skiftede en nøgle."
        : "Gemt. Betalinger står på test, så ingen bliver trukket penge.",
  };
}

/**
 * Sletter alle gemte indstillinger, så miljøvariablerne gælder igen.
 * Vejen tilbage, hvis en indtastning har låst noget ude — den kræver ikke,
 * at man kan huske, hvad der stod før.
 */
export async function resetPlatformSettings(): Promise<void> {
  await requireSuperadmin();
  await saveSettings(Object.fromEntries(SETTING_KEYS.map((k) => [k, null])));
  revalidatePath("/superadmin/opsaetning");
  revalidatePath("/superadmin/selvtest");
}

/**
 * Opretter webhooken hos Stripe med den nøgle, appen selv bruger.
 *
 * Findes fordi det ellers skal gøres i hånden i Stripes panel, hvor det er
 * let at ramme den forkerte sandkasse — og hvor signeringsnøglen bagefter
 * skal kopieres korrekt over. Begge dele forsvinder, når appen gør det selv.
 */
export async function createWebhookEndpoint(
  _prev: unknown,
  _formData: FormData
): Promise<SettingsFormState> {
  await requireSuperadmin();
  try {
    const message = await ensureWebhookEndpoint();
    revalidatePath("/superadmin/opsaetning");
    revalidatePath("/superadmin/selvtest");
    return { ok: message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Webhooken kunne ikke oprettes." };
  }
}
