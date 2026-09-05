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
import { useFormState } from "react-dom";
import { saveSystemLogin, removeSystemLogin } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

type Summary = {
  blocked: number;
  pending: number;
  failed: number;
  failures: { court: string; startsAt: Date; error: string | null }[];
};

export function SystemLoginForm({
  system,
  saved,
  lastOkAt,
  lastError,
  summary,
}: {
  system: string;
  saved: { baseUrl: string; username: string } | null;
  lastOkAt: Date | null;
  lastError: string | null;
  summary: Summary | null;
}) {
  const [state, action] = useFormState(saveSystemLogin, null);

  return (
    <div className="space-y-4">
      {saved ? (
        <div className="rounded-xl bg-mist p-4 text-sm">
          <p className="font-bold">
            Vi har adgang til {saved.baseUrl} som {saved.username}
          </p>
          <p className="mt-1 text-slate">
            {lastOkAt
              ? `Virkede sidst ${lastOkAt.toLocaleString("da-DK", { dateStyle: "long", timeStyle: "short" })}.`
              : lastError
                ? `Seneste forsøg fejlede: ${lastError}`
                : "Endnu ikke afprøvet."}
          </p>

          {summary && (
            <p className="mt-2 text-slate">
              {summary.blocked} tider spærret
              {summary.pending > 0 && `, ${summary.pending} i kø`}
              {summary.failed > 0 && `, ${summary.failed} kunne ikke spærres`}.
            </p>
          )}

          {summary && summary.failures.length > 0 && (
            <>
              <p className="mt-3 font-bold text-court-dark">
                Disse skal I spærre i hånden:
              </p>
              <ul className="mt-1 space-y-1">
                {summary.failures.map((f, i) => (
                  <li key={i}>
                    {f.court} ·{" "}
                    {f.startsAt.toLocaleString("da-DK", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {f.error && <span className="text-slate-light"> — {f.error}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          <form action={removeSystemLogin} className="mt-4">
            <SubmitButton className="btn-ghost" pendingText="Fjerner…">
              Fjern adgangen
            </SubmitButton>
          </form>
        </div>
      ) : (
        <p className="rounded-xl bg-mist p-4 text-sm text-slate">
          Uden et login skal I selv spærre tiderne i {system}, før I frigiver
          dem hos os. Med et login gør vi det for jer, typisk inden for et
          kvarter.
        </p>
      )}

      <form action={action} className="space-y-4 rounded-xl border border-slate/15 p-4">
        <div>
          <label className="label" htmlFor="sysUrl">Adressen på jeres system</label>
          <input
            className="input"
            id="sysUrl"
            name="baseUrl"
            placeholder="jerklub.halbooking.dk"
            defaultValue={saved?.baseUrl ?? ""}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sysUser">Brugernavn</label>
            <input
              className="input"
              id="sysUser"
              name="username"
              autoComplete="off"
              defaultValue={saved?.username ?? ""}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="sysPass">Adgangskode</label>
            <input
              className="input"
              id="sysPass"
              name="password"
              type="password"
              autoComplete="off"
              required
            />
          </div>
        </div>

        <p className="text-xs text-slate">
          Adgangskoden krypteres, før den gemmes, og bruges kun til at spærre
          de tider, I selv frigiver, og til at føre gæstebookinger ind. Vi
          rører ikke jeres medlemmer, priser eller opsætning. I kan fjerne
          adgangen igen når som helst.
        </p>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

        <SubmitButton pendingText="Gemmer…">
          {saved ? "Opdatér adgangen" : "Gem adgangen"}
        </SubmitButton>
      </form>
    </div>
  );
}
