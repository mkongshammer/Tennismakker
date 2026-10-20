"use server";

import { createMatchRequest as baseCreateMatchRequest } from "../../../lib/actions";
import { AREA_ERROR, canonicalArea } from "../../../lib/us-area";
import {getCurrentUser} from "../../../lib/session";

export async function createMatchRequest(prev: unknown, formData: FormData) {
  const area = await canonicalArea((await getCurrentUser())?.country ?? "DK", formData.get("area"));
  if (!area) return { error: AREA_ERROR };
  formData.set("area", area);
  return baseCreateMatchRequest(prev, formData);
}
