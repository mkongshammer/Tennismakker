"use server";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { cancelAndRefund } from "./payments";

/**
 * A club administrator cancels a booking on one of the club's own courts.
 * Refund rules are the same as when the player cancels: a full refund when
 * the start is more than 24 hours away. The court is released either way.
 */
export async function adminCancelBooking(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "CLUB_ADMIN" || !user.clubId) throw Error("Kun klubbens administrator har adgang.");
  const id = String(formData.get("id") ?? "");
  const booking = await db.booking.findFirst({ where: { id, status: { in: ["HOLD", "CONFIRMED"] }, court: { clubId: user.clubId } }, select: { id: true } });
  if (!booking) return;
  await cancelAndRefund(booking.id);
  revalidatePath("/admin", "layout");
}
