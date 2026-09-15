"use server";

import {
  startCoachPayoutSetup as baseStartCoachPayoutSetup,
  updateCoachProfile as baseUpdateCoachProfile,
} from "../../../lib/actions";
import { isDanishRegion } from "../../../lib/regions";

export async function updateCoachProfile(prev: unknown, formData: FormData) {
  const area = String(formData.get("area") ?? "").trim();
  if (!isDanishRegion(area)) {
    return { error: "Vælg en af de fem danske regioner." };
  }
  return baseUpdateCoachProfile(prev, formData);
}

export async function startCoachPayoutSetup() {
  return baseStartCoachPayoutSetup();
}
