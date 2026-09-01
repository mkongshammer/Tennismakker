// Bekræftelse efter betaling.
//
// Stripe sender brugeren hertil, når betalingen er gennemført. Vi spørger
// Stripe direkte, om sessionen faktisk er betalt, og bekræfter bookingen
// med det samme.
//
// Hvorfor ikke bare stole på webhooken? Fordi den kan være forsinket eller
// fejle, og så ville brugeren se "Afventer betaling" umiddelbart efter at
// have betalt. Webhooken er stadig kilden til sandhed for de tilfælde,
// hvor brugeren lukker browseren — de to supplerer hinanden.
//
// confirmBookingPayment() er idempotent, så det gør ingen skade, at både
// denne rute og webhooken kalder den.
import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { stripe, stripeEnabled } from "../../../../lib/stripe";
import { confirmBookingPayment } from "../../../../lib/payments";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const booking = await db.booking.findUnique({ where: { id: params.id } });
  if (!booking || booking.userId !== user.id) redirect("/profil");

  // Allerede bekræftet af webhooken? Så er der intet at gøre.
  if (booking.status === "CONFIRMED") redirect("/profil?betalt=1");

  const sessionId = new URL(req.url).searchParams.get("session");

  // redirect() kaster en intern undtagelse, som en catch-alt ville sluge.
  // Derfor holdes den helt uden for try/catch — samme faldgrube som
  // beskrevet i README under bookingflowet.
  if (stripeEnabled() && sessionId) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        await confirmBookingPayment(params.id, paymentIntentId);
      }
    } catch (err) {
      // Kan vi ikke nå Stripe, falder vi tilbage på webhooken. Brugeren
      // får beskeden om, at betalingen ikke er registreret endnu.
      console.error("Kunne ikke bekræfte betaling mod Stripe:", err);
    }
  }

  redirect("/profil?betalt=1");
}
