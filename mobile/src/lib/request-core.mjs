export async function fetchJson(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch {
      throw new Error("The server didn’t answer properly. Try again in a moment.");
    }
    if (!response.ok) {
      const error = new Error(typeof data.error === "string" ? data.error : response.status === 409
        ? "That time is no longer available. Refresh and pick another." : `Something went wrong (${response.status}). Try again.`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(options.method && options.method !== "GET"
      ? "That took too long. Check whether it went through before trying again."
      : "The connection is slow. Try refreshing.");
    if (error instanceof TypeError) throw new Error("Can’t connect. Check your internet and try again.");
    throw error;
  } finally { clearTimeout(timer); }
}
export function resolveCheckoutUrl(path, base) {
  if (typeof path !== "string" || !path.trim()) throw new Error("There’s no payment page for this booking yet.");
  const url = new URL(path, base);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The payment link isn’t valid.");
  return url.href;
}
