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
import { useWebsiteInternational } from "../../components/InternationalProvider";import { useFormState } from "react-dom";
import { setCustomDomain } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

export function DomainForm({
  clubId,
  domain,
  status




}: {clubId: string;domain: string | null;status: string;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(setCustomDomain, null);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        <div>
          <label className="label" htmlFor="domain">{tr("Klubbens dom\xE6ne")}</label>
          <input
            className="input"
            id="domain"
            name="domain"
            defaultValue={domain ?? ""}
            placeholder={tr("booking.jerklub.dk")} />

          <p className="mt-1 text-xs text-slate">{tr("B\xE5de et helt dom\xE6ne og et underdom\xE6ne virker. Har I allerede en hjemmeside, I vil beholde, er")}

            <span className="data">{tr("booking.jerklub.dk")}</span>{" "}{tr("det enkleste.")}

          </p>
        </div>
        {state?.error && <p className="text-sm font-semibold text-court-dark">{tr(state.error)}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{tr(state.ok)}</p>}
        <SubmitButton pendingText={tr("Gemmer\u2026")}>{tr("Gem dom\xE6net")}</SubmitButton>
      </form>

      {domain &&
      <div className="rounded-xl bg-mist p-4 text-sm">
          <p className="font-bold">
            {status === "LIVE" ?
          tr("{domain} er aktivt",{domain}) :
          tr("Sådan får I {domain} i luften",{domain})}
          </p>

          {status === "LIVE" ?
        <p className="mt-1 text-slate">{tr("Jeres side ligger p\xE5 jeres eget dom\xE6ne. Skifter I dom\xE6ne, skriv det nye ind ovenfor og gentag ops\xE6tningen.")}


        </p> :

        <>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-slate">
                <li>{tr("Opret en")}
              <span className="data">{tr("CNAME")}</span>{tr("-post hos den, der har jeres dom\xE6ne, med v\xE6rdien")}
              {" "}
                  <span className="data">{tr("tennis-makker.onrender.com")}</span>
                  {domain.split(".").length > 2 ?
              <>
                      {" "}{tr("p\xE5 navnet")}
                <span className="data">{domain.split(".")[0]}</span>.
                    </> :

              <>{tr(". Er det et helt dom\xE6ne uden underdom\xE6ne, skal I i stedet bruge en")}

                <span className="data">{tr("ALIAS")}</span>{tr("- eller")}{" "}
                      <span className="data">{tr("ANAME")}</span>{tr("-post \u2014 en almindelig CNAME m\xE5 ikke st\xE5 p\xE5 roden af et dom\xE6ne.")}

              </>
              }
                </li>
                <li>{tr("Skriv til os, n\xE5r posten er oprettet.")}</li>
                <li>{tr("Vi tilf\xF8jer dom\xE6net hos vores udbyder og f\xE5r udstedt et certifikat. Det tager typisk under en time, n\xE5r DNS er sl\xE5et igennem.")}



            </li>
              </ol>
              <p className="mt-3 text-xs text-slate-light">{tr("Trin 3 er manuelt hos os. Vi kan ikke g\xF8re det, f\xF8r posten i trin 1 er oprettet, og vi f\xE5r ikke automatisk besked om, at den er \u2014 derfor trin 2.")}



          </p>
            </>
        }
        </div>
      }
    </div>);

}
