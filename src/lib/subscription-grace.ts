const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFailureDays(value: unknown): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map(String).filter(day => DAY_RE.test(day)))].sort().slice(-10);
  } catch {
    return [];
  }
}

export function localFailureDay(at: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at).map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addFailureDay(days: string[], day: string): string[] {
  return parseFailureDays([...days, day]);
}

function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Number of distinct consecutive failed-payment days ending on the latest failure day. */
export function consecutiveFailureDays(days: string[]): number {
  const clean = parseFailureDays(days);
  if (!clean.length) return 0;
  let streak = 1;
  let expected = previousDay(clean.at(-1)!);
  for (let i = clean.length - 2; i >= 0; i--) {
    if (clean[i] !== expected) break;
    streak++;
    expected = previousDay(clean[i]);
  }
  return streak;
}

export function shouldPauseAfterFailures(days: string[]): boolean {
  return consecutiveFailureDays(days) >= 3;
}
