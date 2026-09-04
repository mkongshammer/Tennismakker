"use client";

// Klubbens eget domæne.
//
// Klubben skriver domænet ind, og siden viser den DNS-opskrift, de skal
// give videre til den, der har adgang til domænet. Vi kan ikke sætte det op
// for dem uden dét skridt: DNS ligger hos klubbens egen udbyder, og der
// findes ingen genvej.
//
// Den viser også ærligt, at der er et manuelt led hos os. Domænet skal
// tilføjes i Render, før certifikatet kan udstedes — det kan ikke gøres fra
// koden, og en klub, der tror det sker automatisk, ringer på dag to.
import { useFormState } from "react-dom";
import { setCustomDomain } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

export function DomainForm({
  clubId,
  domain,
  status,
}: {
  clubId: string;
  domain: string | null;
  status: string;
}) {
  const [state, action] = useFormState(setCustomDomain, null);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        <div>
          <label className="label" htmlFor="domain">Klubbens domæne</label>
          <input
            className="input"
            id="domain"
            name="domain"
            defaultValue={domain ?? ""}
            placeholder="booking.jerklub.dk"
          />
          <p className="mt-1 text-xs text-slate">
            Både et helt domæne og et underdomæne virker. Har I allerede en
            hjemmeside, I vil beholde, er <span className="data">booking.jerklub.dk</span>{" "}
            det enkleste.
          </p>
        </div>
        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
        <SubmitButton pendingText="Gemmer…">Gem domænet</SubmitButton>
      </form>

      {domain && (
        <div className="rounded-xl bg-mist p-4 text-sm">
          <p className="font-bold">
            {status === "LIVE"
              ? `${domain} er aktivt`
              : `Sådan får I ${domain} i luften`}
          </p>

          {status === "LIVE" ? (
            <p className="mt-1 text-slate">
              Jeres side ligger på jeres eget domæne. Skifter I domæne, skriv
              det nye ind ovenfor og gentag opsætningen.
            </p>
          ) : (
            <>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-slate">
                <li>
                  Opret en <span className="data">CNAME</span>-post hos den, der har
                  jeres domæne, med værdien{" "}
                  <span className="data">tennis-makker.onrender.com</span>
                  {domain.split(".").length > 2 ? (
                    <>
                      {" "}
                      på navnet <span className="data">{domain.split(".")[0]}</span>.
                    </>
                  ) : (
                    <>
                      . Er det et helt domæne uden underdomæne, skal I i stedet
                      bruge en <span className="data">ALIAS</span>- eller{" "}
                      <span className="data">ANAME</span>-post — en almindelig
                      CNAME må ikke stå på roden af et domæne.
                    </>
                  )}
                </li>
                <li>Skriv til os, når posten er oprettet.</li>
                <li>
                  Vi tilføjer domænet hos vores udbyder og får udstedt et
                  certifikat. Det tager typisk under en time, når DNS er slået
                  igennem.
                </li>
              </ol>
              <p className="mt-3 text-xs text-slate-light">
                Trin 3 er manuelt hos os. Vi kan ikke gøre det, før posten i
                trin 1 er oprettet, og vi får ikke automatisk besked om, at den
                er — derfor trin 2.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
