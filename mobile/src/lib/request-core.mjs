export async function fetchJson(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch {
      throw new Error("Serveren svarede ikke korrekt. Prøv igen om lidt.");
    }
    if (!response.ok) {
      const error = new Error(typeof data.error === "string" ? data.error : response.status === 409
        ? "Tiden er ikke længere ledig. Opdatér og vælg en anden tid." : "Der gik noget galt. Prøv igen.");
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(options.method && options.method !== "GET"
      ? "Svaret tog for lang tid. Kontrollér om handlingen er gennemført, før du prøver igen."
      : "Forbindelsen er langsom. Prøv at opdatere igen.");
    if (error instanceof TypeError) throw new Error("Kan ikke få forbindelse. Tjek dit netværk og prøv igen.");
    throw error;
  } finally { clearTimeout(timer); }
}
export function resolveCheckoutUrl(path, base) {
  if (typeof path !== "string" || !path.trim()) throw new Error("Der er ingen betalingsside til denne booking endnu.");
  const url = new URL(path, base);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Betalingslinket er ugyldigt.");
  return url.href;
}
