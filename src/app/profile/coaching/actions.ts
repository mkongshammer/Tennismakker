"use server";

import {
  startCoachPayoutSetup as baseStartCoachPayoutSetup,
  updateCoachProfile as baseUpdateCoachProfile,
} from "../../../lib/actions";
import { AREA_ERROR, canonicalArea } from "../../../lib/us-area";
import {getCurrentUser} from "../../../lib/session";

export async function updateCoachProfile(prev: unknown, formData: FormData) {
  const area = await canonicalArea((await getCurrentUser())?.coachProfile?.country ?? "DK", formData.get("area"));
  if (!area) return { error: AREA_ERROR };
  formData.set("area", area);
  return baseUpdateCoachProfile(prev, formData);
}

export async function startCoachPayoutSetup() {
  return baseStartCoachPayoutSetup();
}
