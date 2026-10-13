import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';

/**
 * Isolated capacity simulation for the US market.
 *
 * IMPORTANT: run only against the disposable database supplied by the
 * GitHub Actions workflow. The script refuses non-local database hosts so a
 * load test can never seed production by mistake.
 */

const dbUrl = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost', 'postgres'].includes(dbUrl.hostname)) {
  throw new Error(`Refusing capacity simulation against non-local database host: ${dbUrl.hostname}`);
}

const db = new PrismaClient();

const CLUBS = Number(process.env.SIM_CLUBS ?? 1000);
const PLAYERS_PER_CLUB = Number(process.env.SIM_PLAYERS_PER_CLUB ?? 100);
const COACHES_PER_CLUB = Number(process.env.SIM_COACHES_PER_CLUB ?? 8);
const COURTS_PER_CLUB = Number(process.env.SIM_COURTS_PER_CLUB ?? 6);
const BOOKINGS_PER_CLUB = Number(process.env.SIM_BOOKINGS_PER_CLUB ?? 30);
const THREADS_PER_CLUB = Number(process.env.SIM_THREADS_PER_CLUB ?? 6);
const SAMPLE_ACTIONS = Number(process.env.SIM_SAMPLE_ACTIONS ?? 12000);
const CONCURRENCY = Number(process.env.SIM_CONCURRENCY ?? 40);
const MODELED_DAILY_ACTIONS = Number(process.env.SIM_DAILY_ACTIONS ?? 250000);

if (![CLUBS, PLAYERS_PER_CLUB, COACHES_PER_CLUB, COURTS_PER_CLUB, BOOKINGS_PER_CLUB, THREADS_PER_CLUB, SAMPLE_ACTIONS, CONCURRENCY].every(Number.isFinite)) {
  throw new Error('Invalid simulation settings.');
}

const cities = [
  ['Boston', 'MA', 'America/New_York'],
  ['New York', 'NY', 'America/New_York'],
  ['Miami', 'FL', 'America/New_York'],
  ['Chicago', 'IL', 'America/Chicago'],
  ['Dallas', 'TX', 'America/Chicago'],
  ['Denver', 'CO', 'America/Denver'],
  ['Phoenix', 'AZ', 'America/Phoenix'],
  ['Los Angeles', 'CA', 'America/Los_Angeles'],
  ['Seattle', 'WA', 'America/Los_Angeles'],
] as const;

const pad = (n: number, width = 6) => String(n).padStart(width, '0');
const clubId = (i: number) => `sim-club-${pad(i, 4)}`;
const courtId = (club: number, court: number) => `sim-court-${pad(club, 4)}-${pad(court, 2)}`;
const playerId = (i: number) => `sim-player-${pad(i)}`;
const coachUserId = (i: number) => `sim-coach-user-${pad(i)}`;
const coachId = (i: number) => `sim-coach-${pad(i)}`;
const adminId = (i: number) => `sim-admin-${pad(i, 4)}`;
const threadId = (i: number) => `sim-thread-${pad(i)}`;

async function createManyChunks<T>(rows: T[], write: (chunk: T[]) => Promise<unknown>, chunkSize = 2000) {
  for (let i = 0; i < rows.length; i += chunkSize) await write(rows.slice(i, i + chunkSize));
}

async function seed() {
  const started = performance.now();
  const clubs = Array.from({ length: CLUBS }, (_, i) => {
    const [city, state, timeZone] = cities[i % cities.length];
    return {
      id: clubId(i), slug: `us-sim-club-${i}`, name: `US Simulation Club ${pad(i, 4)}`,
      city, address: `${100 + (i % 800)} Test Ave, ${city}, ${state} 00000`,
      country: 'US', currency: 'USD', billingCurrency: 'USD', timeZone,
      status: 'APPROVED', approvedAt: new Date(), sports: 'TENNIS,PADEL',
      solutionMode: i % 5 === 0 ? 'CUSTOM' : 'STANDARD', billingModel: 'SUBSCRIPTION',
      subscriptionKr: 30, subscriptionStatus: 'active', signupManaged: true,
      signupPaidAt: new Date(), stripeChargesEnabled: true, stripePayoutsEnabled: true,
      priceHour: 25 + (i % 35), latitude: 25 + (i % 24), longitude: -122 + (i % 50),
    };
  });
  await createManyChunks(clubs, chunk => db.club.createMany({ data: chunk }));

  const courts = Array.from({ length: CLUBS * COURTS_PER_CLUB }, (_, i) => {
    const c = Math.floor(i / COURTS_PER_CLUB), n = i % COURTS_PER_CLUB;
    return { id: courtId(c, n), clubId: clubId(c), name: `Court ${n + 1}`, sport: n % 5 === 0 ? 'PADEL' : 'TENNIS', surface: n % 2 ? 'HARD' : 'INDE', indoor: n % 2 === 0, priceHour: 25 + (c % 35) };
  });
  await createManyChunks(courts, chunk => db.court.createMany({ data: chunk }));

  const admins = Array.from({ length: CLUBS }, (_, i) => ({
    id: adminId(i), email: `admin-${i}@capacity.invalid`, passwordHash: 'unusable', name: `Admin ${i}`,
    role: 'CLUB_ADMIN', country: 'US', locale: 'en-US', countryChosen: true, clubId: clubId(i), sports: 'TENNIS,PADEL',
  }));
  await createManyChunks(admins, chunk => db.user.createMany({ data: chunk }));

  const totalPlayers = CLUBS * PLAYERS_PER_CLUB;
  const players = Array.from({ length: totalPlayers }, (_, i) => {
    const c = Math.floor(i / PLAYERS_PER_CLUB), [city, state] = cities[c % cities.length];
    return {
      id: playerId(i), email: `player-${i}@capacity.invalid`, passwordHash: 'unusable', name: `Player ${i}`,
      role: 'PLAYER', level: 1 + (i % 7), area: `${city}, ${state}`, country: 'US', locale: 'en-US',
      countryChosen: true, sports: i % 4 === 0 ? 'TENNIS,PADEL' : 'TENNIS', clubId: clubId(c), bio: 'US capacity simulation player',
    };
  });
  await createManyChunks(players, chunk => db.user.createMany({ data: chunk }));

  const totalCoaches = CLUBS * COACHES_PER_CLUB;
  const coachUsers = Array.from({ length: totalCoaches }, (_, i) => {
    const c = Math.floor(i / COACHES_PER_CLUB), [city, state] = cities[c % cities.length];
    return {
      id: coachUserId(i), email: `coach-${i}@capacity.invalid`, passwordHash: 'unusable', name: `Coach ${i}`,
      role: 'COACH', level: 5 + (i % 3), area: `${city}, ${state}`, country: 'US', locale: 'en-US',
      countryChosen: true, sports: i % 3 === 0 ? 'TENNIS,PADEL' : 'TENNIS', clubId: clubId(c), bio: 'US capacity simulation coach',
    };
  });
  await createManyChunks(coachUsers, chunk => db.user.createMany({ data: chunk }));

  const coachProfiles = Array.from({ length: totalCoaches }, (_, i) => {
    const c = Math.floor(i / COACHES_PER_CLUB), [city, state, timeZone] = cities[c % cities.length];
    return {
      id: coachId(i), userId: coachUserId(i), headline: 'USPTA/PTR coach', sports: i % 3 === 0 ? 'TENNIS,PADEL' : 'TENNIS',
      country: 'US', currency: 'USD', timeZone, priceHour: 45 + (i % 80), lessonMinutes: 60,
      specialties: 'Serve,Technique,Match play', area: `${city}, ${state}`, weeklySlots: '[{"day":1,"from":9,"to":20}]',
      stripeChargesEnabled: true, stripePayoutsEnabled: true,
    };
  });
  await createManyChunks(coachProfiles, chunk => db.coachProfile.createMany({ data: chunk }));

  const now = Date.now();
  const bookings = Array.from({ length: CLUBS * BOOKINGS_PER_CLUB }, (_, i) => {
    const c = Math.floor(i / BOOKINGS_PER_CLUB), slot = i % BOOKINGS_PER_CLUB, player = c * PLAYERS_PER_CLUB + (slot % PLAYERS_PER_CLUB);
    const startsAt = new Date(now + ((slot % 14) + 1) * 86400000 + (8 + (slot % 10)) * 3600000);
    return {
      id: `sim-booking-${pad(i)}`, kind: 'COURT', status: 'CONFIRMED', startsAt, endsAt: new Date(+startsAt + 3600000),
      priceKr: 25 + (c % 35), currency: 'USD', timeZone: cities[c % cities.length][2], userId: playerId(player),
      courtId: courtId(c, slot % COURTS_PER_CLUB), holdExpiresAt: null as Date | null,
    };
  });
  await createManyChunks(bookings, chunk => db.booking.createMany({ data: chunk }));

  const totalThreads = CLUBS * THREADS_PER_CLUB;
  const threads = Array.from({ length: totalThreads }, (_, i) => {
    const c = Math.floor(i / THREADS_PER_CLUB), player = c * PLAYERS_PER_CLUB + (i % PLAYERS_PER_CLUB);
    return { id: threadId(i), status: 'MATCHED', message: 'Looking for a match this week', area: `${cities[c % cities.length][0]}, ${cities[c % cities.length][1]}`, level: 1 + (i % 7), sport: 'TENNIS', requesterId: playerId(player), acceptedById: playerId(c * PLAYERS_PER_CLUB + ((i + 1) % PLAYERS_PER_CLUB)) };
  });
  await createManyChunks(threads, chunk => db.matchRequest.createMany({ data: chunk }));

  const messages = Array.from({ length: totalThreads * 3 }, (_, i) => {
    const t = Math.floor(i / 3), c = Math.floor(t / THREADS_PER_CLUB), sender = c * PLAYERS_PER_CLUB + ((t + i) % PLAYERS_PER_CLUB);
    return { id: `sim-message-${pad(i)}`, matchRequestId: threadId(t), senderId: playerId(sender), body: 'Capacity simulation message' };
  });
  await createManyChunks(messages, chunk => db.message.createMany({ data: chunk }));

  return { ms: performance.now() - started, totalPlayers, totalCoaches, totalThreads };
}

type Metric = { name: string; ms: number; ok: boolean };
const metrics: Metric[] = [];
let sequence = 0;

async function measured(name: string, fn: () => Promise<unknown>) {
  const t = performance.now();
  try { await fn(); metrics.push({ name, ms: performance.now() - t, ok: true }); }
  catch (error) { metrics.push({ name, ms: performance.now() - t, ok: false }); throw error; }
}

function pick(max: number) { return Math.floor(Math.random() * max); }

async function operation(index: number) {
  const roll = index % 100;
  if (roll < 24) return measured('player-discovery', async () => {
    await db.user.findMany({
      where: { role: { in: ['PLAYER', 'COACH'] }, country: 'US', sports: { contains: 'TENNIS', mode: 'insensitive' } },
      select: { id: true, name: true, level: true, area: true, bio: true, sports: true, role: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }], take: 500,
    });
  });
  if (roll < 42) return measured('club-discovery', async () => {
    await db.club.findMany({
      where: { status: 'APPROVED', country: 'US', courts: { some: { sport: 'TENNIS' } } },
      include: { courts: { where: { sport: 'TENNIS' } } }, orderBy: { name: 'asc' },
    });
  });
  if (roll < 57) return measured('coach-discovery', async () => {
    await db.coachProfile.findMany({
      where: { sports: { contains: 'TENNIS' }, country: 'US' },
      include: { user: true, packages: { where: { active: true } } }, orderBy: { priceHour: 'asc' },
    });
  });
  if (roll < 70) return measured('player-bookings', async () => {
    await db.booking.findMany({ where: { userId: playerId(pick(CLUBS * PLAYERS_PER_CLUB)), startsAt: { gte: new Date() }, status: { not: 'CANCELLED' } }, orderBy: { startsAt: 'asc' }, take: 20, include: { court: { include: { club: true } }, coachProfile: { include: { user: true } } } });
  });
  if (roll < 80) return measured('admin-dashboard', async () => {
    const c = pick(CLUBS), id = clubId(c);
    await Promise.all([
      db.club.findUnique({ where: { id }, include: { courts: true } }),
      db.user.count({ where: { clubId: id } }),
      db.booking.count({ where: { court: { clubId: id }, startsAt: { gte: new Date(Date.now() - 86400000) } } }),
    ]);
  });
  if (roll < 88) return measured('message-thread', async () => {
    await db.message.findMany({ where: { matchRequestId: threadId(pick(CLUBS * THREADS_PER_CLUB)) }, orderBy: { createdAt: 'asc' }, take: 50 });
  });
  if (roll < 94) return measured('match-feed', async () => {
    await db.matchRequest.findMany({ where: { sport: 'TENNIS', status: { in: ['OPEN', 'MATCHED'] } }, orderBy: { createdAt: 'desc' }, take: 100 });
  });
  return measured('booking-write', async () => {
    const n = sequence++, c = n % CLUBS, p = c * PLAYERS_PER_CLUB + (n % PLAYERS_PER_CLUB), start = new Date(Date.now() + (40 + (n % 30)) * 86400000 + (n % 20) * 3600000);
    await db.booking.create({ data: { id: `sim-live-${process.pid}-${n}`, kind: 'COURT', status: 'CONFIRMED', startsAt: start, endsAt: new Date(+start + 3600000), priceKr: 35, currency: 'USD', timeZone: cities[c % cities.length][2], userId: playerId(p), courtId: courtId(c, n % COURTS_PER_CLUB) } });
  });
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

async function runLoad() {
  const started = performance.now();
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= SAMPLE_ACTIONS) return;
      await operation(i);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return performance.now() - started;
}

async function main() {
  console.log(`US CAPACITY SIMULATION: ${CLUBS} clubs, ${PLAYERS_PER_CLUB} players/club, ${COACHES_PER_CLUB} coaches/club, ${COURTS_PER_CLUB} courts/club`);
  const seeded = await seed();
  console.log(`Seeded ${CLUBS.toLocaleString()} clubs, ${seeded.totalPlayers.toLocaleString()} players, ${seeded.totalCoaches.toLocaleString()} coaches, ${(CLUBS * COURTS_PER_CLUB).toLocaleString()} courts, ${(CLUBS * BOOKINGS_PER_CLUB).toLocaleString()} bookings, ${seeded.totalThreads.toLocaleString()} threads in ${(seeded.ms / 1000).toFixed(1)}s.`);

  // Warm representative query plans/caches before measuring.
  for (let i = 0; i < Math.min(200, SAMPLE_ACTIONS); i++) await operation(i);
  metrics.length = 0;
  const elapsed = await runLoad();

  const byName = new Map<string, Metric[]>();
  for (const m of metrics) byName.set(m.name, [...(byName.get(m.name) ?? []), m]);
  const rows = [...byName.entries()].map(([name, values]) => {
    const ok = values.filter(v => v.ok), times = ok.map(v => v.ms);
    return { name, count: values.length, errors: values.length - ok.length, avgMs: times.reduce((a, b) => a + b, 0) / Math.max(1, times.length), p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), p99Ms: percentile(times, .99), maxMs: Math.max(0, ...times) };
  }).sort((a, b) => b.p95Ms - a.p95Ms);

  const allTimes = metrics.filter(m => m.ok).map(m => m.ms);
  const throughput = SAMPLE_ACTIONS / (elapsed / 1000);
  const errorCount = metrics.filter(m => !m.ok).length;
  const result = {
    dataset: { clubs: CLUBS, players: seeded.totalPlayers, coaches: seeded.totalCoaches, courts: CLUBS * COURTS_PER_CLUB, bookingsBeforeLoad: CLUBS * BOOKINGS_PER_CLUB, messageThreads: seeded.totalThreads },
    load: { sampleActions: SAMPLE_ACTIONS, concurrency: CONCURRENCY, elapsedSeconds: +(elapsed / 1000).toFixed(2), throughputOpsPerSecond: +throughput.toFixed(1), modeledDailyActions: MODELED_DAILY_ACTIONS, modeledAverageOpsPerSecond: +(MODELED_DAILY_ACTIONS / 86400).toFixed(2) },
    overall: { errors: errorCount, avgMs: +(allTimes.reduce((a, b) => a + b, 0) / Math.max(1, allTimes.length)).toFixed(1), p50Ms: +percentile(allTimes, .5).toFixed(1), p95Ms: +percentile(allTimes, .95).toFixed(1), p99Ms: +percentile(allTimes, .99).toFixed(1) },
    operations: rows.map(r => ({ ...r, avgMs: +r.avgMs.toFixed(1), p50Ms: +r.p50Ms.toFixed(1), p95Ms: +r.p95Ms.toFixed(1), p99Ms: +r.p99Ms.toFixed(1), maxMs: +r.maxMs.toFixed(1) })),
  };
  console.log('\n=== US CAPACITY RESULT ===');
  console.log(JSON.stringify(result, null, 2));

  if (errorCount) throw new Error(`${errorCount} simulated operations failed.`);
  // This is intentionally a warning rather than a hard fail: the workflow runner
  // is not production Render hardware. Large p95 values should guide optimization.
  const slow = rows.filter(r => r.p95Ms > 1000).map(r => `${r.name}:${r.p95Ms.toFixed(0)}ms`);
  if (slow.length) console.warn(`CAPACITY WARNING: p95 > 1s for ${slow.join(', ')}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => db.$disconnect());
