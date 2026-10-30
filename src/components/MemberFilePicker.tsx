"use client";
// Pick the member export as it comes out of the old system: CSV, TSV/TXT or
// Excel. Excel is read in the browser and turned into tab-separated text, so
// the server only ever sees text.
import { useState } from "react";

export async function fileToText(file: File): Promise<string> {
  if (file.size > 3_000_000) throw Error("The file is larger than 3 MB. Export active members only, or split the list.");
  if (/\.(xlsx|xlsm)$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((r) => r.map((c) => (c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c)).replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
  }
  if (/\.xls$/i.test(file.name)) throw Error("That's an old Excel file (.xls). Open it and save it as .xlsx or CSV, then upload again.");
  return file.text();
}

export function MemberFilePicker({ onText, disabled, label = "Choose your member file" }: { onText: (text: string, fileName: string) => void; disabled?: boolean; label?: string }) {
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const handle = async (file?: File | null) => {
    if (!file) return;
    setError("");
    try { onText(await fileToText(file), file.name); } catch (e) { setError(e instanceof Error ? e.message : "The file couldn't be read."); }
  };
  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files?.[0]); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? "border-court-light bg-court-tint/40" : "border-slate/30 hover:border-court-light"} ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 text-court-light" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-slate">Excel or CSV, straight from your current system. Drag it here or click.</span>
        <input type="file" className="sr-only" accept=".csv,.txt,.tsv,.xlsx,.xlsm,.xls,text/csv" disabled={disabled} onChange={(e) => void handle(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="field-error mt-2">{error}</p>}
    </div>
  );
}
