/** Tiny branded HTML answer for e-mail links (no app shell: they open from a mail client). */
export function linkPage(title: string, message: string, status = 200) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return new Response(
    `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} — RacketBuddy</title><style>body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#F1F5F9;color:#0F2138;margin:0;padding:48px 20px}main{max-width:520px;margin:0 auto;background:#fff;border-radius:20px;padding:32px;box-shadow:0 8px 24px -12px rgba(15,33,56,.18)}h1{font-size:24px;margin:0 0 12px;letter-spacing:-.02em}p{line-height:1.55;color:#54677E;margin:0 0 20px}a.btn{display:inline-block;background:#1B62C4;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:12px}</style></head><body><main><h1>${esc(title)}</h1><p>${esc(message)}</p><a class="btn" href="/courts">Find courts</a></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}
