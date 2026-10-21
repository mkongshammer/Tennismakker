import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/session";
import { getPreferences } from "../../../lib/preferences";
import { translator } from "../../../lib/i18n";
import { formatDate, marketFor } from "../../../lib/international";
import { loadThread, readMessages, MAX_MESSAGE_LENGTH, isDirectSubject } from "../../../lib/messages";
import { levelLabel, levelNtrp } from "../../../lib/levels";
import { userProfilePhotoId } from "../../../lib/profile-images";
import { imageUrl } from "../../../lib/imageUrl";
import { Icon } from "../../../components/ui";
import { MessageForm } from "./MessageForm";
import { ScrollToEnd } from "./ScrollToEnd";
import { coachChatGate } from "../../../lib/coach-messaging";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default async function SamtalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const { locale, country } = await getPreferences();
  const t = translator(locale);
  const en = locale !== "da";
  if (!user) redirect("/login");

  const access = await loadThread(id, user.id);
  if (!access.ok) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">{t(access.reason)}</p>
        <Link href="/messages" className="btn-ghost mt-4">{t("msg.back")}</Link>
      </div>
    );
  }

  const other = access.otherUser;
  const zone = marketFor(country)?.timeZone ?? "America/New_York";
  const [messages, gate, photoId] = await Promise.all([readMessages(id, user.id), coachChatGate(user.id, other.id), userProfilePhotoId(other.id)]);
  const firstName = other.name.split(" ")[0];
  const ntrp = levelNtrp(other.level);
  const meta = [ntrp ? `NTRP ${ntrp}` : null, levelLabel(other.level, locale), other.area].filter(Boolean).join(" · ");
  const subject = isDirectSubject(access.thread.message) ? null : access.thread.message;

  const dayKey = (d: Date) => formatDate(d, locale, zone, { year: "numeric", month: "2-digit", day: "2-digit" });
  const todayKey = dayKey(new Date());
  const yesterdayKey = dayKey(new Date(Date.now() - 86400000));
  const dayLabel = (d: Date) => {
    const k = dayKey(d);
    if (k === todayKey) return en ? "Today" : "I dag";
    if (k === yesterdayKey) return en ? "Yesterday" : "I går";
    return formatDate(d, locale, zone, { weekday: "long", month: "long", day: "numeric" });
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] min-h-[520px] max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate/15 bg-chalk shadow-sm sm:h-[calc(100dvh-10rem)]">
      {/* Who you're talking to */}
      <header className="flex items-center gap-3 border-b border-slate/10 px-3 py-3 sm:px-5">
        <Link href="/messages" aria-label={t("msg.back")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate transition hover:bg-mist hover:text-ink">
          <Icon name="chevron" size={20} className="rotate-180" />
        </Link>
        {photoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(photoId)} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-court text-sm font-extrabold text-white">{initials(other.name)}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">{other.name}</h1>
          <p className="truncate text-sm text-slate">{meta}</p>
        </div>
        <Link href="/courts" className="hidden items-center gap-2 rounded-full bg-court-tint px-4 py-2 text-sm font-semibold text-court-dark transition hover:bg-court hover:text-white sm:inline-flex">
          <Icon name="court" size={16} />{en ? "Reserve a court" : t("nav.book")}
        </Link>
      </header>

      {subject && (
        <div className="flex items-start gap-2 border-b border-slate/10 bg-mist/60 px-5 py-2.5 text-sm">
          <Icon name="list" size={16} className="mt-0.5 shrink-0 text-slate" />
          <p className="min-w-0 text-slate"><span className="font-semibold text-ink">{en ? "Partner post:" : "Makker-opslag:"}</span> <span className="break-words">{subject}</span></p>
        </div>
      )}

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto bg-mist/40 px-3 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-court-tint text-court"><Icon name="chat" size={26} /></span>
            <p className="mt-4 font-bold">{en ? `Say hi to ${firstName}` : `Sig hej til ${firstName}`}</p>
            <p className="mt-1 max-w-xs text-sm text-slate">{en ? "Suggest a day, a time and a place. When you've agreed, reserve the court and it's yours." : "Foreslå en dag, et tidspunkt og et sted. Når I er enige, booker du banen."}</p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {messages.map((m: any, i: number) => {
              const mine = m.senderId === user.id;
              const prev = messages[i - 1] as any;
              const next = messages[i + 1] as any;
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const lastOfRun = !next || next.senderId !== m.senderId || dayKey(next.createdAt) !== dayKey(m.createdAt);
              return (
                <li key={m.id}>
                  {newDay && (
                    <p className="my-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-light">{dayLabel(m.createdAt)}</p>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm sm:max-w-[70%] ${
                        mine
                          ? `bg-court text-white ${lastOfRun ? "rounded-2xl rounded-br-md" : "rounded-2xl"}`
                          : `border border-slate/10 bg-chalk text-ink ${lastOfRun ? "rounded-2xl rounded-bl-md" : "rounded-2xl"}`
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                  {lastOfRun && (
                    <p className={`mt-1 px-1 text-[11px] text-slate-light ${mine ? "text-right" : "text-left"}`}>
                      {formatDate(m.createdAt, locale, zone, { hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <ScrollToEnd count={messages.length} />
      </div>

      {/* Compose */}
      {gate.allowed ? (
        <MessageForm threadId={id} placeholder={t("msg.placeholder")} sendLabel={t("msg.send")} maxLength={MAX_MESSAGE_LENGTH} />
      ) : (
        <div className="flex items-start gap-3 border-t border-slate/10 bg-chalk p-4 text-sm" role="note">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist text-slate"><Icon name="access" size={18} /></span>
          <div>
            <p className="font-semibold">{en ? "Messaging opens after a paid lesson" : "Beskeder åbner efter en betalt træning"}</p>
            <p className="mt-0.5 text-slate">{gate.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}
