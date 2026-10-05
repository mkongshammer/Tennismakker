
import {UiText} from "../../../components/InternationalProvider";
import Link from "next/link";

export default function ReturnToAppPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card space-y-5 p-6 text-center">
        <h1 className="display text-3xl"><UiText text="Tilbage til RacketBuddy"/></h1>
        <p className="text-slate"><UiText text="Du kan nu vende tilbage til appen. Åbn Min profil for at se din bookings betalingsstatus."/></p>
        <p className="text-sm text-slate"><UiText text="En gennemført betaling registreres automatisk. Der kan gå et øjeblik. Er beløbet trukket, men bookingen stadig ikke bekræftet, så kontakt RacketBuddy, før du betaler igen."/></p>
        <a className="btn-court block" href="racketbuddy://"><UiText text="Åbn RacketBuddy-appen"/></a>
        <Link className="btn-ghost block" href="/app/index.html"><UiText text="Åbn browserdemoen"/></Link>
        <Link className="block text-sm underline" href="/profil"><UiText text="Se profil på websitet"/></Link>
      </div>
    </div>
  );
}
