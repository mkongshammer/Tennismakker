// Ask players to review their coach after each paid lesson.
//
// Reviews are what make a coach's profile worth more than a phone number:
// they only come from lessons booked and paid on RacketBuddy. So every
// finished lesson gets exactly one prompt — an e-mail with a direct link, and
// a push notification when the player has the app — an hour after it ends,
// for up to a week. reviewPromptedAt is claimed before sending, so two
// overlapping job runs never ask twice.
import { db } from "./db";
import { sendMail } from "./email";
import { getSettings } from "./settings";
import { messageLocale } from "./mail-locale";
import { enqueue } from "./push";
import { pushCopy } from "./push-policy";

const AFTER_END_MS = 60 * 60_000;
const WINDOW_MS = 7 * 24 * 60 * 60_000;
const BATCH = 50;

export function reviewPromptMail(opts: { to: string; playerName: string; coachName: string; url: string; locale?: string | null }) {
  const da = messageLocale(opts.locale) === "da";
  const first = (n: string) => n.trim().split(/\s+/)[0] || n;
  return {
    to: opts.to,
    subject: da ? `Hvordan var træningen med ${first(opts.coachName)}?` : `How was your lesson with ${first(opts.coachName)}?`,
    body: (da
      ? [`Hej ${first(opts.playerName)}`, "", `Giv ${first(opts.coachName)} 1-5 stjerner og skriv gerne et par ord. Det tager ti sekunder og hjælper andre spillere med at vælge.`, "", opts.url, "", "RacketBuddy"]
      : [`Hi ${first(opts.playerName)},`, "", `Give ${first(opts.coachName)} 1-5 stars and, if you like, a few words. It takes ten seconds and helps other players choose.`, "", opts.url, "", "RacketBuddy"]
    ).join("\n"),
  };
}

export async function runReviewPrompts(now = new Date()) {
  const due = await db.booking.findMany({
    where: {
      kind: "COACH",
      status: "CONFIRMED",
      reviewPromptedAt: null,
      review: null,
      endsAt: { lte: new Date(now.getTime() - AFTER_END_MS), gte: new Date(now.getTime() - WINDOW_MS) },
    },
    include: { user: { select: { id: true, name: true, email: true, locale: true } }, coachProfile: { include: { user: { select: { name: true } } } } },
    orderBy: { endsAt: "asc" },
    take: BATCH,
  });
  const { appUrl } = await getSettings();
  let sent = 0;
  for (const b of due) {
    const claim = await db.booking.updateMany({ where: { id: b.id, reviewPromptedAt: null }, data: { reviewPromptedAt: now } });
    if (!claim.count || !b.coachProfile) continue;
    const lang = messageLocale(b.user.locale) === "da" ? "da" : "en";
    await sendMail(reviewPromptMail({ to: b.user.email, playerName: b.user.name, coachName: b.coachProfile.user.name, url: `${appUrl}/profile#review`, locale: b.user.locale })).catch((err) => console.error("Review prompt e-mail failed:", err));
    const copy = pushCopy("reviewPrompt", lang);
    await enqueue(b.user.id, `review:${b.id}`, "coaching", copy.title, copy.body, { screen: "profile" }, new Date(now.getTime() + 3 * 24 * 60 * 60_000), { bookingId: b.id, expectedStatus: "CONFIRMED" }).catch((err) => console.error("Review prompt push failed:", err));
    sent++;
  }
  return { sent };
}
