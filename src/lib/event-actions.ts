'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { getCurrentUser } from './session';
import { requireCustomClub } from './club-management-actions';
import { EVENT_KINDS, joinLadder, reportLadderResult, signUpForEvent, withdrawFromEvent } from './events';
import { SPORTS } from './sports';
import { FORMATS, type Format } from './tournament-draw';
import { clearResult, drawTournament, recordResult, resetDraw } from './tournament';

type State = { ok?: string; error?: string } | null;
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' });

// ----- club admin -----
export async function createEvent(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('events');
    const name = String(form.get('name') ?? '').trim();
    if (name.length < 2 || name.length > 120) throw Error('Giv arrangementet et navn.');
    const kind = String(form.get('kind'));
    if (!(EVENT_KINDS as readonly string[]).includes(kind)) throw Error('Vælg en type.');
    const sport = String(form.get('sport'));
    if (!(SPORTS as readonly string[]).includes(sport)) throw Error('Vælg en sportsgren.');
    const startsAt = new Date(String(form.get('startsAt') ?? '')), endsAt = new Date(String(form.get('endsAt') ?? ''));
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw Error('Vælg start og slut.');
    const priceKr = Number(form.get('priceKr') ?? 0), capacity = Number(form.get('capacity') ?? 0);
    if (!Number.isInteger(priceKr) || priceKr < 0 || priceKr > 5000) throw Error('Prisen skal være mellem 0 og 5000.');
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 500) throw Error('Pladser: 0–500.');
    const closes = String(form.get('signupClosesAt') ?? '');
    const signupClosesAt = closes ? new Date(closes) : null;
    const description = String(form.get('description') ?? '').trim().slice(0, 2000) || null;
    // Tournament format and the knobs the schedule needs.
    const format = kind === 'TOURNAMENT' || kind === 'LEAGUE' ? String(form.get('format') ?? 'NONE') : 'NONE';
    if (format !== 'NONE' && !(FORMATS as string[]).includes(format)) throw Error('Vælg et turneringsformat.');
    const seeding = form.get('seeding') === 'RANDOM' ? 'RANDOM' : 'LEVEL';
    const matchMinutes = Number(form.get('matchMinutes') ?? 60), parallelCourts = Number(form.get('parallelCourts') ?? 2), groupSize = Number(form.get('groupSize') ?? 4);
    if (!Number.isInteger(matchMinutes) || matchMinutes < 15 || matchMinutes > 240) throw Error('Kamplængde: 15–240 minutter.');
    if (!Number.isInteger(parallelCourts) || parallelCourts < 1 || parallelCourts > 20) throw Error('Baner ad gangen: 1–20.');
    if (!Number.isInteger(groupSize) || groupSize < 3 || groupSize > 8) throw Error('Puljestørrelse: 3–8.');
    // Times are entered in the club's time zone.
    const { wallTime } = await import('./international');
    const toUtc = (local: string) => { const [d, t] = local.split('T'); const [h, m] = (t ?? '00:00').split(':').map(Number); return wallTime(d, h, m, club.timeZone)!; };
    await db.clubEvent.create({ data: { clubId: club.id, name, kind, sport, description, startsAt: toUtc(String(form.get('startsAt'))), endsAt: toUtc(String(form.get('endsAt'))), priceKr, capacity, signupClosesAt: signupClosesAt && !Number.isNaN(signupClosesAt.getTime()) ? toUtc(closes) : null, format: format as Format | 'NONE', seeding, matchMinutes, parallelCourts, groupSize } });
    revalidatePath('/admin/events');
    return { ok: `${name} er oprettet.` };
  } catch (e) { return fail(e); }
}

export async function eventAdminAction(form: FormData) {
  const { club } = await requireCustomClub('events');
  const intent = String(form.get('intent'));
  if (intent === 'close' || intent === 'open') await db.clubEvent.updateMany({ where: { id: String(form.get('eventId')), clubId: club.id }, data: { active: intent === 'open' } });
  if (intent === 'removeSignup') {
    const s = await db.eventSignup.findFirst({ where: { id: String(form.get('signupId')), event: { clubId: club.id } }, select: { id: true, eventId: true } });
    if (s) { await db.eventSignup.update({ where: { id: s.id }, data: { status: 'CANCELLED' } }); const { notifyEventWaitlist } = await import('./waitlist'); await notifyEventWaitlist(s.eventId).catch(() => {}); }
  }
  revalidatePath('/admin/events');
}

// ----- tournament draw -----
export async function drawAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('events');
    const eventId = String(form.get('eventId') ?? '');
    const intent = String(form.get('intent') ?? 'draw');
    if (intent === 'reset') { await resetDraw(club.id, eventId); revalidatePath('/admin/events'); revalidatePath('/clubs', 'layout'); return { ok: 'Lodtrækningen er nulstillet.' }; }
    const r = await drawTournament(club.id, eventId);
    revalidatePath('/admin/events'); revalidatePath('/clubs', 'layout');
    return r.ok ? { ok: `Lodtrækningen er lavet: ${r.matches} kampe. Deltagerne har fået en e-mail med deres første kamp.` } : { error: r.error };
  } catch (e) { return fail(e); }
}

export async function matchResultAction(form: FormData) {
  const { club } = await requireCustomClub('events');
  const matchId = String(form.get('matchId') ?? '');
  if (form.get('intent') === 'clear') { await clearResult(club.id, matchId); }
  else {
    const winnerId = String(form.get('winnerId') ?? '');
    if (winnerId) await recordResult(club.id, matchId, winnerId, String(form.get('score') ?? '').trim() || null);
  }
  revalidatePath('/admin/events'); revalidatePath('/clubs', 'layout');
}

export async function createLadder(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('events');
    const name = String(form.get('name') ?? '').trim();
    const sport = String(form.get('sport'));
    if (name.length < 2 || name.length > 80) throw Error('Giv ranglisten et navn.');
    if (!(SPORTS as readonly string[]).includes(sport)) throw Error('Vælg en sportsgren.');
    await db.ladder.create({ data: { clubId: club.id, name, sport } });
    revalidatePath('/admin/events');
    return { ok: `${name} er oprettet. Medlemmer kan nu melde sig til på klubbens side.` };
  } catch (e) { return fail(e); }
}

export async function ladderAdminAction(form: FormData) {
  const { club } = await requireCustomClub('events');
  const intent = String(form.get('intent'));
  if (intent === 'close' || intent === 'open') await db.ladder.updateMany({ where: { id: String(form.get('ladderId')), clubId: club.id }, data: { active: intent === 'open' } });
  revalidatePath('/admin/events'); revalidatePath('/clubs', 'layout');
}

// ----- players -----
export async function joinEventAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const eventId = String(form.get('eventId') ?? ''), slug = String(form.get('slug') ?? '');
  const r = await signUpForEvent(user!.id, eventId);
  if (!r.ok) redirect(`/clubs/${slug}/events/${eventId}?error=${encodeURIComponent(r.error)}`);
  if (r.checkoutUrl) redirect(r.checkoutUrl);
  redirect(`/clubs/${slug}/events/${eventId}?signup=ok`);
}

export async function withdrawEventAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const eventId = String(form.get('eventId') ?? ''), slug = String(form.get('slug') ?? '');
  const r = await withdrawFromEvent(user!.id, eventId);
  redirect(`/clubs/${slug}/events/${eventId}${r.ok ? '?signup=withdrawn' : `?error=${encodeURIComponent(r.error)}`}`);
}

export async function joinLadderAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const slug = String(form.get('slug') ?? '');
  const r = await joinLadder(user!.id, String(form.get('ladderId') ?? ''));
  redirect(`/clubs/${slug}/ladder${r.ok ? '' : `?error=${encodeURIComponent(r.error)}`}`);
}

export async function reportResultAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const slug = String(form.get('slug') ?? '');
  const ladderId = String(form.get('ladderId') ?? '');
  const iWon = form.get('outcome') === 'won';
  const other = String(form.get('opponentId') ?? '');
  const r = await reportLadderResult(user!.id, ladderId, iWon ? user!.id : other, iWon ? other : user!.id, String(form.get('score') ?? '').trim() || null);
  redirect(`/clubs/${slug}/ladder${r.ok ? '?reported=1' : `?error=${encodeURIComponent(r.error)}`}`);
}
