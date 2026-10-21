import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { formatDate, marketFor } from "../../lib/international";
import { listThreads } from "../../lib/messages";
import { userProfilePhotoId } from "../../lib/profile-images";
import { imageUrl } from "../../lib/imageUrl";
import { Icon } from "../../components/ui";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default async function BeskederPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { locale, country } = await getPreferences();
  const t = translator(locale);
  const en = locale !== "da";
  const zone = marketFor(country)?.timeZone ?? "America/New_York";

  const threads = await listThreads(user.id);
  const photos = await Promise.all(threads.map((th: any) => (th.otherId ? userProfilePhotoId(th.otherId) : Promise.resolve(null))));

  const today = formatDate(new Date(), locale, zone, { year: "numeric", month: "2-digit", day: "2-digit" });
  const when = (d: Date) =>
    formatDate(d, locale, zone, { year: "numeric", month: "2-digit", day: "2-digit" }) === today
      ? formatDate(d, locale, zone, { hour: "numeric", minute: "2-digit" })
      : formatDate(d, locale, zone, { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow text-slate">{en ? "Inbox" : "Indbakke"}</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">{t("msg.title")}</h1>
      </header>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate/25 bg-chalk/60 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-court-tint text-court"><Icon name="chat" size={26} /></span>
          <p className="mt-4 text-lg font-bold">{en ? "No conversations yet" : "Ingen samtaler endnu"}</p>
          <p className="mt-1 max-w-sm text-sm text-slate">{en ? "Message a player or reply to a partner post, and your conversation shows up here." : "Skriv til en spiller eller svar på et makker-opslag, så dukker samtalen op her."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/players" className="btn-court text-sm">{en ? "Find players" : "Find spillere"}</Link>
            <Link href="/matches" className="btn-ghost text-sm">{en ? "See open games" : "Se åbne opslag"}</Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate/10 overflow-hidden rounded-3xl border border-slate/15 bg-chalk">
          {threads.map((thread: any, i: number) => (
            <li key={thread.id}>
              <Link href={`/messages/${thread.id}`} className="flex items-center gap-4 px-4 py-4 transition hover:bg-mist sm:px-5">
                <span className="relative shrink-0">
                  {photos[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl(photos[i]!)} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-court text-sm font-extrabold text-white">{initials(thread.otherName)}</span>
                  )}
                  {thread.unread && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-optic ring-2 ring-chalk" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate ${thread.unread ? "font-extrabold" : "font-bold"}`}>{thread.otherName}</span>
                    <span className={`shrink-0 text-xs ${thread.unread ? "font-bold text-court" : "text-slate"}`}>{when(thread.lastAt)}</span>
                  </span>
                  <span className={`mt-0.5 block truncate text-sm ${thread.unread ? "font-semibold text-ink" : "text-slate"}`}>
                    {thread.lastBody ?? (thread.direct ? (en ? "No messages yet" : "Ingen beskeder endnu") : t("msg.about", { subject: thread.subject }))}
                  </span>
                </span>
                {thread.unread && <span className="sr-only">{t("msg.new")}</span>}
                <Icon name="chevron" size={18} className="shrink-0 text-slate-light" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
