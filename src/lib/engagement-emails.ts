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
    player: { subject: "Skal du spille i denne uge?", lines: ["Har du lyst til at komme på banen?", "Find en spiller, du ikke har spillet med før — eller find en bane og invitér en, du allerede kender."], cta: "Find noget at spille", path: "/makkere" },
    coach: { subject: "Har du en ledig træningstime?", lines: ["Har du en ledig time i kalenderen i denne uge?", "Læg den på RacketBuddy, så spillere i nærheden kan finde og booke dig."], cta: "Opret en træningstid", path: "/profil/traener" },
  },
  {
    player: { subject: "Prøv en anden ketsjersport", lines: ["Spiller du normalt tennis? Prøv padel eller pickleball.", "RacketBuddy gør det nemt at finde spillere, baner og trænere på tværs af ketsjersport."], cta: "Se mulighederne", path: "/book" },
    coach: { subject: "Kan du træne flere sportsgrene?", lines: ["Hvis du underviser i mere end én ketsjersport, så sørg for at det fremgår på din profil.", "Det kan gøre dig synlig for langt flere spillere."], cta: "Se din trænerprofil", path: "/profil/traener" },
  },
  {
    player: { subject: "Spil mod en, du aldrig har mødt", lines: ["Det bliver hurtigt de samme mennesker, man spiller med.", "Find en ny spiller omkring dit niveau og få en anderledes kamp."], cta: "Find en ny modstander", path: "/makkere" },
    coach: { subject: "Nye spillere leder efter trænere", lines: ["Der kommer løbende nye spillere ind på RacketBuddy.", "Sørg for, at du har ledige tider synlige, så de også kan finde dig."], cta: "Tilføj ledige tider", path: "/profil/traener" },
  },
  {
    player: { subject: "Hvem skal du have med på banen?", lines: ["Find en ledig bane på RacketBuddy og send tiden til en ven.", "Nogle gange er det eneste, der mangler, at én tager initiativet."], cta: "Find en bane", path: "/book" },
    coach: { subject: "Fyld et hul i kalenderen", lines: ["Har du en tom time mellem to træninger?", "Gør den bookbar på RacketBuddy og se, om en spiller tager den."], cta: "Åbn en tid", path: "/profil/traener" },
  },
  {
    player: { subject: "Én træning kan gøre en forskel", lines: ["Serv, baghånd, volley eller bare lidt mere stabilitet?", "Find en træner og arbejd på præcis det, du gerne vil forbedre."], cta: "Find en træner", path: "/traenere" },
    coach: { subject: "Hvad er du bedst til at lære fra dig?", lines: ["Spillere leder ikke bare efter en træner — de leder efter hjælp til noget bestemt.", "Gør det tydeligt på din profil, hvad du kan hjælpe med."], cta: "Opdater din profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Har du en ledig time?", lines: ["En fri time kan hurtigt blive til en kamp.", "Åbn RacketBuddy og se, hvem der vil spille i nærheden."], cta: "Se spillere nær dig", path: "/makkere" },
    coach: { subject: "En aflysning behøver ikke blive en tom time", lines: ["Hvis du får en aflysning, kan du lægge tiden ud på RacketBuddy.", "En anden spiller kan måske tage den."], cta: "Tilføj en tid", path: "/profil/traener" },
  },
  {
    player: { subject: "Find nogen på dit niveau", lines: ["De bedste kampe er ofte dem, hvor niveauet passer.", "Brug RacketBuddy til at finde spillere, der matcher dig bedre."], cta: "Find spillere", path: "/spillere" },
    coach: { subject: "Hjælp spillerne med at finde den rigtige træning", lines: ["Skriv tydeligt hvilke niveauer du underviser.", "Begynder, motionist eller turneringsspiller — det gør det lettere at matche dig med de rigtige kunder."], cta: "Opdater trænerprofil", path: "/profil/traener" },
  },
  {
    player: { subject: "Planer i weekenden?", lines: ["Hvis kalenderen stadig er lidt tom, så få en kamp ind.", "Find en spiller eller en bane på RacketBuddy."], cta: "Planlæg weekendens kamp", path: "/makkere" },
    coach: { subject: "Har du tider i weekenden?", lines: ["Weekendtimer kan være attraktive for spillere, der ikke kan træne i hverdagen.", "Læg dem ud, hvis du har plads."], cta: "Tilføj weekendtider", path: "/profil/traener" },
  },
  {
    player: { subject: "Tid til revanche?", lines: ["Tabte du den sidste?", "Så er der kun én løsning: book en ny kamp."], cta: "Find en bane", path: "/book" },
    coach: { subject: "Få dine spillere tilbage på banen", lines: ["Har du spillere, du ikke har set i et stykke tid?", "Hav ledige tider på RacketBuddy, så det er nemt for dem at komme tilbage."], cta: "Se dine tider", path: "/profil/traener" },
  },
  {
    player: { subject: "Din næste makker er måske allerede på RacketBuddy", lines: ["Ketsjersport er også en ret god måde at møde nye mennesker på.", "Se hvem der spiller omkring dig og spørg, om de vil tage en kamp."], cta: "Find en makker", path: "/makkere" },
    coach: { subject: "Gør det nemt for nye spillere at vælge dig", lines: ["En god profil og synlige tider gør en stor forskel, når en spiller ikke kender dig i forvejen.", "Tjek hvordan din profil ser ud."], cta: "Se min profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Har du prøvet pickleball?", lines: ["Hvis ikke, er det måske på tide.", "Det er hurtigt at lære og en god afveksling fra tennis og padel."], cta: "Udforsk en ny sport", path: "/book" },
    coach: { subject: "Underviser du også i pickleball?", lines: ["Hvis du også kan undervise i pickleball, så tilføj det til din RacketBuddy-profil.", "Det gør dig synlig for spillere, der vil prøve noget nyt."], cta: "Opdater sportsgrene", path: "/profil/traener" },
  },
  {
    player: { subject: "Kamp efter arbejde?", lines: ["I stedet for endnu en aften på sofaen: find en ledig bane og få en time på banen."], cta: "Se ledige baner", path: "/book" },
    coach: { subject: "Har du tider efter arbejde?", lines: ["Tider sidst på eftermiddagen og om aftenen er ofte de nemmeste for spillere at booke.", "Sørg for, at dine ledige tider er synlige."], cta: "Administrer tider", path: "/profil/traener" },
  },
  {
    player: { subject: "Hvor meget har du egentlig spillet?", lines: ["Det er let at få spillet mindre, end man egentlig gerne vil.", "Sæt en kamp i kalenderen nu."], cta: "Book næste kamp", path: "/book" },
    coach: { subject: "Hvordan ser din træningskalender ud?", lines: ["Hvis du gerne vil have lidt flere træninger ind, så start med at åbne nogle ekstra tider på RacketBuddy."], cta: "Åbn flere tider", path: "/profil/traener" },
  },
  {
    player: { subject: "Spil mod en lidt bedre end dig", lines: ["En af de bedste måder at blive bedre på er at spille mod nogen, der presser dig lidt mere."], cta: "Find en udfordring", path: "/spillere" },
    coach: { subject: "Spillere vil gerne tage næste niveau", lines: ["Gør det tydeligt, hvordan du kan hjælpe spillere med at udvikle deres spil — teknik, taktik, fysik eller kamptræning."], cta: "Opdater profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Hvem spiller tæt på dig?", lines: ["Der kan være flere spillere tæt på dig, end du tror.", "Åbn RacketBuddy og se mulighederne i dit område."], cta: "Se hvad der er i nærheden", path: "/spillere" },
    coach: { subject: "Bliv fundet af spillere tæt på dig", lines: ["Lokale spillere er ofte de letteste at få som faste kunder.", "Sørg for, at din lokation er korrekt på RacketBuddy."], cta: "Tjek min profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Skift bane, ikke sport", lines: ["Dårligt vejr eller fulde baner behøver ikke stoppe dig.", "Se hvilke andre baner og klubber der er tilgængelige omkring dig."], cta: "Find en anden bane", path: "/book" },
    coach: { subject: "Gør dine alternative lokationer synlige", lines: ["Hvis du træner flere forskellige steder, så gør det tydeligt på din profil.", "Det giver spillerne flere muligheder for at booke dig."], cta: "Opdater profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Hvem er jeres fjerde spiller?", lines: ["Mangler I én til en double?", "Se om I kan finde den sidste spiller gennem RacketBuddy."], cta: "Find en spiller", path: "/makkere" },
    coach: { subject: "Tilbyder du træning for flere spillere?", lines: ["Hvis du tilbyder par-, gruppe- eller holdtræning, så vis det på din profil.", "Det kan være attraktivt for både spillere og dig."], cta: "Opdater dine tilbud", path: "/profil/traener" },
  },
  {
    player: { subject: "Længe siden sidst?", lines: ["Du behøver ikke være i topform for at komme tilbage.", "Find en hyggelig kamp og kom på banen igen."], cta: "Kom tilbage på banen", path: "/makkere" },
    coach: { subject: "Der er mange, der gerne vil starte igen", lines: ["Tidligere spillere leder ofte efter en træner, når de vil i gang igen.", "Gør det tydeligt, hvis du hjælper med comeback og genopstart."], cta: "Opdater profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Du behøver ikke være god for at spille", lines: ["Alle starter et sted.", "Find andre begyndere eller en træner, og kom i gang uden at bekymre dig om niveauet."], cta: "Find nogen at spille med", path: "/makkere" },
    coach: { subject: "Er begyndere velkomne hos dig?", lines: ["Mange nye spillere er usikre på, hvilken træner de skal vælge.", "Hvis du er god til begyndere, så fortæl dem det."], cta: "Opdater profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Har du prøvet at spille om morgenen?", lines: ["Banerne kan være mere stille, og det er en ret god måde at starte dagen på."], cta: "Se morgentider", path: "/book" },
    coach: { subject: "Kan du fylde morgentimerne?", lines: ["Hvis du har plads tidligere på dagen, kan det være værd at lægge tiderne ud.", "Nogle spillere foretrækker netop morgen og formiddag."], cta: "Tilføj morgentider", path: "/profil/traener" },
  },
  {
    player: { subject: "Hvad vil du gerne være bedre til?", lines: ["Vælg én ting: serv, forhånd, volley, positionering eller taktik.", "Find en træner og brug en time på præcis dét."], cta: "Find den rigtige træner", path: "/traenere" },
    coach: { subject: "Sælg din specialitet", lines: ["Har du noget, du er særligt god til at træne?", "Skriv det på din profil, så den rigtige spiller lettere finder dig."], cta: "Rediger profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Har du spillet et nyt sted?", lines: ["Det er nemt altid at spille samme sted.", "Se hvilke andre klubber og baner der findes omkring dig på RacketBuddy."], cta: "Udforsk klubber", path: "/klubber" },
    coach: { subject: "Træner du i mere end én klub?", lines: ["Hvis spillere kan møde dig flere steder, så gør det tydeligt på din profil.", "Flere lokationer kan betyde flere potentielle spillere."], cta: "Opdater profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Tag en ven med", lines: ["Kender du nogen, der burde komme mere ud på banen?", "Find en tid og invitér dem med."], cta: "Book en bane", path: "/book" },
    coach: { subject: "Gør det nemt at tage en ven med", lines: ["Par- og gruppetræning kan være en nem måde for nye spillere at prøve træning på.", "Hvis du tilbyder det, så gør det synligt."], cta: "Opdater dine træningstyper", path: "/profil/traener" },
  },
  {
    player: { subject: "Klar til en rigtig kamp?", lines: ["Ikke træning. Ikke bare lidt bold.", "Find en modstander og se, hvem der tager sejren."], cta: "Find en kamp", path: "/makkere" },
    coach: { subject: "Tilbyder du matchplay?", lines: ["Mange spillere vil gerne blive bedre til selve kampen — ikke kun slagene.", "Hvis du tilbyder matchplay eller taktisk træning, så gør det tydeligt."], cta: "Opdater din profil", path: "/profil/traener" },
  },
  {
    player: { subject: "Én kamp om ugen?", lines: ["Det behøver ikke være mere kompliceret.", "Én fast kamp om ugen kan være nok til at spille meget mere over et år."], cta: "Planlæg næste kamp", path: "/makkere" },
    coach: { subject: "Kan du få flere faste spillere?", lines: ["En enkelt træning er god. En fast ugentlig spiller er bedre.", "Hold din kalender opdateret, så spillere nemt kan finde en tid, der kan blive fast."], cta: "Administrer kalender", path: "/profil/traener" },
  },
  {
    player: { subject: "Hvad skal du spille næste gang?", lines: ["Tennis? Padel? Pickleball?", "En gammel makker eller en helt ny? Uanset hvad: der er kun én måde at komme i gang."], cta: "Åbn RacketBuddy", path: "/book" },
    coach: { subject: "Klar til flere timer på banen?", lines: ["Hold din profil skarp og dine tider opdaterede, så RacketBuddy kan hjælpe flere spillere med at finde dig."], cta: "Gå til trænerprofil", path: "/profil/traener" },
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
  // Sync-jobbet kører hvert kvarter. Inspirationsmails sendes kun omkring
  // kl. 10 dansk tid, så en bruger ikke får dem midt om natten.
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
      `Hej ${firstName}`,
      "",
      ...variant.lines.flatMap((line) => [line, ""]),
      `${variant.cta}: ${appUrl}${variant.path}`,
      "",
      "Magnus",
      "RacketBuddy",
      "",
      `Vil du ikke have inspirationsmails længere? Afmeld her: ${unsubscribeUrl}`,
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
