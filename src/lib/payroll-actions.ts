'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireCustomClub } from './club-management-actions';
import { validPin } from './payroll-core';
import { closePayroll, punchByPin, reopenPayroll } from './payroll';

type State = { ok?: string; error?: string } | null;
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' });

// ----- staff -----
export async function saveStaffMember(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('vagtplan');
    const id = String(form.get('staffId') ?? '');
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase() || null;
    const role = String(form.get('role') ?? '').trim().slice(0, 60) || null;
    const rate = Number(String(form.get('hourlyRate') ?? '0').replace(',', '.'));
    const pin = String(form.get('pin') ?? '').trim();
    const overtimeAfterHours = Number(form.get('overtimeAfterHours') ?? 40);
    if (name.length < 1 || name.length > 80) throw Error('Skriv et navn.');
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000) throw Error('Timelønnen skal være mellem 0 og 1000.');
    if (!validPin(pin)) throw Error('PIN-koden skal være 4–6 cifre.');
    if (!Number.isInteger(overtimeAfterHours) || overtimeAfterHours < 0 || overtimeAfterHours > 80) throw Error('Overtid efter: 0–80 timer om ugen.');
    const taken = await db.staffMember.findUnique({ where: { clubId_pin: { clubId: club.id, pin } }, select: { id: true } });
    if (taken && taken.id !== id) throw Error('Den PIN-kode bruges allerede af en anden.');
    const data = { name, email, role, hourlyRateCents: Math.round(rate * 100), pin, overtimeAfterHours };
    if (id) await db.staffMember.updateMany({ where: { id, clubId: club.id }, data });
    else await db.staffMember.create({ data: { ...data, clubId: club.id } });
    revalidatePath('/admin/vagtplan');
    return { ok: id ? `${name} er opdateret.` : `${name} er tilføjet. PIN-koden bruges på stempeluret.` };
  } catch (e) { return fail(e); }
}

export async function staffAdminAction(form: FormData) {
  const { club } = await requireCustomClub('vagtplan');
  const intent = String(form.get('intent') ?? '');
  const staffId = String(form.get('staffId') ?? '');
  if (intent === 'deactivate' || intent === 'activate') await db.staffMember.updateMany({ where: { id: staffId, clubId: club.id }, data: { active: intent === 'activate' } });
  revalidatePath('/admin/vagtplan');
}

// ----- time entries -----
export async function saveTimeEntry(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('vagtplan');
    const staffId = String(form.get('staffId') ?? '');
    const staff = await db.staffMember.findFirst({ where: { id: staffId, clubId: club.id }, select: { id: true, name: true } });
    if (!staff) throw Error('Vælg en ansat.');
    const { wallTime } = await import('./international');
    const day = String(form.get('day') ?? '');
    const [sh, sm] = String(form.get('start') ?? '').split(':').map(Number); const [eh, em] = String(form.get('end') ?? '').split(':').map(Number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(sh) || !Number.isFinite(eh)) throw Error('Vælg dag og tidspunkt.');
    const clockIn = wallTime(day, sh, sm || 0, club.timeZone)!; let clockOut = wallTime(day, eh, em || 0, club.timeZone)!;
    if (clockOut <= clockIn) clockOut = new Date(clockOut.getTime() + 86_400_000); // past midnight
    const breakMinutes = Math.max(0, Math.min(480, Number(form.get('breakMinutes') ?? 0) || 0));
    const note = String(form.get('note') ?? '').trim().slice(0, 200) || null;
    const id = String(form.get('entryId') ?? '');
    if (id) {
      const existing = await db.timeEntry.findFirst({ where: { id, clubId: club.id }, select: { payrollRunId: true } });
      if (existing?.payrollRunId) throw Error('Den registrering er med i en lukket lønkørsel.');
      await db.timeEntry.updateMany({ where: { id, clubId: club.id }, data: { staffId, clockIn, clockOut, breakMinutes, note } });
    } else await db.timeEntry.create({ data: { clubId: club.id, staffId, clockIn, clockOut, breakMinutes, note, source: 'MANUAL' } });
    revalidatePath('/admin/vagtplan');
    return { ok: id ? 'Registreringen er rettet.' : `Timer registreret for ${staff.name}.` };
  } catch (e) { return fail(e); }
}

export async function timeEntryAction(form: FormData) {
  const { club } = await requireCustomClub('vagtplan');
  const intent = String(form.get('intent') ?? '');
  const id = String(form.get('entryId') ?? '');
  const entry = await db.timeEntry.findFirst({ where: { id, clubId: club.id } });
  if (!entry || entry.payrollRunId) { revalidatePath('/admin/vagtplan'); return; }
  if (intent === 'delete') await db.timeEntry.delete({ where: { id } });
  if (intent === 'clockOut' && !entry.clockOut) await db.timeEntry.update({ where: { id }, data: { clockOut: new Date() } });
  revalidatePath('/admin/vagtplan');
}

// ----- payroll -----
export async function closePayrollAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('vagtplan');
    const { wallTime } = await import('./international');
    const from = String(form.get('from') ?? ''), to = String(form.get('to') ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw Error('Vælg en periode.');
    const start = wallTime(from, 0, 0, club.timeZone)!, end = new Date(wallTime(to, 0, 0, club.timeZone)!.getTime() + 86_400_000);
    if (end <= start) throw Error('Perioden skal slutte efter den begynder.');
    const r = await closePayroll(club.id, start, end, club.timeZone, club.currency);
    if (!r.ok) throw Error(r.error);
    revalidatePath('/admin/vagtplan');
    return { ok: `Lønkørslen er lukket: ${JSON.parse(r.run.lines).length} ansatte, i alt ${(r.run.totalCents / 100).toFixed(2)} ${r.run.currency}. Hent CSV-filen til lønsystemet nedenfor.` };
  } catch (e) { return fail(e); }
}

export async function reopenPayrollAction(form: FormData) {
  const { club } = await requireCustomClub('vagtplan');
  await reopenPayroll(club.id, String(form.get('runId') ?? ''));
  revalidatePath('/admin/vagtplan');
}

// ----- the desk tablet -----
export async function punchAction(form: FormData) {
  const slug = String(form.get('slug') ?? '');
  const pin = String(form.get('pin') ?? '').trim();
  const club = await db.club.findUnique({ where: { slug }, select: { id: true } });
  if (!club) redirect('/');
  const r = validPin(pin) ? await punchByPin(club!.id, pin) : { ok: false as const, error: 'Enter your 4–6 digit PIN.' };
  const q = new URLSearchParams(r.ok ? { who: r.name, dir: r.direction, at: r.at.toISOString(), ...(r.since ? { since: r.since.toISOString() } : {}), ...(r.capped ? { capped: '1' } : {}) } : { error: r.error });
  redirect(`/clubs/${slug}/clock?${q}`);
}
