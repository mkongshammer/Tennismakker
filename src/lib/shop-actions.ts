'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { getCurrentUser } from './session';
import { requireCustomClub } from './club-management-actions';
import { buyGiftCard, recordSale, redeemGiftCard } from './shop';
import { cancelReaderSale, registerReader, removeReader, startReaderPayment } from './terminal';

type State = { ok?: string; error?: string; pendingSaleId?: string } | null;
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' });

export async function saveShopItem(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('butik');
    const name = String(form.get('name') ?? '').trim();
    const priceKr = Number(form.get('priceKr')); const stockRaw = String(form.get('stock') ?? '').trim();
    const stock = stockRaw === '' ? -1 : Number(stockRaw);
    if (name.length < 1 || name.length > 80) throw Error('Giv varen et navn.');
    if (!Number.isInteger(priceKr) || priceKr < 0 || priceKr > 5000) throw Error('Prisen skal være mellem 0 og 5000.');
    if (!Number.isInteger(stock) || stock < -1 || stock > 100000) throw Error('Lager skal være et helt tal.');
    const id = String(form.get('itemId') ?? '');
    if (id) await db.shopItem.updateMany({ where: { id, clubId: club.id }, data: { name, priceKr, stock } });
    else await db.shopItem.create({ data: { clubId: club.id, name, priceKr, stock, sortOrder: await db.shopItem.count({ where: { clubId: club.id } }) } });
    revalidatePath('/admin/butik');
    return { ok: 'Gemt.' };
  } catch (e) { return fail(e); }
}

export async function shopItemAction(form: FormData) {
  const { club } = await requireCustomClub('butik');
  const id = String(form.get('itemId') ?? ''); const intent = String(form.get('intent'));
  if (intent === 'archive') await db.shopItem.updateMany({ where: { id, clubId: club.id }, data: { active: false } });
  if (intent === 'restore') await db.shopItem.updateMany({ where: { id, clubId: club.id }, data: { active: true } });
  revalidatePath('/admin/butik');
}

export async function recordSaleAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { user, club } = await requireCustomClub('butik');
    const lines = form.getAll('itemId').map((id) => ({ itemId: String(id), qty: Number(form.get(`qty_${id}`) ?? 0) })).filter((l) => l.qty > 0);
    const method = String(form.get('method'));
    if (!['CASH', 'CARD', 'WALLET', 'READER'].includes(method)) throw Error('Vælg betalingsmåde.');
    const readerId = String(form.get('readerId') ?? '');
    if (method === 'READER' && !readerId) throw Error('Vælg en kortlæser.');
    const email = String(form.get('memberEmail') ?? '').trim().toLowerCase();
    let userId: string | null = null;
    if (email) { const m = await db.user.findFirst({ where: { email, clubId: club.id }, select: { id: true } }); if (!m) throw Error('Ingen medlem med den e-mail i klubben.'); userId = m.id; }
    const sale = await recordSale(club.id, user.id, lines, method as any, userId);
    if (method === 'READER') {
      try { await startReaderPayment(club.id, sale.id, readerId); }
      catch (e) { await cancelReaderSale(club.id, sale.id); throw e; }
      return { ok: `Beløbet er sendt til kortlæseren: ${sale.totalKr} ${sale.currency}.`, pendingSaleId: sale.id };
    }
    revalidatePath('/admin/butik');
    return { ok: `Salg registreret: ${sale.totalKr} ${sale.currency}.` };
  } catch (e) { return fail(e); }
}

export async function readerAction(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('butik');
    const intent = String(form.get('intent') ?? '');
    if (intent === 'remove') { await removeReader(club.id, String(form.get('readerId') ?? '')); revalidatePath('/admin/butik'); return { ok: 'Kortlæseren er fjernet.' }; }
    const code = String(form.get('registrationCode') ?? '').trim();
    if (!/^[a-z]+(-[a-z]+){2}$/i.test(code)) throw Error('Skriv parringskoden fra læserens skærm, fx sepia-cerulean-orynx.');
    const r = await registerReader(club.id, code, String(form.get('label') ?? '').trim().slice(0, 60), String(form.get('postalCode') ?? '').trim().slice(0, 12), String(form.get('state') ?? '').trim().slice(0, 3));
    revalidatePath('/admin/butik');
    return { ok: `${r.label} er klar. Vælg "Kortlæser" i kassen, når der skal betales.` };
  } catch (e) { return fail(e); }
}

export async function cancelReaderSaleAction(form: FormData) {
  const { club } = await requireCustomClub('butik');
  await cancelReaderSale(club.id, String(form.get('saleId') ?? ''));
  revalidatePath('/admin/butik');
}

export async function createStaffShift(_prev: State, form: FormData): Promise<State> {
  try {
    const { club } = await requireCustomClub('vagtplan');
    const personName = String(form.get('personName') ?? '').trim(); const role = String(form.get('role') ?? '').trim().slice(0, 60) || null; const note = String(form.get('note') ?? '').trim().slice(0, 200) || null;
    if (personName.length < 1 || personName.length > 80) throw Error('Skriv et navn.');
    const { wallTime } = await import('./international');
    const day = String(form.get('day') ?? ''); const [sh, sm] = String(form.get('start') ?? '').split(':').map(Number); const [eh, em] = String(form.get('end') ?? '').split(':').map(Number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(sh) || !Number.isFinite(eh)) throw Error('Vælg dag og tidspunkt.');
    const startsAt = wallTime(day, sh, sm || 0, club.timeZone)!, endsAt = wallTime(day, eh, em || 0, club.timeZone)!;
    if (endsAt <= startsAt) throw Error('Vagten skal slutte efter den begynder.');
    const repeat = Math.min(12, Math.max(1, Number(form.get('repeatWeeks') ?? 1) || 1));
    for (let w = 0; w < repeat; w++) await db.staffShift.create({ data: { clubId: club.id, personName, role, note, startsAt: new Date(startsAt.getTime() + w * 7 * 86_400_000), endsAt: new Date(endsAt.getTime() + w * 7 * 86_400_000) } });
    revalidatePath('/admin/vagtplan');
    return { ok: repeat > 1 ? `${repeat} vagter oprettet.` : 'Vagten er oprettet.' };
  } catch (e) { return fail(e); }
}

export async function deleteStaffShift(form: FormData) {
  const { club } = await requireCustomClub('vagtplan');
  await db.staffShift.deleteMany({ where: { id: String(form.get('shiftId') ?? ''), clubId: club.id } });
  revalidatePath('/admin/vagtplan');
}

// ----- players -----
export async function buyGiftCardAction(form: FormData) {
  const user = await getCurrentUser();
  const slug = String(form.get('slug') ?? '');
  const club = await db.club.findUnique({ where: { slug }, select: { id: true } });
  if (!club) redirect('/');
  const r = await buyGiftCard(user?.id ?? null, club!.id, Number(form.get('amountKr')), { email: String(form.get('recipientEmail') ?? '').trim(), name: String(form.get('recipientName') ?? '').trim(), message: String(form.get('message') ?? '').trim() });
  if (!r.ok) redirect(`/clubs/${slug}/gift?error=${encodeURIComponent(r.error)}`);
  if (r.checkoutUrl) redirect(r.checkoutUrl);
  redirect(`/clubs/${slug}/gift?code=${r.code}&bought=1`);
}

export async function redeemGiftCardAction(form: FormData) {
  const user = await getCurrentUser();
  const slug = String(form.get('slug') ?? '');
  if (!user) redirect(`/login?next=${encodeURIComponent(`/clubs/${slug}/gift?code=${String(form.get('code') ?? '')}`)}`);
  const r = await redeemGiftCard(user!.id, String(form.get('code') ?? ''));
  redirect(r.ok ? `/wallet?gift=${r.amountKr}` : `/clubs/${slug}/gift?error=${encodeURIComponent(r.error)}`);
}
