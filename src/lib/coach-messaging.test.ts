import test from "node:test";
import assert from "node:assert/strict";
import { coachChatDecision, COACH_CHAT_LOCKED_FOR_COACH, COACH_CHAT_LOCKED_FOR_PLAYER } from "./coach-messaging";

test("coach and player can only message after a paid (confirmed) lesson", () => {
  assert.deepEqual(coachChatDecision(false, true, false), { allowed: false, viewerIsCoach: false, reason: COACH_CHAT_LOCKED_FOR_PLAYER });
  assert.deepEqual(coachChatDecision(true, false, false), { allowed: false, viewerIsCoach: true, reason: COACH_CHAT_LOCKED_FOR_COACH });
  assert.deepEqual(coachChatDecision(false, true, true), { allowed: true });
  assert.deepEqual(coachChatDecision(true, false, true), { allowed: true });
});

test("player to player and coach to coach messaging is unaffected", () => {
  assert.deepEqual(coachChatDecision(false, false, false), { allowed: true });
  assert.deepEqual(coachChatDecision(true, true, false), { allowed: true });
});
