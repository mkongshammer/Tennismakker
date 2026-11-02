// Private calendar subscription: /calendar/<token>  (also accepts a trailing .ics)
import { calendarFeed, userForCalendarToken } from "../../../lib/calendar-feed";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await userForCalendarToken(token.replace(/\.ics$/, ""));
  if (!userId) return new Response("Not found", { status: 404 });
  return new Response(await calendarFeed(userId), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "X-Robots-Tag": "noindex" },
  });
}
