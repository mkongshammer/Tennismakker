"use client";
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn-ghost">Download the guide (PDF)</button>;
}
