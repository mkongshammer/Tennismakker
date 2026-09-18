import Link from "next/link";

export default function ReturnToAppPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card space-y-5 p-6 text-center">
        <h1 className="display text-3xl">Tilbage til RacketBuddy</h1>
        <p className="text-slate">Du kan nu vende tilbage til appen. Åbn Min profil for at se din bookings betalingsstatus.</p>
        <p className="text-sm text-slate">En gennemført betaling registreres automatisk. Der kan gå et øjeblik. Er beløbet trukket, men bookingen stadig ikke bekræftet, så kontakt RacketBuddy, før du betaler igen.</p>
        <a className="btn-court block" href="racketbuddy://">Åbn RacketBuddy-appen</a>
        <Link className="btn-ghost block" href="/app/index.html">Åbn browserdemoen</Link>
        <Link className="block text-sm underline" href="/profil">Se profil på websitet</Link>
      </div>
    </div>
  );
}
