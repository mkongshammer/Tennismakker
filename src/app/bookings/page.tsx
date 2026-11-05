import { redirect } from "next/navigation";

// Your bookings live on the profile page; keep this address working.
export default function BookingsPage() {
  redirect("/profile");
}
