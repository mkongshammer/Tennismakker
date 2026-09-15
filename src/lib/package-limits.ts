export const MIN_PACKAGE_SESSIONS = 2;
export const MAX_PACKAGE_SESSIONS = 20;

export function isValidPackageSessions(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_PACKAGE_SESSIONS &&
    value <= MAX_PACKAGE_SESSIONS
  );
}
