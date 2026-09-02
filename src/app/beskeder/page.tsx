import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { listThreads } from "../../lib/messages";

export const dynamic = "force-dynamic";



// Ugedagene kommer udefra, fordi de skal kunne skifte sprog med resten.
function when(d: Date, days: string[]) {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default async function BeskederPage() {
  const user = await getCurrentUser();
  const t = translator((await getPreferences()).locale);
  const days = t("days.short").split(",");
  if (!user) redirect("/login");

  const threads = await listThreads(user.id);

  return (
    <div>
      <h1 className="display mb-6 text-3xl">{t("msg.title")}</h1>

      {threads.length === 0 ? (
        <div className="card text-slate/60">
          {t("msg.emptyList")}{" "}
          <Link href="/makkere" className="font-semibold text-court underline">
            {t("msg.emptyListLink")}
          </Link>
          {t("msg.emptyListEnd")}
        </div>
      ) : (
        <ul className="space-y-3">
          {/* Tråden hed før `t` — samme navn som oversætteren, hvilket ville
              have kaldt et objekt som en funktion. Den slags fanger
              typekontrollen ikke, når rækken er `any`. */}
          {threads.map((thread: any) => (
            <li key={thread.id}>
              <Link href={`/beskeder/${thread.id}`} className="card block hover:border-court">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">
                    {thread.otherName}
                    {thread.unread && (
                      <span className="ml-2 rounded-full bg-court px-2 py-0.5 text-xs text-chalk">
                        {t("msg.new")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate/50">{when(thread.lastAt, days)}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate/70">
                  {thread.lastBody ?? t("msg.about", { subject: thread.subject })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
