// Turns the captured app screens into store pictures.
//
// Same frame every time: the headline at the top, the real screen in a phone
// below it, on the brand's navy with the court marked out behind. Apple wants
// 1290×2796 (6.7"), Google Play 1080×1920 plus a 1024×500 feature graphic.
//
// Usage: node compose.mjs <shots dir> <out dir>
import pw from "/opt/npm-tools/node_modules/playwright/index.js";
import fs from "node:fs";
import path from "node:path";
const { chromium } = pw;

const shots = process.argv[2] ?? "./shots";
const out = process.argv[3] ?? "./out";
fs.mkdirSync(`${out}/ios`, { recursive: true });
fs.mkdirSync(`${out}/android`, { recursive: true });

const SLIDES = [
  { file: "players", eyebrow: "Find a game", title: "Someone to play,\nwherever you are." },
  { file: "courts", eyebrow: "Book a court", title: "Every open court\nnear you." },
  { file: "club", eyebrow: "One tap", title: "Pick a time.\nPay in the app." },
  { file: "coaches", eyebrow: "Get better", title: "Book a coach\nfor your next step." },
  { file: "messages", eyebrow: "Set it up", title: "Message your match\nand play." },
];

const asData = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;

const page = ({ width, height, title, eyebrow, screen, phoneTop, phoneWidth, titleSize }) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; background: #0B1C33;
         font-family: "Inter Display", Inter, system-ui, sans-serif; position: relative; }
  /* The court, drawn big and faint behind everything. */
  .court { position: absolute; inset: -8% -30% auto; height: 86%; opacity: .55;
           background:
             radial-gradient(55% 42% at 50% 16%, rgba(59,132,232,.42), transparent 72%),
             radial-gradient(38% 26% at 86% 6%, rgba(216,255,62,.13), transparent 72%); }
  .lines { position: absolute; left: -18%; right: -18%; top: ${Math.round(height * 0.3)}px; height: ${Math.round(height * 0.5)}px;
           opacity: .10; transform: rotate(-11deg); }
  .top { position: absolute; left: ${Math.round(width * 0.085)}px; right: ${Math.round(width * 0.085)}px; top: ${Math.round(height * 0.055)}px; }
  .eyebrow { color: #D8FF3E; font-weight: 800; letter-spacing: .18em; text-transform: uppercase;
             font-size: ${Math.round(width * 0.028)}px; margin-bottom: ${Math.round(height * 0.014)}px; }
  h1 { color: #fff; font-weight: 900; font-size: ${titleSize}px; line-height: 1.04; letter-spacing: -.025em; white-space: pre-line; }
  .phone { position: absolute; left: 50%; transform: translateX(-50%); top: ${phoneTop}px; width: ${phoneWidth}px;
           border-radius: ${Math.round(phoneWidth * 0.11)}px; padding: ${Math.round(phoneWidth * 0.014)}px;
           background: linear-gradient(160deg, #35507a, #11233c);
           box-shadow: 0 ${Math.round(height * 0.02)}px ${Math.round(height * 0.05)}px rgba(0,0,0,.55), 0 0 ${Math.round(height * 0.06)}px rgba(59,132,232,.28); }
  .phone img { display: block; width: 100%; border-radius: ${Math.round(phoneWidth * 0.098)}px; }
</style></head><body>
  <div class="court"></div>
  <svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none">
    <g stroke="#9CC6FF" stroke-width=".25" fill="none">
      <rect x="8" y="4" width="84" height="56" /><line x1="8" y1="32" x2="92" y2="32" />
      <line x1="50" y1="4" x2="50" y2="60" /><rect x="25" y="18" width="50" height="28" />
    </g>
  </svg>
  <div class="top"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>
  <div class="phone"><img src="${screen}" /></div>
</body></html>`;

const feature = ({ screen }) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1024px; height: 500px; overflow: hidden; background: #0B1C33; position: relative;
         font-family: "Inter Display", Inter, system-ui, sans-serif; display: flex; align-items: center; }
  .glow { position: absolute; inset: 0; background:
      radial-gradient(45% 120% at 72% 50%, rgba(59,132,232,.5), transparent 70%),
      radial-gradient(30% 80% at 12% 20%, rgba(216,255,62,.12), transparent 70%); }
  .copy { position: relative; padding: 0 56px; max-width: 620px; }
  .eyebrow { color: #D8FF3E; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; font-size: 15px; margin-bottom: 12px; }
  h1 { color: #fff; font-weight: 900; font-size: 54px; line-height: 1.03; letter-spacing: -.028em; }
  p { color: #A9B8CC; font-size: 20px; margin-top: 16px; line-height: 1.4; }
  .phone { position: absolute; right: 60px; top: 42px; width: 230px; border-radius: 26px; padding: 3px;
           background: linear-gradient(160deg, #35507a, #11233c); box-shadow: 0 24px 60px rgba(0,0,0,.55); }
  .phone img { display: block; width: 100%; border-radius: 23px; }
</style></head><body>
  <div class="glow"></div>
  <div class="copy">
    <div class="eyebrow">Courts · Coaches · Players</div>
    <h1>Your next court,<br>one tap away.</h1>
    <p>Book courts, find a coach and meet players at your level.</p>
  </div>
  <div class="phone"><img src="${screen}" /></div>
</body></html>`;

const b = await chromium.launch();
const render = async (html, width, height, file) => {
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.screenshot({ path: file });
  await p.close();
  console.log("·", path.basename(file));
};

for (const [i, s] of SLIDES.entries()) {
  const src = `${shots}/${s.file}.png`;
  if (!fs.existsSync(src)) { console.log("!", s.file, "missing"); continue; }
  const screen = asData(src);
  const n = String(i + 1).padStart(2, "0");
  await render(page({ width: 1290, height: 2796, title: s.title, eyebrow: s.eyebrow, screen, phoneTop: 820, phoneWidth: 1000, titleSize: 108 }), 1290, 2796, `${out}/ios/${n}-${s.file}.png`);
  await render(page({ width: 1080, height: 1920, title: s.title, eyebrow: s.eyebrow, screen, phoneTop: 600, phoneWidth: 760, titleSize: 86 }), 1080, 1920, `${out}/android/${n}-${s.file}.png`);
}
await render(feature({ screen: asData(`${shots}/${SLIDES[0].file}.png`) }), 1024, 500, `${out}/android/feature-graphic.png`);
await b.close();
