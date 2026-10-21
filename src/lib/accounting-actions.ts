'use server';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireCustomClub } from './club-management-actions';
import { disconnectQuickBooks, postPending } from './quickbooks';

type State = { ok?: string; error?: string } | null;
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' });

export async function postToQuickBooksNow(_prev: State, _form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('rapporter');
    const acct = await db.clubAccounting.findUnique({ where: { clubId: club.id }, select: { id: true } });
    if (!acct) throw Error('QuickBooks er ikke forbundet.');
    const r = await postPending(acct.id);
    revalidatePath('/admin/rapporter');
    if (r.error) return { error: r.error };
    return { ok: `Bogført: ${r.posted} dage med omsætning, ${r.skipped} dage uden.` };
  } catch (e) { return fail(e); }
}

export async function accountingSettingsAction(form: FormData) {
  const { club } = await requireCustomClub('rapporter');
  const intent = String(form.get('intent') ?? '');
  if (intent === 'disconnect') await disconnectQuickBooks(club.id);
  if (intent === 'auto') await db.clubAccounting.updateMany({ where: { clubId: club.id }, data: { autoPost: form.get('autoPost') === 'on' } });
  if (intent === 'startFrom') {
    const day = String(form.get('day') ?? '');
    // Posting restarts from this day; days already posted stay (unique per day) and are not doubled.
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) { const prev = new Date(`${day}T00:00:00Z`); prev.setUTCDate(prev.getUTCDate() - 1); await db.clubAccounting.updateMany({ where: { clubId: club.id }, data: { lastPostedDay: prev.toISOString().slice(0, 10) } }); }
  }
  revalidatePath('/admin/rapporter');
}
