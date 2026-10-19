"use server";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { cancelAndRefund } from "./payments";
import { cancellationReason } from "./cancellation-policy";

/**
 * A club administrator cancels a booking on one of the club's own courts.
 *
 * Policy (src/lib/cancellation-policy.ts): the club is cancelling on the
 * customer, so the customer is always refunded in full — the 24-hour rule
 * only applies when the player cancels voluntarily. The club's payout for
 * the booking and our fee are reversed. The customer receives an e-mail
 * naming the club and the reason, if one was given.
 *
 * Tenant isolation: the booking must belong to a court in the admin's own
 * club; a foreign id is a silent no-op, never an error that confirms the
 * id exists.
 */
export async function adminCancelBooking(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role !== "CLUB_ADMIN" || !user.clubId) throw Error("Kun klubbens administrator har adgang.");
  const id = String(formData.get("id") ?? "");
  const reason = cancellationReason(formData.get("reason"));
  const booking = await db.booking.findFirst({
    where: { id, status: { in: ["HOLD", "CONFIRMED"] }, court: { clubId: user.clubId } },
    select: { id: true },
  });
  if (!booking) return;
  await cancelAndRefund(booking.id, { by: "CLUB", actorUserId: user.id, reason });
  revalidatePath("/admin", "layout");
}
