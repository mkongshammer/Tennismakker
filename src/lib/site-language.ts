// Website language: English (default) or Spanish. Pages render in English on
// the server; Spanish is applied in the browser by SpanishTranslator.
import { cookies } from "next/headers";
import { getCurrentUser } from "./session";

export const LANG_COOKIE = "rb_lang";
export type SiteLanguage = "en" | "es";

export async function getSiteLanguage(): Promise<SiteLanguage> {
  const jar = await cookies();
  const c = jar.get(LANG_COOKIE)?.value;
  if (c === "es" || c === "en") return c;
  const user = await getCurrentUser();
  return user?.locale === "es" ? "es" : "en";
}
