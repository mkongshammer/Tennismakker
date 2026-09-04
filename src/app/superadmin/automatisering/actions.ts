"use server";

import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import {
  automationConfigured,
  inspectSystem,
  saveLogin,
  type InspectResult,
} from "../../../lib/automation";

export type InspectState =
  | { result: InspectResult; clubName: string }
  | { error: string }
  | null;

/**
 * Logger ind i klubbens system og viser, hvad automatiseringen ser.
 *
 * Adgangskoden gemmes samtidig, hvis klubben er valgt — så skal den ikke
 * tastes igen ved næste forsøg, og det bliver et par forsøg, før
 * selektorerne sidder.
 */
export async function runInspect(_prev: unknown, formData: FormData): Promise<InspectState> {
  const me = await getCurrentUser();
  if (me?.role !== "SUPERADMIN") return { error: "Kun superadmin." };

  if (!automationConfigured()) {
    return {
      error:
        "AUTOMATION_URL og AUTOMATION_SECRET er ikke sat. Opret automatiseringsservicen fra automation/ og sæt de to variabler.",
    };
  }

  const clubId = String(formData.get("clubId") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const path = String(formData.get("path") ?? "").trim() || undefined;

  if (!baseUrl || !username || !password) {
    return { error: "Adresse, brugernavn og adgangskode skal alle udfyldes." };
  }

  const club = clubId ? await db.club.findUnique({ where: { id: clubId } }) : null;
  if (clubId && club) await saveLogin(clubId, baseUrl, username, password);

  try {
    const result = await inspectSystem(
      { baseUrl: baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""), username, password },
      path
    );
    return { result, clubName: club?.name ?? baseUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
