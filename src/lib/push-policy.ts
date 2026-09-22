export const PUSH_CATEGORIES = ['bookings', 'reminders', 'messages', 'coaching'] as const;
export type PushCategory = typeof PUSH_CATEGORIES[number];
export const validExpoToken = (value: unknown): value is string => typeof value === 'string' && /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(value);
export function bookingPush(status: string, previous: string | null, isCoach: boolean) {
  if (isCoach && status === 'REQUESTED') return {category:'coaching' as const, title:'Ny trænerforespørgsel', body:'En spiller vil booke træning. Åbn appen og se forespørgslen.'};
  if (status === 'CANCELLED' && (previous === 'CONFIRMED' || previous === 'REQUESTED')) return {category:'bookings' as const, title:'Booking aflyst', body:'En af dine bookinger er blevet aflyst. Se detaljerne i appen.'};
  if (!isCoach && status === 'HOLD' && previous === 'REQUESTED') return {category:'coaching' as const, title:'Træneren har sagt ja', body:'Din træning er godkendt. Åbn appen og fuldfør betalingen inden fristen.'};
  if (status === 'CONFIRMED') return {category:'bookings' as const, title:'Booking bekræftet', body:'Din booking er bekræftet. Se tid og sted i appen.'};
  return null;
}
export function reminderWindow(startsAt: Date, now: Date) {
  const minutes = (startsAt.getTime()-now.getTime())/60000;
  if(minutes > 45 && minutes <= 60) return {key:'1h', title:'Din booking starter om cirka en time'};
  if(minutes > 1425 && minutes <= 1440) return {key:'24h', title:'Husk din booking i morgen'};
  return null;
}
export function retryDelay(attempts: number) { return Math.min(3600000, 60000 * 2 ** Math.min(attempts,6)); }
