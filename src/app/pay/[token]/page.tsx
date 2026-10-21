// A membership bill, opened from the e-mail link. No login needed: the
// token in the link is the key. Imported members have never chosen a
// password, and a bill they can't open is a bill that doesn't get paid.
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPreferences } from "../../../lib/preferences";
import { formatDate, formatMoney } from "../../../lib/international";
import { billByToken, billStatus, payBill } from "../../../lib/member-billing";
import { Icon } from "../../../components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Membership dues", robots: { index: false, follow: false } };

async function pay(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const bill = await billByToken(token);
  if (!bill) redirect("/");
  const result = await payBill(bill!.id);
  if (!result.ok) redirect(`/pay/${token}?error=${encodeURIComponent(result.error)}`);
  if (result.checkoutUrl) redirect(result.checkoutUrl);
  redirect(`/pay/${token}?paid=1`);
}

export default async function PayBillPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string; error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const prefs = await getPreferences();
  const bill = await billByToken(token);
  const en = prefs.locale !== "da";

  if (!bill) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-slate/15 bg-chalk p-8 text-center">
        <h1 className="display text-2xl">{en ? "This link has expired" : "Linket virker ikke længere"}</h1>
        <p className="mt-2 text-slate">{en ? "The bill may have been cancelled or replaced. Contact your club, or log in to see your open bills." : "Regningen kan være annulleret eller erstattet. Kontakt klubben, eller log ind og se dine åbne regninger."}</p>
        <Link href="/profile" className="btn-court mt-6">{en ? "Log in" : "Log ind"}</Link>
      </div>
    );
  }

  const club = bill.type.club;
  const locale = prefs.locale;
  const tz = club.timeZone;
  const status = billStatus(bill);
  const justPaid = query.paid === "1";
  const money = formatMoney(bill.priceKr, bill.currency, locale);
  const d = (x: Date) => formatDate(x, locale, tz, { month: "long", day: "numeric", year: "numeric" });
  const day = (x: Date) => formatDate(x, locale, "UTC", { month: "long", day: "numeric", year: "numeric" });
  const contact = club.billingReplyTo || club.contactEmail;

  return (
    <div className="mx-auto max-w-lg">
      <div className="overflow-hidden rounded-3xl border border-slate/15 bg-chalk shadow-sm">
        <header className="bg-ink px-6 py-6 text-white sm:px-8">
          <p className="eyebrow text-white/60">{en ? "Membership dues" : "Kontingent"}</p>
          <h1 className="display mt-2 text-3xl">{club.name}</h1>
          <p className="mt-1 text-white/70">{en ? `For ${bill.user.name}` : `Til ${bill.user.name}`}</p>
        </header>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <dl className="divide-y divide-slate/10 rounded-2xl border border-slate/15 text-sm">
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate">{en ? "Membership" : "Kontingent"}</dt><dd className="text-right font-semibold">{bill.type.name}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate">{en ? "Season" : "Sæson"}</dt><dd className="text-right font-semibold">{bill.type.seasonName}<span className="block text-xs font-normal text-slate">{day(bill.type.fromDate)} – {day(bill.type.toDate)}</span></dd></div>
            {bill.dueDate && status !== "PAID" && <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate">{en ? "Due" : "Forfald"}</dt><dd className={`text-right font-semibold ${status === "OVERDUE" ? "text-[#a2401c]" : ""}`}>{d(bill.dueDate)}{status === "OVERDUE" && <span className="block text-xs font-normal">{en ? "Overdue" : "Forfalden"}</span>}</dd></div>}
            <div className="flex items-baseline justify-between gap-4 px-4 py-4"><dt className="font-semibold">{en ? "Amount" : "Beløb"}</dt><dd className="display text-2xl">{money}</dd></div>
          </dl>

          {status === "PAID" ? (
            <div className="flex items-start gap-3 rounded-2xl bg-success-soft p-4 text-success-ink">
              <Icon name="check" size={20} strokeWidth={2.4} className="mt-0.5 shrink-0" />
              <p className="text-sm"><span className="font-bold">{en ? "Paid. Thank you!" : "Betalt. Tak!"}</span>{bill.paidAt && <> {en ? `Registered ${d(bill.paidAt)}. A receipt was sent by email.` : `Registreret ${d(bill.paidAt)}. Kvitteringen er sendt på mail.`}</>}</p>
            </div>
          ) : status === "CANCELLED" ? (
            <p className="rounded-2xl bg-mist p-4 text-sm">{en ? "This bill was cancelled by the club." : "Klubben har annulleret regningen."}</p>
          ) : justPaid ? (
            <p className="rounded-2xl bg-court-tint p-4 text-sm font-semibold text-court-dark">{en ? "Payment received. We're confirming it with your card issuer, which takes a few seconds. Refresh the page in a moment." : "Betalingen er modtaget og bekræftes nu. Opdater siden om et øjeblik."}</p>
          ) : (
            <form action={pay}>
              <input type="hidden" name="token" value={token} />
              <button className="btn-court w-full text-base">{en ? `Pay ${money}` : `Betal ${money}`}</button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate"><Icon name="access" size={14} />{en ? "Secure card payment by Stripe. Paid straight to the club." : "Sikker kortbetaling via Stripe. Pengene går direkte til klubben."}</p>
            </form>
          )}
          {query.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{query.error}</p>}

          {club.billingNote && <p className="whitespace-pre-line rounded-2xl bg-mist p-4 text-sm">{club.billingNote}</p>}
          {contact && <p className="text-center text-sm text-slate">{en ? "Questions about this bill? " : "Spørgsmål til regningen? "}<a href={`mailto:${contact}`} className="font-semibold text-court">{contact}</a></p>}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate">{en ? "You can also see and pay your bills in the RacketBuddy app under Profile." : "Du kan også se og betale dine regninger i RacketBuddy-appen under Profil."}</p>
    </div>
  );
}
