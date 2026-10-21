'use server';
// Club-side billing actions: settings, sending bills, and handling one bill.
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireCustomClub } from './club-management-actions';
import { cancelBill, markBillPaid, resendBill, sendBills } from './member-billing';

type State = { ok?: string; error?: string } | null;
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' });

export async function saveBillingSettings(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('medlemmer');
    const dueDays = Number(form.get('dueDays'));
    if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 90) throw Error('Vælg mellem 1 og 90 dage til forfald.');
    const replyTo = String(form.get('replyTo') ?? '').trim().toLowerCase();
    if (replyTo && (!/^\S+@\S+\.\S+$/.test(replyTo) || replyTo.length > 200)) throw Error('Skriv en gyldig e-mail til svar.');
    const note = String(form.get('note') ?? '').trim();
    if (note.length > 500) throw Error('Noten må højst være 500 tegn.');
    await db.club.update({
      where: { id: club.id },
      data: { billingDueDays: dueDays, billingReminders: form.get('reminders') === 'on', billingReplyTo: replyTo || null, billingNote: note || null },
    });
    revalidatePath('/admin/medlemmer');
    return { ok: 'Gemt.' };
  } catch (e) { return fail(e); }
}

export async function sendBillsAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('medlemmer');
    if (!club.stripeChargesEnabled) throw Error('Fuldfør udbetalingsopsætningen under Betaling, før I sender regninger.');
    const typeId = String(form.get('typeId') ?? '');
    const { sent, total } = await sendBills(club.id, typeId);
    revalidatePath('/admin/medlemmer');
    if (!total) return { ok: 'Alle medlemmer har allerede fået en regning for dette kontingent.' };
    return { ok: sent === total ? `${sent} regninger er sendt.` : `${sent} regninger er sendt. ${total - sent} gratis medlemskaber er registreret.` };
  } catch (e) { return fail(e); }
}

export async function billAction(form: FormData) {
  const { club } = await requireCustomClub('medlemmer');
  const id = String(form.get('membershipId') ?? '');
  const intent = String(form.get('intent') ?? '');
  if (intent === 'resend') await resendBill(club.id, id);
  else if (intent === 'paid') await markBillPaid(club.id, id);
  else if (intent === 'cancel') await cancelBill(club.id, id);
  revalidatePath('/admin/medlemmer');
}
