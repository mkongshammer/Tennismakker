"use server";

import {
  startCoachPayoutSetup as baseStartCoachPayoutSetup,
  updateCoachProfile as baseUpdateCoachProfile,
} from "../../../lib/actions";
import {validArea} from "../../../lib/profile-location";
import {getCurrentUser} from "../../../lib/session";

export async function updateCoachProfile(prev: unknown, formData: FormData) {
  const area = String(formData.get("area") ?? "").trim();
  if (!validArea((await getCurrentUser())?.coachProfile?.country??"DK",area)) {
    return { error: "Choose a valid city/area." };
  }
  return baseUpdateCoachProfile(prev, formData);
}

export async function startCoachPayoutSetup() {
  return baseStartCoachPayoutSetup();
}
