import test from "node:test";
import assert from "node:assert/strict";
import { cleanCodes, labelsFor, cleanFactText, hasLessonFacts, COACH_LEVELS, COACH_AGES } from "./coach-facts";
import { cleanLessonNote, LESSON_NOTE_MAX } from "./lesson-notes";
import { summarise, reviewerName } from "./reviews";
import { pushCopy } from "./push-policy";

test("coach facts keep only known codes, in canonical order", () => {
  assert.equal(cleanCodes(["advanced", "BEGINNER", "nonsense", "BEGINNER"], COACH_LEVELS), "BEGINNER,ADVANCED");
  assert.deepEqual(labelsFor("ADULTS,KIDS", COACH_AGES), ["Kids (under 12)", "Adults"]);
  assert.equal(cleanCodes([], COACH_AGES), "");
  assert.equal(cleanFactText("  Balls   provided. \n"), "Balls provided.");
  assert.equal(cleanFactText("   "), null);
  assert.equal(cleanFactText("x".repeat(400))!.length, 300);
  assert.equal(hasLessonFacts({ levels: "", ages: "", lessonPlace: null, whatToBring: null }), false);
  assert.equal(hasLessonFacts({ levels: "BEGINNER" }), true);
});

test("lesson notes are trimmed, capped and stripped of control characters", () => {
  assert.equal(cleanLessonNote("  Beginner,\n\n\n\nwant to work on my serve \u0007 "), "Beginner,\n\nwant to work on my serve");
  assert.equal(cleanLessonNote(""), null);
  assert.equal(cleanLessonNote(null), null);
  assert.equal(cleanLessonNote("a".repeat(900))!.length, LESSON_NOTE_MAX);
});

test("review summary: average, count and 5→1 distribution", () => {
  const s = summarise([{ rating: 5, count: 3 }, { rating: 4, count: 1 }, { rating: 1, count: 1 }, { rating: 9, count: 4 }], 2);
  assert.deepEqual(s.distribution, [3, 1, 0, 0, 1]);
  assert.equal(s.count, 5);
  assert.equal(s.average, (15 + 4 + 1) / 5);
  assert.equal(s.withComment, 2);
  assert.deepEqual(summarise([]).distribution, [0, 0, 0, 0, 0]);
  assert.equal(summarise([]).average, 0);
});

test("public reviews show first names only", () => {
  assert.equal(reviewerName("Sam Carter"), "Sam");
  assert.equal(reviewerName("  Ana  "), "Ana");
  assert.equal(reviewerName(""), "A player");
});

test("review prompt push is short and generic", () => {
  assert.deepEqual(pushCopy("reviewPrompt", "en"), { title: "How was your lesson?", body: "Rate your coach in the app — it takes ten seconds." });
});
