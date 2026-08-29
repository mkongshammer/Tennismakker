import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { listThreads } from "../../lib/messages";

export const dynamic = "force-dynamic";

const DAYS = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

function when(d: Date) {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default async function BeskederPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const threads = await listThreads(user.id);

  return (
    <div>
      <h1 className="display mb-6 text-3xl">Beskeder</h1>

      {threads.length === 0 ? (
        <div className="card text-net/60">
          Du har ingen samtaler endnu. Slå til på et{" "}
          <Link href="/makkere" className="font-semibold text-grus underline">
            makker-opslag
          </Link>
          , så åbner der en samtale her.
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((t: any) => (
            <li key={t.id}>
              <Link href={`/beskeder/${t.id}`} className="card block hover:border-grus">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">
                    {t.otherName}
                    {t.unread && (
                      <span className="ml-2 rounded-full bg-grus px-2 py-0.5 text-xs text-kridt">
                        ny
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-net/50">{when(t.lastAt)}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-net/70">
                  {t.lastBody ?? `Om: ${t.subject}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
