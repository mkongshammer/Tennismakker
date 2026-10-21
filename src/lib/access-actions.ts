'use server';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireCustomClub } from './club-management-actions';
import { addCredential, checkAccess, chooseKisiLock, connectKisi, disconnectKisi, ensureAccessSettings, rotateAccessKey } from './access';
import { parseCredentialCsv } from './access-core';

type State = { ok?: string; error?: string; result?: { allow: boolean; code: string; name?: string } } | null;
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' });
const PATH = '/admin/lys-adgang';

export async function saveAccessSettings(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('lys-adgang');
    await ensureAccessSettings(club.id);
    const n = (k: string, lo: number, hi: number, d: number) => { const v = Number(form.get(k) ?? d); if (!Number.isInteger(v) || v < lo || v > hi) throw Error('Kontrollér tallene.'); return v; };
    await db.accessSettings.update({ where: { clubId: club.id }, data: { beforeMinutes: n('beforeMinutes', 0, 120, 15), afterMinutes: n('afterMinutes', 0, 120, 15), memberWithoutBooking: form.get('memberWithoutBooking') === 'on', memberFromHour: n('memberFromHour', 0, 23, 7), memberUntilHour: n('memberUntilHour', 1, 24, 22) } });
    revalidatePath(PATH);
    return { ok: 'Indstillingerne er gemt.' };
  } catch (e) { return fail(e); }
}

export async function rotateAccessKeyAction(_form: FormData) {
  const { club } = await requireCustomClub('lys-adgang');
  await rotateAccessKey(club.id);
  revalidatePath(PATH);
}

export async function addCredentialAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('lys-adgang');
    const uid = String(form.get('uid') ?? '').trim();
    const label = String(form.get('label') ?? '').trim().slice(0, 60) || null;
    const kind = ['FOB', 'CARD', 'CODE', 'PLATE'].includes(String(form.get('kind'))) ? String(form.get('kind')) : 'FOB';
    const who = String(form.get('who') ?? '');
    const until = String(form.get('validUntil') ?? '');
    const validUntil = until ? new Date(`${until}T23:59:59`) : null;
    if (who.startsWith('staff:')) { await addCredential(club.id, uid, { staffId: who.slice(6) }, label, kind, validUntil); }
    else {
      const email = String(form.get('email') ?? '').trim().toLowerCase();
      const member = await db.user.findFirst({ where: { email, clubId: club.id }, select: { id: true, name: true } });
      if (!member) throw Error('Ingen medlem med den e-mail i klubben.');
      await addCredential(club.id, uid, { userId: member.id }, label, kind, validUntil);
    }
    revalidatePath(PATH);
    return { ok: 'Brikken er registreret.' };
  } catch (e) { return fail(e); }
}

export async function importCredentialsAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('lys-adgang');
    const rows = parseCredentialCsv(String(form.get('csv') ?? ''));
    if (!rows.length) throw Error('Ingen linjer med e-mail og UID fundet.');
    let added = 0; const missing: string[] = [];
    for (const r of rows) {
      const member = await db.user.findFirst({ where: { email: r.email, clubId: club.id }, select: { id: true } });
      if (!member) { missing.push(r.email); continue; }
      await addCredential(club.id, r.uid, { userId: member.id }, r.label || null); added++;
    }
    revalidatePath(PATH);
    return { ok: `${added} brikker registreret.`, error: missing.length ? `Ikke fundet som medlem: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}` : undefined };
  } catch (e) { return fail(e); }
}

export async function credentialAction(form: FormData) {
  const { club } = await requireCustomClub('lys-adgang');
  const id = String(form.get('credentialId') ?? ''); const intent = String(form.get('intent') ?? '');
  if (intent === 'deactivate' || intent === 'activate') await db.accessCredential.updateMany({ where: { id, clubId: club.id }, data: { active: intent === 'activate' } });
  if (intent === 'delete') await db.accessCredential.deleteMany({ where: { id, clubId: club.id } });
  revalidatePath(PATH);
}

export async function testAccessAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('lys-adgang');
    const r = await checkAccess(club.id, String(form.get('uid') ?? ''), 'test', 'TEST');
    revalidatePath(PATH);
    return { result: { allow: r.allow, code: r.code, name: r.name } };
  } catch (e) { return fail(e); }
}

export async function kisiAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('lys-adgang');
    const intent = String(form.get('intent') ?? 'connect');
    if (intent === 'disconnect') { await disconnectKisi(club.id); revalidatePath(PATH); return { ok: 'Kisi er koblet fra.' }; }
    if (intent === 'lock') { const [id, ...name] = String(form.get('lock') ?? '').split('|'); if (!id) throw Error('Vælg en dør.'); await chooseKisiLock(club.id, id, name.join('|')); revalidatePath(PATH); return { ok: 'Døren er valgt.' }; }
    const key = String(form.get('apiKey') ?? '').trim();
    if (key.length < 10) throw Error('Indsæt API-nøglen fra Kisi.');
    const locks = await connectKisi(club.id, key);
    revalidatePath(PATH);
    return { ok: locks.length === 1 ? `Kisi er forbundet, og døren "${locks[0].name}" er valgt.` : `Kisi er forbundet. Vælg døren blandt ${locks.length} låse.` };
  } catch (e) { return fail(e); }
}
