"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { LANG_COOKIE } from "./site-language";

export async function setSiteLanguage(form: FormData) {
  const lang = form.get("lang") === "es" ? "es" : "en";
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  // The account follows, so e-mails and the app use the same language.
  if (user) await db.user.update({ where: { id: user.id }, data: { locale: lang === "es" ? "es" : "en-US" } }).catch(() => {});
  revalidatePath("/", "layout");
}
