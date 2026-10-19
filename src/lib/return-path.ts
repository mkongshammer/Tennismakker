// A same-site path a flow may return to after sign-in.
//
// Only relative paths are accepted, so a crafted link can never bounce a
// signed-in user to another site, and the login pages themselves are
// excluded to avoid loops.
export function safeReturnPath(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\r\n]/.test(raw) || raw.length > 512) return null;
  if (raw.startsWith("/login") || raw.startsWith("/api/")) return null;
  return raw;
}
