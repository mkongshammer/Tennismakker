// Betalingsside.
//
// I mock-tilstand simulerer den selv et betalingsflow. I Stripe-tilstand
// må den ALDRIG vise en gratis "betal"-genvej — det ville betyde, at en
// booking kunne bekræftes uden at en krone rørte ved en rigtig konto.
// I stedet sendes brugeren videre til en ægte Stripe-session, uanset
// hvordan de er landet her (websitet, appen, eller en direkte adresse).
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { confirmBookingPayment, platformFeeForBooking, startCheckout } from "../../../lib/payments";
import { getSettings } from "../../../lib/settings";

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
        <p className="mt-1 text-sm text-slate/60">De 10 minutter gik — vælg tidspunktet igen.</p>
      </div>
    );
  }
  if (booking.status === "CONFIRMED") redirect("/profil?betalt=1");
  // Samme vagt som i start-ruten: en time, træneren ikke har godkendt, kan
  // ikke betales.
  if (booking.status === "REQUESTED") redirect("/profil?afventer=1");

  // Stripe er slået til: denne side er kun en gennemgangsstation. Den
  // egentlige betaling foregår hos Stripe, aldrig her.
  //
  // Omdirigeringen sker med en meta-refresh og ikke med redirect(), fordi
  // Stripes adresse ligger på et andet domæne. Next behandler en server-
  // redirect som en intern navigation, og browseren kan i den situation
  // ende med at blive på siden — hvorefter brugeren lander tilbage på
  // profilen uden nogensinde at have set en betalingsside.
  if ((await getSettings()).paymentProvider === "stripe") {
    const url = await startCheckout(booking.id);
    return (
      <html lang="da">
        <head>
          <meta httpEquiv="refresh" content={`0;url=${url}`} />
        </head>
        <body
          style={{
            fontFamily: "system-ui, sans-serif",
            padding: "3rem 1.5rem",
            textAlign: "center",
            color: "#0F2138",
          }}
        >
          <p style={{ fontWeight: 700 }}>Sender dig til betaling…</p>
          <p style={{ marginTop: "0.75rem", fontSize: 14, color: "#54677E" }}>
            Sker der ikke noget?{" "}
            <a href={url} style={{ color: "#1B62C4", fontWeight: 600 }}>
              Klik her for at fortsætte
            </a>
          </p>
        </body>
      </html>
    );
  }

  const what =
    booking.kind === "COURT"
      ? `${booking.court?.club.name} — ${booking.court?.name}`
      : `Trænertime hos ${booking.coachProfile?.user.name}`;
  const fee = await platformFeeForBooking(booking);

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
        <div className="chalk-line !bg-none border-t border-dashed border-slate/20" />
        <div className="flex justify-between text-sm">
          <span>Pris</span>
          <span className="font-bold">{booking.priceKr} kr</span>
        </div>
        <p className="text-xs text-slate/50">
          {fee > 0
            ? `Heraf går ${fee} kr til RacketBuddy — de resterende ${booking.priceKr - fee} kr udbetales automatisk til ${booking.kind === "COURT" ? "klubben" : "træneren"}.`
            : `Hele beløbet udbetales til klubben. Klubben betaler et fast abonnement i stedet for provision.`}
        </p>
        <form action={pay}>
          <button className="btn-court w-full">Betal {booking.priceKr} kr (demo)</button>
        </form>
        <p className="text-center text-xs text-slate/50">
          Demo-tilstand: ingen rigtige penge trækkes. Tiden holdes til{" "}
          {booking.holdExpiresAt ? format(booking.holdExpiresAt, "HH:mm") : "—"}.
        </p>
      </div>
    </div>
  );
}
