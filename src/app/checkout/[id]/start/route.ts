// Starter betalingen og sender browseren til Stripe.
//
// Dette er en route handler, ikke en side. Den svarer med en ægte
// HTTP-omdirigering (302), som browseren altid følger — også til et
// andet domæne. Det er forskellen fra en server-side redirect() i en
// sidekomponent, som Next behandler som intern navigation, og fra en
// meta-refresh, der aldrig kører hvis siden blot hentes som data.
import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { startCheckout } from "../../../../lib/payments";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    include: { court: { include: { club: true } } },
  });

  if (!booking || booking.userId !== user.id) redirect("/profil");
  if (booking.status === "CONFIRMED") redirect("/profil?betalt=1");
  if (booking.status === "CANCELLED") redirect("/profil");

  // Mock-tilstand: den gamle checkout-side håndterer flowet selv
  if ((process.env.PAYMENT_PROVIDER ?? "mock") !== "stripe") {
    redirect(`/checkout/${booking.id}`);
  }

  let url: string;
  try {
    url = await startCheckout(booking.id);
  } catch (err) {
    console.error("Kunne ikke starte betaling:", err);
    const slug = booking.court?.club.slug;
    redirect(slug ? `/klub/${slug}?fejl=betaling` : "/profil");
  }

  // 302 til Stripe. Browseren følger den, uanset hvordan siden blev åbnet.
  return Response.redirect(url, 302);
}
