import {
  unsubscribeEngagementEmails,
  validUnsubscribeToken,
} from "../../../../lib/engagement-emails";
import { messageLocale } from "../../../../lib/mail-locale";
import { translatePhrase as phrase } from "../../../../../shared/phrase-translation.mjs";

export const dynamic = "force-dynamic";

function page(message: string, status = 200) {
  const locale = messageLocale(null);
  message = phrase(message, locale);
  return new Response(
    `<!doctype html><html lang="${locale === "da" ? "da" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RacketBuddy</title></head><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:64px auto;padding:0 20px;line-height:1.5"><h1>RacketBuddy</h1><p>${message}</p><p><a href="/">${phrase("Gå til RacketBuddy", locale)}</a></p></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user") ?? "";
  const token = url.searchParams.get("token") ?? "";

  if (!userId || !token || !validUnsubscribeToken(userId, token)) {
    return page("Afmeldingslinket er ugyldigt eller udløbet.", 400);
  }

  await unsubscribeEngagementEmails(userId);
  return page("Du er nu afmeldt inspirationsmails fra RacketBuddy.");
}
