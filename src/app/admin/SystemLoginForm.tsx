"use client";

// Adgang til klubbens eget bookingsystem.
//
// Med et login spærrer vi selv de tider, klubben frigiver — i stedet for at
// klubben skal gøre det i hånden og sætte et flueben. Det er den samme
// måde, WannaSport gør det på.
//
// Adgangskoden krypteres, før den gemmes, og bruges kun til at spærre tider
// og føre bookinger ind. Det står på skærmen, fordi en klub, der giver et
// login væk, har ret til at vide præcis hvad det bruges til.
import { useWebsiteInternational } from "../../components/InternationalProvider";import { useFormState } from "react-dom";
import { saveSystemLogin, removeSystemLogin } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

type Summary = {
  blocked: number;
  pending: number;
  failed: number;
  failures: {court: string;startsAt: Date;error: string | null;}[];
};

export function SystemLoginForm({
  system,
  saved,
  lastOkAt,
  lastError,
  summary






}: {system: string;saved: {baseUrl: string;username: string;} | null;lastOkAt: Date | null;lastError: string | null;summary: Summary | null;}) {const { tr, money, currency, timeZone,locale } = useWebsiteInternational();
  const [state, action] = useFormState(saveSystemLogin, null);

  return (
    <div className="space-y-4">
      {saved ?
      <div className="rounded-xl bg-mist p-4 text-sm">
          <p className="font-bold">{tr("Vi har adgang til")}
          {saved.baseUrl}{" " + tr("som") + " "}{saved.username}
          </p>
          <p className="mt-1 text-slate">
            {lastOkAt ?
          tr("Virkede sidst {date}.",{date:lastOkAt.toLocaleString(locale,{timeZone,dateStyle:"long",timeStyle:"short"})}) :
          lastError ?
          tr("Seneste forsøg fejlede: {error}",{error:tr(lastError!)}) :
          tr("Endnu ikke afprøvet.")}
          </p>

          {summary &&
        <p className="mt-2 text-slate">
              {summary.blocked}{tr("tider sp\xE6rret")}
          {summary.pending > 0 && tr(", {count} i kø",{count:summary.pending})}
              {summary.failed > 0 && tr(", {count} kunne ikke spærres",{count:summary.failed})}.
            </p>
        }

          {summary && summary.failures.length > 0 &&
        <>
              <p className="mt-3 font-bold text-court-dark">{tr("Disse skal I sp\xE6rre i h\xE5nden:")}

          </p>
              <ul className="mt-1 space-y-1">
                {summary.failures.map((f, i) =>
            <li key={i}>
                    {f.court} ·{" "}
                    {f.startsAt.toLocaleString(locale, { timeZone,
                dateStyle: "short",
                timeStyle: "short"
              })}
                    {f.error && <span className="text-slate-light"> — {f.error}</span>}
                  </li>
            )}
              </ul>
            </>
        }

          <form action={removeSystemLogin} className="mt-4">
            <SubmitButton className="btn-ghost" pendingText={tr("Fjerner\u2026")}>{tr("Fjern adgangen")}

          </SubmitButton>
          </form>
        </div> :

      <p className="rounded-xl bg-mist p-4 text-sm text-slate">{tr("Uden et login skal I selv sp\xE6rre tiderne i")}
        {system}{tr(", f\xF8r I frigiver dem hos os. Med et login g\xF8r vi det for jer, typisk inden for et kvarter.")}


      </p>
      }

      <form action={action} className="space-y-4 rounded-xl border border-slate/15 p-4">
        <div>
          <label className="label" htmlFor="sysUrl">{tr("Adressen p\xE5 jeres system")}</label>
          <input
            className="input"
            id="sysUrl"
            name="baseUrl"
            placeholder={tr("jerklub.halbooking.dk")}
            defaultValue={saved?.baseUrl ?? ""}
            required />

        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sysUser">{tr("Brugernavn")}</label>
            <input
              className="input"
              id="sysUser"
              name="username"
              autoComplete="off"
              defaultValue={saved?.username ?? ""}
              required />

          </div>
          <div>
            <label className="label" htmlFor="sysPass">{tr("Adgangskode")}</label>
            <input
              className="input"
              id="sysPass"
              name="password"
              type="password"
              autoComplete="off"
              required />

          </div>
        </div>

        <p className="text-xs text-slate">{tr("Adgangskoden krypteres, f\xF8r den gemmes, og bruges kun til at sp\xE6rre de tider, I selv frigiver, og til at f\xF8re g\xE6stebookinger ind. Vi r\xF8rer ikke jeres medlemmer, priser eller ops\xE6tning. I kan fjerne adgangen igen n\xE5r som helst.")}




        </p>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{tr(state.error)}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{tr(state.ok)}</p>}

        <SubmitButton pendingText={tr("Gemmer\u2026")}>
          {saved ? tr("Opdatér adgangen") : tr("Gem adgangen")}
        </SubmitButton>
      </form>
    </div>);

}
