// Mock-checkout: simulerer betalingsflowet (MobilePay/kort).
// I produktion erstattes denne side af Stripe Checkout — se src/lib/payments.ts.
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { confirmBookingPayment, platformFee } from "../../../lib/payments";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    include: { court: { include: { club: true } }, coachProfile: { include: { user: true } } },
  });
  if (!booking || booking.userId !== user.id) notFound();
  if (booking.status === "CANCELLED") {
    return (
      <div className="mx-auto max-w-sm card text-center">
        <p className="font-bold">Reservationen er udløbet</p>
        <p className="mt-1 text-sm text-net/60">De 10 minutter gik — vælg tidspunktet igen.</p>
      </div>
    );
  }
  if (booking.status === "CONFIRMED") redirect("/profil?betalt=1");

  const what =
    booking.kind === "COURT"
      ? `${booking.court?.club.name} — ${booking.court?.name}`
      : `Trænertime hos ${booking.coachProfile?.user.name}`;
  const fee = platformFee(booking.kind as "COURT" | "COACH", booking.priceKr);

  async function pay() {
    "use server";
    await confirmBookingPayment(params.id);
    redirect("/profil?betalt=1");
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display mb-6 text-3xl">Betaling</h1>
      <div className="card space-y-3">
        <p className="font-bold">{what}</p>
        <p className="text-sm capitalize">
          {format(booking.startsAt, "EEEE d. MMMM 'kl.' HH:mm", { locale: da })} – {format(booking.endsAt, "HH:mm")}
        </p>
        <div className="chalk-line !bg-none border-t border-dashed border-net/20" />
        <div className="flex justify-between text-sm">
          <span>Pris</span>
          <span className="font-bold">{booking.priceKr} kr</span>
        </div>
        <p className="text-xs text-net/50">
          Heraf går {fee} kr til platformen — resten udbetales automatisk til{" "}
          {booking.kind === "COURT" ? "klubben" : "træneren"}.
        </p>
        <form action={pay}>
          <button className="btn-grus w-full">Betal {booking.priceKr} kr (demo)</button>
        </form>
        <p className="text-center text-xs text-net/50">
          Demo-tilstand: ingen rigtige penge trækkes. Tiden holdes til{" "}
          {booking.holdExpiresAt ? format(booking.holdExpiresAt, "HH:mm") : "—"}.
        </p>
      </div>
    </div>
  );
}
