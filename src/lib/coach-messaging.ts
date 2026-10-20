// Coach ↔ player messaging opens only after a paid lesson.
//
// Between a coach and a player, the chat unlocks once the coach has accepted
// a lesson request and the player has paid for it — that is, once the two
// share a CONFIRMED coaching booking (a request is REQUESTED, an accepted
// but unpaid one is HOLD). A lesson cancelled before it was confirmed does
// not unlock anything. Player ↔ player and coach ↔ coach messaging is
// unaffected. The rule is enforced where threads are opened and where
// messages are sent, on the website, the API and therefore the app.
import { db } from "./db";

export type CoachChatGate =
  | { allowed: true }
  | { allowed: false; viewerIsCoach: boolean; reason: string };

export const COACH_CHAT_LOCKED_FOR_PLAYER = "You can message this coach once they've accepted your lesson and you've paid for it.";
export const COACH_CHAT_LOCKED_FOR_COACH = "You can message this player once they've booked and paid for a lesson with you.";

/** Pure decision, given which of the two have a coach profile and whether a paid lesson links them. */
export function coachChatDecision(viewerIsCoach: boolean, otherIsCoach: boolean, paidLesson: boolean): CoachChatGate {
  if (viewerIsCoach === otherIsCoach || paidLesson) return { allowed: true };
  return { allowed: false, viewerIsCoach, reason: viewerIsCoach ? COACH_CHAT_LOCKED_FOR_COACH : COACH_CHAT_LOCKED_FOR_PLAYER };
}

export async function coachChatGate(viewerId: string, otherId: string): Promise<CoachChatGate> {
  const profiles = await db.coachProfile.findMany({ where: { userId: { in: [viewerId, otherId] } }, select: { id: true, userId: true } });
  const viewerCoach = profiles.find((p) => p.userId === viewerId);
  const otherCoach = profiles.find((p) => p.userId === otherId);
  if (Boolean(viewerCoach) === Boolean(otherCoach)) return { allowed: true };
  const coach = (viewerCoach ?? otherCoach)!;
  const playerId = viewerCoach ? otherId : viewerId;
  const lesson = await db.booking.findFirst({ where: { coachProfileId: coach.id, userId: playerId, status: "CONFIRMED" }, select: { id: true } });
  return coachChatDecision(Boolean(viewerCoach), Boolean(otherCoach), Boolean(lesson));
}
