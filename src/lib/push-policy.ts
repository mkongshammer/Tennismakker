export const PUSH_CATEGORIES = ['bookings', 'reminders', 'messages', 'coaching'] as const;
export type PushCategory = typeof PUSH_CATEGORIES[number];
/** Lock-screen language: Danish for Danish accounts on the EU service, English otherwise. */
export type PushLang = 'da' | 'en';
export const validExpoToken = (value: unknown): value is string => typeof value === 'string' && /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(value);

// Generic lock-screen copy: no names, message text, access codes or payment data.
const COPY = {
  coachRequest: { da: ['Ny trænerforespørgsel', 'En spiller vil booke træning. Åbn appen og se forespørgslen.'], en: ['New lesson request', 'A player wants to book a lesson. Open the app to review it.'] },
  cancelled: { da: ['Booking aflyst', 'En af dine bookinger er blevet aflyst. Se detaljerne i appen.'], en: ['Booking cancelled', 'One of your bookings was cancelled. See the details in the app.'] },
  coachApproved: { da: ['Træneren har sagt ja', 'Din træning er godkendt. Åbn appen og fuldfør betalingen inden fristen.'], en: ['Your coach said yes', 'Your lesson is approved. Open the app and complete payment before the deadline.'] },
  confirmed: { da: ['Booking bekræftet', 'Din booking er bekræftet. Se tid og sted i appen.'], en: ['Booking confirmed', 'Your booking is confirmed. See time and place in the app.'] },
  rescheduled: { da: ['Din booking har fået en ny tid', 'Se det opdaterede tidspunkt i appen.'], en: ['Your booking has a new time', 'See the updated time in the app.'] },
  reminder1h: { da: ['Din booking starter om cirka en time', 'Se tid og sted under dine bookinger.'], en: ['Your booking starts in about an hour', 'See time and place under your bookings.'] },
  reminder24h: { da: ['Husk din booking i morgen', 'Se tid og sted under dine bookinger.'], en: ['Reminder: your booking is tomorrow', 'See time and place under your bookings.'] },
  message: { da: ['Ny besked', 'Du har en ulæst besked i RacketBuddy.'], en: ['New message', 'You have an unread message on RacketBuddy.'] },
} as const;
export type PushCopyKey = keyof typeof COPY;
export function pushCopy(key: PushCopyKey, lang: PushLang) { const [title, body] = COPY[key][lang]; return { title, body }; }

export function bookingPush(status: string, previous: string | null, isCoach: boolean, lang: PushLang = 'da') {
  if (isCoach && status === 'REQUESTED') return {category:'coaching' as const, ...pushCopy('coachRequest', lang)};
  if (status === 'CANCELLED' && (previous === 'CONFIRMED' || previous === 'REQUESTED')) return {category:'bookings' as const, ...pushCopy('cancelled', lang)};
  if (!isCoach && status === 'HOLD' && previous === 'REQUESTED') return {category:'coaching' as const, ...pushCopy('coachApproved', lang)};
  if (status === 'CONFIRMED') return {category:'bookings' as const, ...pushCopy('confirmed', lang)};
  return null;
}
export function reminderWindow(startsAt: Date, now: Date, lang: PushLang = 'da') {
  const minutes = (startsAt.getTime()-now.getTime())/60000;
  if(minutes > 45 && minutes <= 60) return {key:'1h', ...pushCopy('reminder1h', lang)};
  if(minutes > 1425 && minutes <= 1440) return {key:'24h', ...pushCopy('reminder24h', lang)};
  return null;
}
export function retryDelay(attempts: number) { return Math.min(3600000, 60000 * 2 ** Math.min(attempts,6)); }
