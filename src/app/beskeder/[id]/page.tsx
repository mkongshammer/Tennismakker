import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/session";
import { loadThread, readMessages, MAX_MESSAGE_LENGTH } from "../../../lib/messages";
import { sendMessage } from "../../../lib/actions";

export const dynamic = "force-dynamic";

function clock(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function SamtalePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await loadThread(params.id, user.id);
  if (!access.ok) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">{access.reason}</p>
        <Link href="/beskeder" className="btn-ghost mt-4">Tilbage til beskeder</Link>
      </div>
    );
  }

  const messages = await readMessages(params.id, user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/beskeder" className="text-sm text-slate/60 hover:underline">
        ← Beskeder
      </Link>
      <h1 className="display mt-2 text-2xl">{access.otherUser.name}</h1>
      <p className="text-sm text-slate/60">Om: {access.thread.message}</p>

      <div className="my-6 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate/50">
            Ingen beskeder endnu — skriv den første og aftal en tid.
          </p>
        )}
        {messages.map((m: any) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  mine ? "bg-ink text-chalk" : "bg-white border border-slate/10"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-xs ${mine ? "text-chalk/60" : "text-slate/40"}`}>
                  {clock(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form action={sendMessage} className="sticky bottom-0 flex gap-2 bg-chalk pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <input type="hidden" name="matchRequestId" value={params.id} />
        <input
          className="input flex-1"
          name="body"
          placeholder="Skriv en besked…"
          maxLength={MAX_MESSAGE_LENGTH}
          required
          autoComplete="off"
        />
        <button className="btn-court">Send</button>
      </form>
    </div>
  );
}
