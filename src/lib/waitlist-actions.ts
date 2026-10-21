'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { getCurrentUser } from './session';
import { joinWaitlist, leaveWaitlist } from './waitlist';

export async function joinCourtWaitlist(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const slug = String(form.get('slug') ?? '');
  const club = await db.club.findUnique({ where: { slug }, select: { id: true } });
  const slotAt = new Date(String(form.get('slotAt') ?? ''));
  if (!club || Number.isNaN(slotAt.getTime()) || slotAt < new Date()) redirect(`/clubs/${slug}`);
  await joinWaitlist(user!.id, club!.id, 'COURT', { slotAt });
  const day = String(form.get('date') ?? '');
  redirect(`/clubs/${slug}?${day ? `date=${day}&` : ''}venteliste=1`);
}

export async function joinTeamWaitlist(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const slug = String(form.get('slug') ?? '');
  const team = await db.seasonTeam.findUnique({ where: { id: String(form.get('teamId') ?? '') }, select: { id: true, clubId: true } });
  if (team) await joinWaitlist(user!.id, team.clubId, 'TEAM', { teamId: team.id });
  redirect(`/clubs/${slug}?venteliste=1#teams`);
}

export async function joinEventWaitlist(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const ev = await db.clubEvent.findUnique({ where: { id: String(form.get('eventId') ?? '') }, select: { id: true, clubId: true, club: { select: { slug: true } } } });
  if (ev) await joinWaitlist(user!.id, ev.clubId, 'EVENT', { eventId: ev.id });
  redirect(ev ? `/clubs/${ev.club.slug}/events/${ev.id}?venteliste=1` : '/');
}

export async function leaveWaitlistAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  await leaveWaitlist(user.id, String(form.get('id') ?? ''));
  revalidatePath('/profile');
}
