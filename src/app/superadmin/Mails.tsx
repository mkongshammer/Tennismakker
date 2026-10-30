// What the AI did with support mail and replies to the sales e-mails.
import { db } from "../../lib/db";
import { recentLogs } from "../../lib/email-assistant";

const LABEL: Record<string, string> = { reply: "Besvaret", escalate: "Sendt til dig", ignore: "Sorteret fra", skipped: "Sprunget over" };

export async function Mails() {
  const [logs, confirm, inboundError] = await Promise.all([
    recentLogs(100),
    db.platformSetting.findUnique({ where: { key: "mail:gmail-forwarding-confirmation" } }),
    db.platformSetting.findUnique({ where: { key: "mail:inbound-error" } }),
  ]);
  const c = confirm ? JSON.parse(confirm.value) as { at: string; subject: string; link: string } : null;
  const err = inboundError ? JSON.parse(inboundError.value) as { at: string; error: string } : null;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="display mb-1 text-2xl">AI-svar på mails</h2>
        <p className="text-sm text-slate">Mails til support@racketbuddy.app og svar på salgsmails i Instantly besvares automatisk. Det AI&apos;en ikke kan svare sikkert på, får du på mail med kundens adresse som svaradresse.</p>
      </div>
      {c && <div className="card text-sm"><p className="font-bold">Gmail-videresendelse: bekræftelse modtaget {new Date(c.at).toLocaleString("da-DK")}</p><p className="text-slate">{c.subject}</p>{c.link && <a className="font-semibold text-court underline" href={c.link} target="_blank" rel="noreferrer">Bekræft videresendelsen</a>}</div>}
      {err && <div className="card text-sm text-red-700">Seneste fejl ved hentning af en mail ({new Date(err.at).toLocaleString("da-DK")}): {err.error}</div>}
      {!logs.length ? <p className="card text-slate">Ingen mails endnu.</p> : (
        <div className="space-y-2">
          {logs.map((l) => (
            <details key={l.id} className="card text-sm">
              <summary className="cursor-pointer">
                <span className="font-semibold">{l.channel === "support" ? "Support" : "Salg"} · {LABEL[l.action] ?? l.action}{l.action === "reply" && l.sent === false ? " (ikke sendt)" : ""}</span>
                <span className="text-slate"> · {l.from} · {l.subject} · {new Date(l.at).toLocaleString("da-DK")}</span>
                {l.summary && <p className="mt-1 text-slate">{l.summary}</p>}
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div><p className="mb-1 text-xs font-bold uppercase text-slate">Mail</p><p className="whitespace-pre-wrap">{l.text || l.reason}</p></div>
                <div><p className="mb-1 text-xs font-bold uppercase text-slate">AI&apos;ens svar</p><p className="whitespace-pre-wrap">{l.reply || "–"}</p></div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
