'use server';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { getCurrentUser } from './session';

type State = { ok?: string; error?: string } | null;

export async function saveBookingRules(_prev: State, form: FormData): Promise<State> {
  try {
    const user = await getCurrentUser();
    if (user?.role !== 'CLUB_ADMIN' || !user.clubId) throw Error('Kun klubbens administrator har adgang.');
    const club = await db.club.findUniqueOrThrow({ where: { id: user.clubId }, select: { waiverText: true, waiverVersion: true } });
    const guestFeeKr = Number(form.get('guestFeeKr'));
    const guestMax = Number(form.get('guestMax'));
    const noShow = Number(form.get('noShowReleaseMinutes'));
    if (!Number.isInteger(guestFeeKr) || guestFeeKr < 0 || guestFeeKr > 1000) throw Error('Gæstegebyret skal være mellem 0 og 1000.');
    if (!Number.isInteger(guestMax) || guestMax < 0 || guestMax > 10) throw Error('Vælg mellem 0 og 10 gæster pr. booking.');
    if (!Number.isInteger(noShow) || noShow < 0 || noShow > 60) throw Error('Vælg mellem 0 og 60 minutter.');
    const waiverText = String(form.get('waiverText') ?? '').trim().slice(0, 8000) || null;
    const changed = waiverText !== club.waiverText;
    await db.club.update({
      where: { id: user.clubId },
      data: { guestFeeKr, guestMax, noShowReleaseMinutes: noShow, checkInEnabled: form.get('checkInEnabled') === 'on', waiverText, waiverVersion: changed && waiverText ? club.waiverVersion + 1 : club.waiverVersion },
    });
    revalidatePath('/admin', 'layout');
    return { ok: changed && waiverText ? 'Gemt. Alle skal acceptere den nye tekst ved næste booking.' : 'Gemt.' };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.' }; }
}

export async function checkInAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const { checkIn } = await import('./waiver');
  await checkIn(user.id, String(form.get('bookingId') ?? ''));
  revalidatePath('/profile');
}
