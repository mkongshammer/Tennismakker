import crypto from "crypto";
import { db } from "./db";
import { sendMail } from "./email";
import { getSettings } from "./settings";

const FIRST_EMAIL_AFTER_DAYS = 4;
const INTERVAL_DAYS = 14;
const CAMPAIGN_COUNT = 26;

type Variant = {
  subject: string;
  lines: string[];
  cta: string;
  path: string;
};

type Campaign = {
  player: Variant;
  coach: Variant;
};

const campaigns: Campaign[] = [
  {
    player: { subject: "Playing this week?", lines: ["Feel like getting on court?", "Find someone you have not played before — or book a court and invite someone you already know."], cta: "Find something to play", path: "/matches" },
    coach: { subject: "Got an open coaching slot?", lines: ["Do you have an open hour in your calendar this week?", "Add it to RacketBuddy so nearby players can find and book you."], cta: "Add a coaching slot", path: "/profile/coaching" },
  },
  {
    player: { subject: "Try a different racket sport", lines: ["Usually play tennis? Try padel or pickleball.", "RacketBuddy makes it easy to find players, courts and coaches across racket sports."], cta: "Explore your options", path: "/courts" },
    coach: { subject: "Do you coach more than one sport?", lines: ["If you coach more than one racket sport, make sure it shows on your profile.", "It can make you visible to many more players."], cta: "View your coach profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Play someone you have never met", lines: ["It is easy to end up playing the same people every time.", "Find a new player around your level and get a different kind of match."], cta: "Find a new opponent", path: "/matches" },
    coach: { subject: "New players are looking for coaches", lines: ["New players keep joining RacketBuddy.", "Keep some available slots visible so they can find and book you."], cta: "Add available times", path: "/profile/coaching" },
  },
  {
    player: { subject: "Who are you taking on court?", lines: ["Find an available court on RacketBuddy and send the time to a friend.", "Sometimes all it takes is one person making the first move."], cta: "Find a court", path: "/courts" },
    coach: { subject: "Fill a gap in your calendar", lines: ["Got an empty hour between sessions?", "Make it bookable on RacketBuddy and see if a player takes it."], cta: "Open a time slot", path: "/profile/coaching" },
  },
  {
    player: { subject: "One coaching session can make a difference", lines: ["Serve, backhand, volley or just more consistency?", "Find a coach and work on exactly what you want to improve."], cta: "Find a coach", path: "/coaches" },
    coach: { subject: "What are you best at teaching?", lines: ["Players are not just looking for a coach — they are looking for help with something specific.", "Make it clear on your profile what you can help them improve."], cta: "Update your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Got a free hour?", lines: ["A free hour can quickly turn into a match.", "Open RacketBuddy and see who wants to play nearby."], cta: "See players near you", path: "/matches" },
    coach: { subject: "A cancellation does not have to mean an empty hour", lines: ["If someone cancels, put the slot on RacketBuddy.", "Another player may be able to take it."], cta: "Add a time", path: "/profile/coaching" },
  },
  {
    player: { subject: "Find someone at your level", lines: ["The best matches are often the ones where the level is right.", "Use RacketBuddy to find players who are a better match for you."], cta: "Find players", path: "/players" },
    coach: { subject: "Help players find the right coaching", lines: ["Make it clear which levels you coach.", "Beginner, recreational or competitive — it helps match you with the right players."], cta: "Update your coach profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Plans for the weekend?", lines: ["If your calendar still has some room, get a match in.", "Find a player or a court on RacketBuddy."], cta: "Plan your weekend match", path: "/matches" },
    coach: { subject: "Do you have weekend availability?", lines: ["Weekend slots can be especially attractive to players who are busy during the week.", "Add them if you have space."], cta: "Add weekend times", path: "/profile/coaching" },
  },
  {
    player: { subject: "Time for a rematch?", lines: ["Lost the last one?", "There is only one answer: book another match."], cta: "Find a court", path: "/courts" },
    coach: { subject: "Get your players back on court", lines: ["Have players you have not seen in a while?", "Keep available times on RacketBuddy so it is easy for them to come back."], cta: "View your availability", path: "/profile/coaching" },
  },
  {
    player: { subject: "Your next playing partner may already be on RacketBuddy", lines: ["Racket sports are also a great way to meet new people.", "See who plays near you and ask if they want a match."], cta: "Find a playing partner", path: "/matches" },
    coach: { subject: "Make it easy for new players to choose you", lines: ["A strong profile and visible availability make a big difference when a player does not know you yet.", "Check how your profile looks."], cta: "View my profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Have you tried pickleball?", lines: ["If not, maybe now is the time.", "It is quick to learn and a fun change from tennis or padel."], cta: "Explore a new sport", path: "/courts" },
    coach: { subject: "Do you coach pickleball too?", lines: ["If you also coach pickleball, add it to your RacketBuddy profile.", "That makes you visible to players who want to try something new."], cta: "Update your sports", path: "/profile/coaching" },
  },
  {
    player: { subject: "Match after work?", lines: ["Instead of another evening on the couch, find an available court and get an hour on court."], cta: "See available courts", path: "/courts" },
    coach: { subject: "Do you have after-work availability?", lines: ["Late-afternoon and evening slots are often the easiest for players to book.", "Make sure your available times are visible."], cta: "Manage your availability", path: "/profile/coaching" },
  },
  {
    player: { subject: "How much have you actually played lately?", lines: ["It is easy to end up playing less than you would like.", "Put your next match in the calendar now."], cta: "Book your next match", path: "/courts" },
    coach: { subject: "How does your coaching calendar look?", lines: ["If you want a few more sessions, start by opening some extra times on RacketBuddy."], cta: "Open more times", path: "/profile/coaching" },
  },
  {
    player: { subject: "Play someone slightly better than you", lines: ["One of the best ways to improve is to play someone who pushes you a little harder."], cta: "Find a challenge", path: "/players" },
    coach: { subject: "Players want to reach the next level", lines: ["Make it clear how you help players improve — technique, tactics, fitness or match play."], cta: "Update your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Who plays near you?", lines: ["There may be more players close to you than you think.", "Open RacketBuddy and see what is available in your area."], cta: "See what is nearby", path: "/players" },
    coach: { subject: "Get found by players near you", lines: ["Local players are often the easiest to turn into regular clients.", "Make sure your location is correct on RacketBuddy."], cta: "Check my profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Change court, not sport", lines: ["Bad weather or fully booked courts do not have to stop you.", "See which other courts and clubs are available nearby."], cta: "Find another court", path: "/courts" },
    coach: { subject: "Make your other locations visible", lines: ["If you coach at more than one location, make it clear on your profile.", "More locations can give players more ways to book you."], cta: "Update your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Who is your fourth player?", lines: ["Missing one player for doubles?", "See if you can find the final player through RacketBuddy."], cta: "Find a player", path: "/matches" },
    coach: { subject: "Do you offer coaching for multiple players?", lines: ["If you offer pairs, group or team sessions, show it on your profile.", "It can be attractive for both players and you."], cta: "Update your coaching options", path: "/profile/coaching" },
  },
  {
    player: { subject: "Been a while?", lines: ["You do not need to be in top form to come back.", "Find a relaxed match and get back on court."], cta: "Get back on court", path: "/matches" },
    coach: { subject: "Plenty of players want to start again", lines: ["Returning players often look for a coach when they get back into the sport.", "Make it clear if you help players restart or make a comeback."], cta: "Update your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "You do not have to be good to play", lines: ["Everyone starts somewhere.", "Find other beginners or a coach and get started without worrying about your level."], cta: "Find someone to play", path: "/matches" },
    coach: { subject: "Are beginners welcome?", lines: ["Many new players are unsure which coach to choose.", "If you are great with beginners, make sure they know it."], cta: "Update your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Have you tried playing in the morning?", lines: ["Courts can be quieter, and it is a great way to start the day."], cta: "See morning times", path: "/courts" },
    coach: { subject: "Can you fill your morning hours?", lines: ["If you have availability earlier in the day, it may be worth listing it.", "Some players specifically prefer mornings and late mornings."], cta: "Add morning times", path: "/profile/coaching" },
  },
  {
    player: { subject: "What do you want to improve?", lines: ["Pick one thing: serve, forehand, volley, positioning or tactics.", "Find a coach and spend an hour working on exactly that."], cta: "Find the right coach", path: "/coaches" },
    coach: { subject: "Show players your specialty", lines: ["Is there something you are especially good at coaching?", "Add it to your profile so the right players can find you more easily."], cta: "Edit your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Have you played somewhere new?", lines: ["It is easy to always play at the same place.", "See which other clubs and courts are available around you on RacketBuddy."], cta: "Explore clubs", path: "/courts" },
    coach: { subject: "Do you coach at more than one club?", lines: ["If players can meet you at several locations, make that clear on your profile.", "More locations can mean more potential players."], cta: "Update your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "Bring a friend", lines: ["Know someone who should spend more time on court?", "Find a time and invite them along."], cta: "Book a court", path: "/courts" },
    coach: { subject: "Make it easy to bring a friend", lines: ["Pairs and group coaching can be an easy way for new players to try a session.", "If you offer it, make sure it is visible."], cta: "Update your coaching types", path: "/profile/coaching" },
  },
  {
    player: { subject: "Ready for a real match?", lines: ["Not practice. Not just hitting balls.", "Find an opponent and see who gets the win."], cta: "Find a match", path: "/matches" },
    coach: { subject: "Do you offer match play coaching?", lines: ["Many players want to get better at the match itself — not just individual shots.", "If you offer match play or tactical coaching, make it clear."], cta: "Update your profile", path: "/profile/coaching" },
  },
  {
    player: { subject: "One match a week?", lines: ["It does not have to be more complicated than that.", "One regular match a week can add up to a lot more playing over a year."], cta: "Plan your next match", path: "/matches" },
    coach: { subject: "Could you get more regular players?", lines: ["One session is good. A regular weekly player is even better.", "Keep your calendar updated so players can easily find a time that could become a regular slot."], cta: "Manage your calendar", path: "/profile/coaching" },
  },
  {
    player: { subject: "What are you playing next?", lines: ["Tennis? Padel? Pickleball?", "An old playing partner or someone completely new? Either way, there is only one way to get started."], cta: "Open RacketBuddy", path: "/courts" },
    coach: { subject: "Ready for more hours on court?", lines: ["Keep your profile sharp and your availability up to date so RacketBuddy can help more players find you."], cta: "Go to your coach profile", path: "/profile/coaching" },
  },
];

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function intentKey(email: string) {
  return `engagement-intent:${sha256(email.toLowerCase())}`;
}

function stateKey(userId: string) {
  return `engagement-state:${userId}`;
}

function optoutKey(userId: string) {
  return `engagement-optout:${userId}`;
}

function unsubscribeToken(userId: string) {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "racketbuddy-uden-noegle")
    .update(`engagement:${userId}`)
    .digest("hex");
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function copenhagenHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number(hour);
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function validUnsubscribeToken(userId: string, token: string) {
  const expected = unsubscribeToken(userId);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function unsubscribeEngagementEmails(userId: string) {
  await db.platformSetting.upsert({
    where: { key: optoutKey(userId) },
    update: { value: new Date().toISOString() },
    create: { key: optoutKey(userId), value: new Date().toISOString() },
  });
}

export async function runEngagementEmails() {
  // The sync job runs every 15 minutes. Inspiration emails are only sent
  // around 10:00 Copenhagen time so users do not receive them overnight.
  if (copenhagenHour() !== 10) {
    return { sent: 0, skipped: 0, reason: "outside-send-window" };
  }

  const now = new Date();
  const eligibleBefore = addDays(now, -FIRST_EMAIL_AFTER_DAYS);
  const users = await db.user.findMany({
    where: {
      role: { in: ["PLAYER", "COACH"] },
      createdAt: { lte: eligibleBefore },
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 250,
  });

  if (users.length === 0) return { sent: 0, skipped: 0 };

  const keys = users.flatMap((u) => [intentKey(u.email), stateKey(u.id), optoutKey(u.id)]);
  const rows = await db.platformSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const settingsMap = new Map(rows.map((r) => [r.key, r.value]));
  const { appUrl } = await getSettings();

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const intent = parseJson<{ optedIn?: boolean }>(settingsMap.get(intentKey(user.email)), {});
    if (!intent.optedIn || settingsMap.has(optoutKey(user.id))) {
      skipped++;
      continue;
    }

    const state = parseJson<{ nextIndex?: number; lastSentAt?: string }>(
      settingsMap.get(stateKey(user.id)),
      { nextIndex: 0 }
    );
    const index = Math.max(0, state.nextIndex ?? 0);
    if (index >= CAMPAIGN_COUNT || index >= campaigns.length) {
      skipped++;
      continue;
    }

    const dueAt = state.lastSentAt
      ? addDays(new Date(state.lastSentAt), INTERVAL_DAYS)
      : addDays(user.createdAt, FIRST_EMAIL_AFTER_DAYS);
    if (dueAt > now) {
      skipped++;
      continue;
    }

    const campaign = campaigns[index];
    const variant = user.role === "COACH" ? campaign.coach : campaign.player;
    const firstName = user.name.trim().split(/\s+/)[0] || user.name;
    const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?user=${encodeURIComponent(user.id)}&token=${unsubscribeToken(user.id)}`;
    const body = [
      `Hi ${firstName}`,
      "",
      ...variant.lines.flatMap((line) => [line, ""]),
      `${variant.cta}: ${appUrl}${variant.path}`,
      "",
      "Magnus",
      "RacketBuddy",
      "",
      `Don't want to receive inspiration emails anymore? Unsubscribe here: ${unsubscribeUrl}`,
    ].join("\n");

    const ok = await sendMail({ to: user.email, subject: variant.subject, body });
    if (!ok) {
      skipped++;
      continue;
    }

    const newState = {
      nextIndex: index + 1,
      lastSentAt: now.toISOString(),
    };
    await db.platformSetting.upsert({
      where: { key: stateKey(user.id) },
      update: { value: JSON.stringify(newState) },
      create: { key: stateKey(user.id), value: JSON.stringify(newState) },
    });
    settingsMap.set(stateKey(user.id), JSON.stringify(newState));
    sent++;
  }

  return { sent, skipped };
}
