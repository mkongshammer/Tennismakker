"use client";

// Hvem der kan administrere klubben.
//
// Findes, fordi den eneste administrator ikke kan slette sin konto — og
// "udpeg en anden først" er et råd, man skal kunne følge uden at skrive
// til os.
//
// Det løser også et større problem: en forening, hvor kun én person har
// nøglen, mister adgangen til sine egne bookinger og indtægter den dag,
// personen stopper i bestyrelsen.
import { useWebsiteInternational } from "../../components/InternationalProvider";import { useState } from "react";
import { makeClubAdmin, removeClubAdmin } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

type Member = {id: string;name: string;email: string;isAdmin: boolean;};

export function AdminsForm({ members, meId }: {members: Member[];meId: string;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [query, setQuery] = useState("");

  const admins = members.filter((m) => m.isAdmin);
  const players = members.filter(
    (m) =>
    !m.isAdmin && (
    query.trim() === "" ||
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.email.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {admins.map((a) =>
        <li
          key={a.id}
          className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3">

            <div>
              <p className="font-bold">
                {a.name}
                {a.id === meId &&
              <span className="ml-2 text-xs font-medium text-slate-light">{tr("dig")}</span>
              }
              </p>
              <p className="text-sm text-slate">{a.email}</p>
            </div>
            {admins.length > 1 &&
          <form action={removeClubAdmin}>
                <input type="hidden" name="memberId" value={a.id} />
                <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">{tr("Fjern som administrator")}

            </SubmitButton>
              </form>
          }
          </li>
        )}
      </ul>

      {admins.length === 1 &&
      <p className="rounded-xl bg-mist p-3 text-sm text-slate">{tr("Der er kun \xE9n administrator. Udpeg mindst \xE9n mere \u2014 s\xE5 mister klubben ikke adgangen den dag, du stopper i bestyrelsen.")}


      </p>
      }

      <div>
        <label className="label" htmlFor="adminSearch">{tr("Udpeg et medlem")}</label>
        <input
          className="input"
          id="adminSearch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("S\xF8g p\xE5 navn eller e-mail")} />


        {query.trim() !== "" &&
        <ul className="mt-3 space-y-2">
            {players.length === 0 ?
          <li className="text-sm text-slate">{tr("Ingen medlemmer matcher.")}</li> :

          players.slice(0, 8).map((m) =>
          <li
            key={m.id}
            className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl bg-mist p-3">

                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-sm text-slate">{m.email}</p>
                  </div>
                  <form action={makeClubAdmin}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">{tr("G\xF8r til administrator")}

              </SubmitButton>
                  </form>
                </li>
          )
          }
          </ul>
        }
      </div>

      <p className="text-sm text-slate">{tr("En administrator kan alt det, du kan: frigive tider, se oms\xE6tningen, rette hjemmesiden og opsige abonnementet. Udpeg kun folk fra bestyrelsen.")}



      </p>
    </div>);

}
