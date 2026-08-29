// Swipe-siden: ét kort ad gangen med en spiller på dit niveau i dit område.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { nextCandidates, pendingLikes } from "../../lib/swipe";
import { submitSwipe } from "../../lib/actions";
import { LevelBadge } from "../../components/LevelBadge";

export const dynamic = "force-dynamic";

export default async function SpillerePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [candidates, likes] = await Promise.all([
    nextCandidates(user.id, 1),
    pendingLikes(user.id),
  ]);
  const player = candidates[0] ?? null;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="display text-3xl">Find spillere</h1>
        {likes > 0 && (
          <span className="rounded-full bg-grus px-3 py-1 text-sm font-bold text-kridt">
            {likes} venter på dig
          </span>
        )}
      </div>

      {!player ? (
        <div className="card text-center">
          <p className="font-bold">Ikke flere lige nu</p>
          <p className="mt-2 text-sm text-net/60">
            Du har set alle spillere på dit niveau i dit område. Kig forbi igen om
            et par dage — eller slå et{" "}
            <Link href="/makkere/ny" className="font-semibold text-grus underline">
              opslag
            </Link>{" "}
            op i stedet.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            {/* Initialer som billede — vi gemmer ikke brugeruploadede fotos */}
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-bane">
              <span className="display text-3xl text-kridt">
                {player.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            </div>
            <p className="text-center text-2xl font-bold">{player.name}</p>
            <div className="mt-2 flex justify-center">
              <LevelBadge level={player.level} />
            </div>
            {player.area && (
              <p className="mt-2 text-center text-net/60">{player.area}</p>
            )}
            {player.bio && <p className="mt-4 text-center">{player.bio}</p>}
            {player.role === "COACH" && (
              <p className="mt-3 text-center text-sm font-semibold text-grus">
                Er også træner på platformen
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <form action={submitSwipe} className="flex-1">
              <input type="hidden" name="toUserId" value={player.id} />
              <input type="hidden" name="liked" value="0" />
              <button className="btn-ghost w-full py-3">Spring over</button>
            </form>
            <form action={submitSwipe} className="flex-1">
              <input type="hidden" name="toUserId" value={player.id} />
              <input type="hidden" name="liked" value="1" />
              <button className="btn-grus w-full py-3">Vil spille</button>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-net/50">
            Siger I begge ja, åbner der en samtale. Den anden får ikke besked,
            hvis du springer over.
          </p>
        </>
      )}
    </div>
  );
}
