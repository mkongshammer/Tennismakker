"use server";

import { createMatchRequest as baseCreateMatchRequest } from "../../../lib/actions";
import { isDanishRegion } from "../../../lib/regions";

export async function createMatchRequest(prev: unknown, formData: FormData) {
  const area = String(formData.get("area") ?? "").trim();
  if (!isDanishRegion(area)) {
    return { error: "Vælg en af de fem danske regioner." };
  }
  return baseCreateMatchRequest(prev, formData);
}
