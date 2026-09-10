import { db } from "../../lib/db";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(value);
}

export async function Aktivitet() {
  const [memberCount, messages] = await Promise.all([
    db.user.count({ where: { role: { in: ["PLAYER", "COACH"] } } }),
    db.message.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        matchRequestId: true,
        senderId: true,
        createdAt: true,
        matchRequest: {
          select: {
            requesterId: true,
            acceptedById: true,
            requester: { select: { name: true } },
            acceptedBy: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const senderIds = new Set(messages.map((m) => m.senderId));
  const participantIds = new Set<string>();
  const threads = new Map<
    string,
    {
      requester: string;
      acceptedBy: string | null;
      count: number;
      lastAt: Date;
    }
  >();

  for (const message of messages) {
    participantIds.add(message.matchRequest.requesterId);
    if (message.matchRequest.acceptedById) {
      participantIds.add(message.matchRequest.acceptedById);
    }

    const existing = threads.get(message.matchRequestId);
    if (existing) {
      existing.count += 1;
      continue;
    }

    threads.set(message.matchRequestId, {
      requester: message.matchRequest.requester.name,
      acceptedBy: message.matchRequest.acceptedBy?.name ?? null,
      count: 1,
      lastAt: message.createdAt,
    });
  }

  const recentThreads = Array.from(threads.values())
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .slice(0, 8);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="display text-2xl">Spilleraktivitet</h2>
          <p className="text-sm text-slate">
            Live tal for medspillere og beskeder på RacketBuddy.
          </p>
        </div>
        <span className="text-xs text-slate">Opdateres når siden genindlæses</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Spillere / trænere</p>
          <p className="mt-1 text-3xl font-bold">{memberCount}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Samtaler med beskeder</p>
          <p className="mt-1 text-3xl font-bold">{threads.size}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Beskeder sendt</p>
          <p className="mt-1 text-3xl font-bold">{messages.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Aktive i samtaler</p>
          <p className="mt-1 text-3xl font-bold">{participantIds.size}</p>
          <p className="mt-1 text-xs text-slate">{senderIds.size} har selv sendt mindst én besked</p>
        </div>
      </div>

      <div className="card mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-bold">Seneste samtaler</p>
          <p className="text-xs text-slate">Viser kun metadata, ikke beskedindhold</p>
        </div>

        {recentThreads.length === 0 ? (
          <p className="mt-3 text-sm text-slate">Ingen medlemmer har skrevet sammen endnu.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate/10">
            {recentThreads.map((thread, index) => (
              <li key={`${thread.requester}-${thread.acceptedBy}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="font-semibold">
                  {thread.requester} ↔ {thread.acceptedBy ?? "afventer modpart"}
                </span>
                <span className="text-slate">
                  {thread.count} {thread.count === 1 ? "besked" : "beskeder"}
                </span>
                <span className="ml-auto text-xs text-slate">{formatDate(thread.lastAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
