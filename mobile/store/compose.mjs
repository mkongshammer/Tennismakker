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
  { file: "players", eyebrow: "Find a game", title: "Someone to play,\nwherever you are.", accent: "ball" },
  { file: "courts", eyebrow: "Book a court", title: "Every open court\nnear you.", accent: "court" },
  { file: "club", eyebrow: "One tap", title: "Pick a time.\nPay in the app.", accent: "ball-low" },
  { file: "coaches", eyebrow: "Get better", title: "Book a coach for\nyour next step.", accent: "court" },
];

const asData = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;

const ACCENT = {
  ball: `<div class="ball" style="right:-7%; top:25%"></div>`,
  "ball-low": `<div class="ball" style="left:-9%; top:28%"></div>`,
  court: `<svg class="courtline" viewBox="0 0 100 60" preserveAspectRatio="none"><g stroke="#1B62C4" stroke-width=".5" fill="none">
      <rect x="2" y="2" width="96" height="56" rx="1" /><line x1="2" y1="30" x2="98" y2="30" /><line x1="50" y1="2" x2="50" y2="58" />
      <rect x="26" y="14" width="48" height="32" /></g></svg>`,
};

const page = ({ width, height, title, eyebrow, screen, accent, phoneTop, phoneWidth, titleSize }) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; background: #F4F1EA;
         font-family: "Inter Display", Inter, system-ui, sans-serif; position: relative; }
  /* One accent per slide, kept behind the phone so nothing competes with it. */
  .ball { position: absolute; width: ${Math.round(width * 0.27)}px; height: ${Math.round(width * 0.27)}px; border-radius: 50%;
          background: radial-gradient(circle at 34% 28%, #E9FF72, #B9DE1F 70%, #9CC01A); }
  .courtline { position: absolute; left: -14%; right: -14%; top: ${Math.round(height * 0.26)}px;
               width: 128%; height: ${Math.round(height * 0.3)}px; opacity: .1; transform: rotate(-9deg); }
  .top { position: absolute; left: ${Math.round(width * 0.085)}px; right: ${Math.round(width * 0.085)}px; top: ${Math.round(height * 0.052)}px; }
  .eyebrow { color: #B4541E; font-weight: 800; letter-spacing: .2em; text-transform: uppercase;
             font-size: ${Math.round(width * 0.027)}px; margin-bottom: ${Math.round(height * 0.012)}px; }
  h1 { color: #10243D; font-weight: 900; font-size: ${titleSize}px; line-height: 1.03; letter-spacing: -.03em; white-space: pre-line; }
  .phone { position: absolute; left: 50%; transform: translateX(-50%); top: ${phoneTop}px; width: ${phoneWidth}px;
           border-radius: ${Math.round(phoneWidth * 0.112)}px; padding: ${Math.round(phoneWidth * 0.013)}px;
           background: linear-gradient(160deg, #26384f, #0d1725);
           box-shadow: 0 ${Math.round(height * 0.022)}px ${Math.round(height * 0.045)}px rgba(16, 36, 61, .3); }
  .phone img { display: block; width: 100%; border-radius: ${Math.round(phoneWidth * 0.1)}px; }
</style></head><body>
  ${ACCENT[accent] ?? ""}
  <div class="top"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>
  <div class="phone"><img src="${screen}" /></div>
</body></html>`;

const feature = ({ screen }) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1024px; height: 500px; overflow: hidden; background: #F4F1EA; position: relative;
         font-family: "Inter Display", Inter, system-ui, sans-serif; display: flex; align-items: center; }
  .ball { position: absolute; width: 230px; height: 230px; border-radius: 50%; right: 266px; top: -60px;
          background: radial-gradient(circle at 34% 28%, #E9FF72, #B9DE1F 70%, #9CC01A); }
  .copy { position: relative; padding: 0 56px; max-width: 620px; }
  .eyebrow { color: #B4541E; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; font-size: 15px; margin-bottom: 12px; }
  h1 { color: #10243D; font-weight: 900; font-size: 56px; line-height: 1.02; letter-spacing: -.03em; }
  p { color: #54677E; font-size: 20px; margin-top: 16px; line-height: 1.4; }
  .phone { position: absolute; right: 58px; top: 44px; width: 232px; border-radius: 26px; padding: 3px;
           background: linear-gradient(160deg, #26384f, #0d1725); box-shadow: 0 24px 60px rgba(16,36,61,.3); }
  .phone img { display: block; width: 100%; border-radius: 23px; }
</style></head><body>
  <div class="ball"></div>
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
  await render(page({ width: 1290, height: 2796, title: s.title, eyebrow: s.eyebrow, accent: s.accent, screen, phoneTop: 760, phoneWidth: 1040, titleSize: 108 }), 1290, 2796, `${out}/ios/${n}-${s.file}.png`);
  await render(page({ width: 1080, height: 1920, title: s.title, eyebrow: s.eyebrow, accent: s.accent, screen, phoneTop: 540, phoneWidth: 800, titleSize: 84 }), 1080, 1920, `${out}/android/${n}-${s.file}.png`);
}
await render(feature({ screen: asData(`${shots}/${SLIDES[0].file}.png`) }), 1024, 500, `${out}/android/feature-graphic.png`);
await b.close();
