// Builds public/i18n/es.json: English interface text → Spanish, for the
// website's Spanish mode (see src/components/SpanishTranslator.tsx).
// Sources: shared/es-site.json (site copy) + every en/en-US → es pair in
// shared/localized-phrases.json and shared/translations.json.
import fs from 'node:fs';
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const out = {};
const add = (en, es) => { if (!en || !es) return; const k = norm(en), v = norm(es); if (k && v && k !== v && !(k in out)) out[k] = v; };
for (const [en, es] of Object.entries(JSON.parse(fs.readFileSync('shared/es-site.json', 'utf8')))) add(en, es);
for (const file of ['shared/localized-phrases.json', 'shared/translations.json']) {
  for (const entry of Object.values(JSON.parse(fs.readFileSync(file, 'utf8')))) {
    if (!entry || typeof entry !== 'object' || !entry.es) continue;
    add(entry['en-US'], entry.es); add(entry.en, entry.es);
  }
}
fs.mkdirSync('public/i18n', { recursive: true });
// Keys with {placeholders} become patterns: {a} matches a number, price, name or date.
const patterns = Object.entries(out).filter(([k]) => /\{[a-z]\}/.test(k));
for (const [k] of patterns) delete out[k];
fs.writeFileSync('public/i18n/es.json', JSON.stringify({ exact: out, patterns }));
console.log(`public/i18n/es.json: ${Object.keys(out).length} phrases, ${patterns.length} patterns`);
