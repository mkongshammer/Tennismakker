"use server";

import { createMatchRequest as baseCreateMatchRequest } from "../../../lib/actions";
import {validArea} from "../../../lib/profile-location";
import {getCurrentUser} from "../../../lib/session";

export async function createMatchRequest(prev: unknown, formData: FormData) {
  const area = String(formData.get("area") ?? "").trim();
  if (!validArea((await getCurrentUser())?.country??"DK",area)) {
    return { error: "Choose a valid city/area." };
  }
  return baseCreateMatchRequest(prev, formData);
}
