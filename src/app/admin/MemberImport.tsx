"use client";
// Import members from the old system's export (or the list saved by the free
// import check) and invite them. Used in the "Move your club" checklist and
// on the members page.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MemberFilePicker } from "../../components/MemberFilePicker";

type Preview = { rows: number; members: number; missingEmail: number; invalidEmail: number; duplicates: number; memberships: { name: string; count: number }[]; sample: { name: string; email: string; membership: string }[] };

async function post(body: unknown) {
  const res = await fetch("/admin/members-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(data.error || "Something went wrong.");
  return data;
}

export function MemberImport({ draftCount = 0, draftSource = "" }: { draftCount?: number; draftSource?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  const run = async (fn: () => Promise<{ ok?: string; preview?: Preview }>) => {
    setBusy(true); setMsg({});
    try { const r = await fn(); if (r.preview) setPreview(r.preview); if (r.ok) { setMsg({ ok: r.ok }); setPreview(null); setText(""); router.refresh(); } }
    catch (e) { setMsg({ error: e instanceof Error ? e.message : "Something went wrong." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {draftCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
          <p><strong>{draftCount.toLocaleString("en-US")} members</strong> from your import check{draftSource ? ` (${draftSource})` : ""} are ready.</p>
          <button type="button" disabled={busy} onClick={() => void run(() => post({ intent: "draft" }))} className="btn-court">{busy ? "Importing…" : "Import them now"}</button>
        </div>
      )}
      {!preview && <MemberFilePicker disabled={busy} label={draftCount ? "Or upload a different file" : "Upload your member list"} onText={(t) => { setText(t); void run(() => post({ intent: "preview", text: t })); }} />}
      {preview && (
        <div className="space-y-3 rounded-2xl border border-slate/20 p-4">
          <p className="font-bold">{preview.members.toLocaleString("en-US")} members will be added</p>
          {(preview.missingEmail + preview.invalidEmail + preview.duplicates) > 0 && <p className="text-sm text-slate">Left out: {[preview.missingEmail && `${preview.missingEmail} without e-mail`, preview.invalidEmail && `${preview.invalidEmail} invalid e-mail`, preview.duplicates && `${preview.duplicates} duplicates`].filter(Boolean).join(", ")}.</p>}
          {preview.memberships.length > 0 && <p className="text-sm text-slate">Membership types in the file: {preview.memberships.map((m) => `${m.name} (${m.count})`).join(", ")}. Create matching plans under Members.</p>}
          <ul className="text-sm text-slate">{preview.sample.map((m) => <li key={m.email}>{m.name} · {m.email}</li>)}</ul>
          <p className="text-xs text-slate">Nothing is e-mailed to members when you import.</p>
          <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void run(() => post({ intent: "import", text }))} className="btn-court">{busy ? "Importing…" : "Import members"}</button><button type="button" onClick={() => { setPreview(null); setText(""); }} className="btn-ghost">Cancel</button></div>
        </div>
      )}
      {msg.ok && <p className="text-success-ink" role="status">✓ {msg.ok}</p>}
      {msg.error && <p className="field-error" role="alert">{msg.error}</p>}
    </div>
  );
}

export function InviteMembersButton({ pending }: { pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  if (!pending && !msg.ok) return <p className="text-sm text-slate">Everyone has been invited or has signed in.</p>;
  return (
    <div className="space-y-2">
      {!confirm ? <button type="button" className="btn-court" onClick={() => setConfirm(true)}>Invite {pending.toLocaleString("en-US")} members</button> : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">E-mail {pending.toLocaleString("en-US")} members a link to set their password and get the app?</span>
          <button type="button" disabled={busy} className="btn-court" onClick={async () => {
            setBusy(true); setMsg({});
            try { const r = await post({ intent: "invite" }); setMsg({ ok: r.ok }); setConfirm(false); router.refresh(); } catch (e) { setMsg({ error: e instanceof Error ? e.message : "Couldn't send." }); } finally { setBusy(false); }
          }}>{busy ? "Sending…" : "Yes, send"}</button>
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
      {msg.ok && <p className="text-success-ink" role="status">✓ {msg.ok}</p>}
      {msg.error && <p className="field-error" role="alert">{msg.error}</p>}
    </div>
  );
}
