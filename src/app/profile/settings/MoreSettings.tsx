"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { saveNotificationSettings, newCalendarLink } from "../../../lib/notification-actions";
import { setTwoStepLogin, setClubTwoStepRequirement } from "../../../lib/security-actions";

type Prefs = { bookings: boolean; reminders: boolean; messages: boolean; coaching: boolean; tips: boolean };

function Button({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-court" disabled={pending}>{pending ? "Saving…" : label}</button>;
}
function Note({ state }: { state: { ok?: string; error?: string } | null }) {
  if (!state) return null;
  return <p className={`text-sm ${state.error ? "text-red-600" : "text-emerald-700"}`} role="status">{state.error ?? state.ok}</p>;
}
function Toggle({ name, label, hint, on }: { name: string; label: string; hint?: string; on: boolean }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={on} className="mt-1 h-4 w-4" />
      <span><span className="font-semibold text-ink">{label}</span>{hint && <span className="block text-sm text-slate">{hint}</span>}</span>
    </label>
  );
}

export function NotificationSettings({ prefs }: { prefs: Prefs }) {
  const [state, action] = useFormState(saveNotificationSettings, null);
  return (
    <form action={action} className="card space-y-4" id="notifications">
      <div>
        <h2 className="text-lg font-bold">Notifications</h2>
        <p className="text-sm text-slate">Choose what the RacketBuddy app notifies you about. Booking receipts and important account e-mails are always sent.</p>
      </div>
      <Toggle name="bookings" label="Bookings" hint="Confirmations, changes and cancellations" on={prefs.bookings} />
      <Toggle name="reminders" label="Reminders" hint="Before your court time or lesson starts" on={prefs.reminders} />
      <Toggle name="messages" label="Messages" hint="New messages from players, coaches and clubs" on={prefs.messages} />
      <Toggle name="coaching" label="Coaching" hint="Lesson requests and updates" on={prefs.coaching} />
      <Toggle name="tips" label="Tips & inspiration e-mails" hint="An occasional e-mail with ideas for playing more" on={prefs.tips} />
      <div className="flex items-center gap-3"><Button label="Save notifications" /><Note state={state} /></div>
    </form>
  );
}

export function CalendarSync({ link }: { link: string }) {
  const [state, action] = useFormState(newCalendarLink, null);
  const [copied, setCopied] = useState(false);
  const webcal = link.replace(/^https:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return (
    <section className="card space-y-4" id="calendar">
      <div>
        <h2 className="text-lg font-bold">Calendar sync</h2>
        <p className="text-sm text-slate">Your bookings and lessons appear in your own calendar and update by themselves. Keep this link private — anyone with it can see your bookings.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className="btn-court" href={webcal}>Apple / Outlook</a>
        <a className="btn-ghost" href={google} target="_blank" rel="noopener noreferrer">Google Calendar</a>
        <button type="button" className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Link copied" : "Copy link"}</button>
      </div>
      <form action={action} className="flex items-center gap-3">
        <button className="text-sm font-semibold text-slate underline">Make a new link (stops the old one)</button>
        <Note state={state} />
      </form>
    </section>
  );
}

export function TwoStepSettings({ own, club, isAdmin, isOwner }: { own: boolean; club: boolean; isAdmin: boolean; isOwner: boolean }) {
  const [state, action] = useFormState(setTwoStepLogin, null);
  const [clubState, clubAction] = useFormState(setClubTwoStepRequirement, null);
  return (
    <section className="card space-y-4" id="security">
      <div>
        <h2 className="text-lg font-bold">Two-step login</h2>
        <p className="text-sm text-slate">When this is on, we e-mail you a 6-digit code every time you sign in with your password (website and app), so a stolen password alone isn't enough.</p>
      </div>
      {club && <p className="text-sm font-semibold text-ink">Your club requires two-step login for all admins.</p>}
      <form action={action} className="space-y-3">
        <Toggle name="twoStep" label="E-mail me a login code when I sign in" on={own || club} />
        <div className="flex items-center gap-3"><Button label="Save" /><Note state={state} /></div>
      </form>
      {isAdmin && isOwner && (
        <form action={clubAction} className="space-y-3 border-t pt-4">
          <Toggle name="required" label="Require two-step login for every admin at my club" hint="Only owners can change this." on={club} />
          <div className="flex items-center gap-3"><Button label="Save club rule" /><Note state={clubState} /></div>
        </form>
      )}
    </section>
  );
}
