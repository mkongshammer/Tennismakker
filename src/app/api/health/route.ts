// Sundhedstjek til Render.
//
// Render bruger den til at afgøre, om en ny udrulning er i live, og om
// den kørende instans stadig svarer. Uden en sti sender Render trafik til
// en instans, så snart processen er startet — også hvis databasen er væk.
//
// Den spørger databasen, fordi en app, der svarer men ikke kan nå sin
// database, er værre end en, der ikke svarer: den ser rask ud udefra.
import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
