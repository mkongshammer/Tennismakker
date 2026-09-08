"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { getSettings } from "../../../lib/settings";
import { sendMail } from "../../../lib/email";
import {
  CLUB_MODULES,
  getClubCustomConfig,
  getClubIntegrations,
  saveClubCustomConfig,
  saveClubIntegrations,
  type ClubModuleKey,
} from "../../../lib/club-custom";

async function requireClubAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLUB_ADMIN" || !user.clubId) throw new Error("Ikke adgang");
  return user;
}

export async function requestClubModule(formData: FormData) {
  const user = await requireClubAdmin();
  const key = String(formData.get("module") ?? "") as ClubModuleKey;
  const wish = String(formData.get("wish") ?? "").trim().slice(0, 4000);
  if (!CLUB_MODULES.some((m) => m.key === key)) return;

  const config = await getClubCustomConfig(user.clubId);
  config.modules[key] = "REQUESTED";
  config.notes = [config.notes, wish ? `${key}: ${wish}` : ""].filter(Boolean).join("\n");
  await saveClubCustomConfig(user.clubId, config);

  const [club, settings] = await Promise.all([
    db.club.findUnique({ where: { id: user.clubId }, select: { name: true } }),
    getSettings(),
  ]);
  const module = CLUB_MODULES.find((m) => m.key === key)!;

  if (settings.ordersEmail) {
    await sendMail({
      to: settings.ordersEmail,
      subject: `Custom ønske: ${club?.name ?? "Klub"} — ${module.label}`,
      body: [
        `Klub: ${club?.name ?? user.clubId}`,
        `Kontakt: ${user.name} (${user.email})`,
        `Modul: ${module.label}`,
        wish ? `Ønske: ${wish}` : "",
        "",
        `Åbn klubadministrationen og planlæg løsningen oven på RacketBuddy.`,
      ].filter(Boolean).join("\n"),
    });
  }

  revalidatePath("/admin/custom");
}

export async function saveGenericIntegration(formData: FormData) {
  const user = await requireClubAdmin();
  const provider = String(formData.get("provider") ?? "").trim().slice(0, 120);
  const type = String(formData.get("type") ?? "CUSTOM_API").trim().slice(0, 80);
  const endpoint = String(formData.get("endpoint") ?? "").trim().slice(0, 500);
  const accountRef = String(formData.get("accountRef") ?? "").trim().slice(0, 200);
  const apiKey = String(formData.get("apiKey") ?? "").trim().slice(0, 2000);
  if (!provider) return;

  const integrations = await getClubIntegrations(user.clubId);
  const existing = integrations.find((i) => i.provider.toLowerCase() === provider.toLowerCase() && i.type === type);
  const next = {
    id: existing?.id ?? crypto.randomUUID(),
    type,
    provider,
    endpoint: endpoint || undefined,
    accountRef: accountRef || undefined,
    status: "CONFIGURING" as const,
    credentials: apiKey ? { apiKey } : existing?.credentials,
    updatedAt: new Date().toISOString(),
  };

  const updated = existing ? integrations.map((i) => i.id === existing.id ? next : i) : [...integrations, next];
  await saveClubIntegrations(user.clubId, updated);

  const config = await getClubCustomConfig(user.clubId);
  config.modules.CUSTOM_API = "REQUESTED";
  if (type === "ACCOUNTING") config.modules.ACCOUNTING = "REQUESTED";
  await saveClubCustomConfig(user.clubId, config);

  const [club, settings] = await Promise.all([
    db.club.findUnique({ where: { id: user.clubId }, select: { name: true } }),
    getSettings(),
  ]);
  if (settings.ordersEmail) {
    await sendMail({
      to: settings.ordersEmail,
      subject: `Ny integration: ${club?.name ?? "Klub"} — ${provider}`,
      body: [
        `Klub: ${club?.name ?? user.clubId}`,
        `Type: ${type}`,
        `System: ${provider}`,
        endpoint ? `Endpoint: ${endpoint}` : "",
        accountRef ? `Konto/reference: ${accountRef}` : "",
        apiKey ? "Credentials er gemt krypteret i RacketBuddy." : "Ingen credentials indtastet endnu.",
      ].filter(Boolean).join("\n"),
    });
  }

  revalidatePath("/admin/custom");
}
