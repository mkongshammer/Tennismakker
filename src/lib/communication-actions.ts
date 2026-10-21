'use server';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireCustomClub } from './club-management-actions';
import { sendBroadcast, type Audience } from './broadcast';

type State = { ok?: string; error?: string } | null;
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' });

export async function sendBroadcastAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { user, club } = await requireCustomClub('kommunikation');
    const subject = String(form.get('subject') ?? '').trim();
    const body = String(form.get('body') ?? '').trim();
    const audience: Audience = form.get('audience') === 'PAID' ? 'PAID' : 'ALL';
    if (subject.length < 3 || subject.length > 120) throw Error('Skriv et emne på 3–120 tegn.');
    if (body.length < 10 || body.length > 5000) throw Error('Skriv en besked på 10–5000 tegn.');
    if (form.get('confirmed') !== 'on') throw Error('Bekræft, at mailen skal sendes.');
    const { sent, total } = await sendBroadcast(club.id, user.id, subject, body, audience);
    revalidatePath('/admin/kommunikation');
    return { ok: `Sendt til ${sent} af ${total} medlemmer.` };
  } catch (e) { return fail(e); }
}

export async function saveSmsSetting(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('kommunikation');
    await db.club.update({ where: { id: club.id }, data: { smsReminders: form.get('smsReminders') === 'on' } });
    revalidatePath('/admin/kommunikation');
    return { ok: 'Gemt.' };
  } catch (e) { return fail(e); }
}
