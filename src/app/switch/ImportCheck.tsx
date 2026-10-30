"use client";
// The free import check: upload the member export, see what moves, then sign
// up. The list waits (encrypted, 14 days) and imports with one click after payment.
import Link from "next/link";
import { useState } from "react";
import { MemberFilePicker } from "../../components/MemberFilePicker";

type Result = {
  rows: number; members: number; missingEmail: number; invalidEmail: number; duplicates: number; withPhone: number;
  columns: Record<string, string | null>; memberships: { name: string; count: number }[];
  sample: { name: string; email: string; membership: string }[];
};

const SYSTEMS = ["CourtReserve", "ClubReady / Club Automation", "PlayByPoint", "Skedda", "Mindbody", "Excel or Google Sheets", "Another system"];

export function ImportCheck({ priceLabel }: { priceLabel: string }) {
  const [source, setSource] = useState(SYSTEMS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [fileName, setFileName] = useState("");

  async function check(text: string, name: string) {
    setBusy(true); setError(""); setResult(null); setFileName(name);
    try {
      const res = await fetch("/api/import-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, source }) });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "The file couldn't be checked.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "The file couldn't be checked."); }
    finally { setBusy(false); }
  }

  const skipped = result ? result.missingEmail + result.invalidEmail + result.duplicates : 0;

  return (
    <div className="card space-y-5" id="check">
      <div>
        <p className="eyebrow text-court-light">Free · no account needed</p>
        <h2 className="display mt-1 text-display-md">See what moves before you pay</h2>
        <p className="mt-2 text-slate">Upload the member list from your current system. We show you exactly who comes across. Your file isn't shared with anyone, and nothing is sent to your members.</p>
      </div>
      <label className="block max-w-sm"><span className="label">Where are you coming from?</span>
        <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>{SYSTEMS.map((s) => <option key={s}>{s}</option>)}</select>
      </label>
      <MemberFilePicker onText={(t, n) => void check(t, n)} disabled={busy} label={busy ? "Checking your file…" : "Upload your member list"} />
      {error && <p role="alert" className="field-error">{error}</p>}
      {result && (
        <div className="space-y-4 rounded-2xl border border-success/40 bg-success/10 p-5" aria-live="polite">
          <p className="text-lg font-bold">✓ {result.members.toLocaleString("en-US")} members are ready to move{fileName ? <span className="font-normal text-slate"> from {fileName}</span> : null}</p>
          <ul className="grid gap-1 text-sm text-slate sm:grid-cols-2">
            <li>Names and e-mail addresses: {result.members.toLocaleString("en-US")}</li>
            <li>With phone numbers: {result.withPhone.toLocaleString("en-US")}</li>
            {result.memberships.length > 0 && <li className="sm:col-span-2">Membership types found: {result.memberships.map((m) => `${m.name} (${m.count})`).join(", ")}</li>}
            {skipped > 0 && <li className="sm:col-span-2">Left out: {[result.missingEmail && `${result.missingEmail} without e-mail`, result.invalidEmail && `${result.invalidEmail} with an invalid e-mail`, result.duplicates && `${result.duplicates} duplicates`].filter(Boolean).join(", ")}</li>}
          </ul>
          {result.sample.length > 0 && (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate"><tr><th className="py-1 pr-4 font-semibold">Name</th><th className="py-1 pr-4 font-semibold">E-mail</th><th className="py-1 font-semibold">Membership</th></tr></thead>
              <tbody>{result.sample.map((m) => <tr key={m.email} className="border-t border-white/10"><td className="py-1.5 pr-4">{m.name}</td><td className="py-1.5 pr-4">{m.email}</td><td className="py-1.5">{m.membership || "–"}</td></tr>)}</tbody></table>
              <p className="mt-1 text-xs text-slate">First {result.sample.length} of {result.members.toLocaleString("en-US")}.</p></div>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/list-your-club" className="btn-court">Set up my club · {priceLabel}</Link>
            <span className="text-sm text-slate">Your list is saved on this device for 14 days. After payment it imports with one click.</span>
          </div>
        </div>
      )}
    </div>
  );
}
