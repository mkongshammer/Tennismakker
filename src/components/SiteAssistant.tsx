"use client";
// "Questions?" chat bubble for visitors who aren't signed in.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = { role: "assistant", content: "Hi! I can answer questions about RacketBuddy: pricing, features, getting your club set up, or booking as a player. What would you like to know?" };
const SUGGESTIONS = ["What does it cost?", "How do I set up my club?", "Can members pay online?"];
const HIDDEN = ["/admin", "/superadmin", "/checkout", "/pay", "/app-session"];

export function SiteAssistant() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useRef<string>("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!id.current) id.current = (globalThis.crypto?.randomUUID?.() ?? String(Date.now())); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, open, busy]);

  if (HIDDEN.some((p) => path.startsWith(p))) return null;

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next); setDraft(""); setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: id.current, messages: next.slice(1) }) });
      const data = await res.json().catch(() => ({}));
      setMessages([...next, { role: "assistant", content: data.reply || "Sorry, something went wrong. Please e-mail support@racketbuddy.app." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "I couldn't connect. Please try again, or e-mail support@racketbuddy.app." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div role="dialog" aria-label="RacketBuddy assistant" className="flex h-[min(560px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0F2138] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-white">RacketBuddy assistant</p>
              <p className="text-xs text-white/60">Instant answers · AI, can make mistakes</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">✕</button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-md bg-[#1B62C4] text-white" : "rounded-bl-md bg-white/10 text-white"}`}>{m.content}</p>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90 hover:border-white/50">{s}</button>)}
              </div>
            )}
            {busy && <p className="text-xs text-white/60">Typing…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(draft); }} className="flex gap-2 border-t border-white/10 p-3">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1200} placeholder="Ask a question…" aria-label="Your question" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0B1C33] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#3B84E8] focus:outline-none" />
            <button type="submit" disabled={busy || !draft.trim()} className="rounded-xl bg-[#D8FF3E] px-4 text-sm font-bold text-[#0F2138] disabled:opacity-50">Send</button>
          </form>
        </div>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 rounded-full bg-[#D8FF3E] px-4 py-3 text-sm font-bold text-[#0F2138] shadow-xl transition hover:brightness-95">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
        {open ? "Close" : "Questions?"}
      </button>
    </div>
  );
}
