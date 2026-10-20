// Notes that travel with a lesson request and the coach's answer: the one
// exchange coach and player have before a paid lesson opens the chat.
export const LESSON_NOTE_MAX = 500;

/** Trimmed, length-capped note, or null when empty. Control characters other than newlines are dropped. */
export function cleanLessonNote(value: unknown): string | null {
  const text = String(value ?? "").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return text ? text.slice(0, LESSON_NOTE_MAX) : null;
}
