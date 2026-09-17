// Isolated UI smoke test. No live login, database, Shelly calls or server actions.
// Requires Playwright + Chromium and esbuild in the test environment.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require('playwright');

(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'racketbuddy-setup-ui-'));
  execFileSync('npx', ['tailwindcss', '-i', 'src/app/globals.css', '-o', path.join(out, 'styles.css')], { stdio: 'pipe' });
  const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {ClubControlPanel} from './src/app/admin/ClubControlPanel';
      createRoot(document.getElementById('root')).render(<ClubControlPanel courts={[{id:'court1',name:'Bane 1'}]} control={window.fixture} />);`,
      resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'offline-actions', setup(b) {
      b.onResolve({ filter: /club-control-actions$/ }, () => ({ path: 'actions', namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents:
        ['connectControlSetup','saveSetupChannel','confirmSetupChannel','activateControlSetup','pauseControlSetup','testControlChannel','removeControlDevice','runControlNow']
          .map(n => `export const ${n}=undefined;`).join('\n') }));
      b.onLoad({ filter: /ClubControlPanel\.tsx$/ }, args => ({ loader: 'tsx', contents: fs.readFileSync(args.path, 'utf8')
        .replace('import { useFormState } from "react-dom";', 'const useFormState = () => [null, undefined];') }));
      b.onLoad({ filter: /SubmitButton\.tsx$/ }, () => ({ loader: 'tsx', contents:
        'export function SubmitButton({children,className="btn-court"}){return <button type="submit" className={className}>{children}</button>}' }));
    } }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const base = { enabled: false, serverUrl: 'https://shelly-1-eu.shelly.cloud', hasAuthKey: true,
      accessBeforeMinutes: 15, accessAfterMinutes: 15, lightsBeforeMinutes: 10, lightsAfterMinutes: 5, doorPulseSeconds: 5,
      lastCheckedAt: null, lastOkAt: null, lastError: null,
      devices: [{ id:'device1',name:'Controller 1',externalId:'112233445566',channelCount:1,online:true,channels:[] }] };
    const mount = async (fixture, name) => {
      await page.goto('about:blank');
      await page.setContent(`<html><head><style>${fs.readFileSync(path.join(out,'styles.css'),'utf8')}</style></head><body><main id="root" style="padding:16px"></main></body></html>`);
      await page.evaluate(f => { window.fixture = f; }, fixture);
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.getByText(fixture?.enabled ? 'Lys og adgang er aktiveret' : 'Gør klubben klar — ét trin ad gangen', { exact:true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name}: mobile overflow`);
      await page.screenshot({ path:path.join(out,`${name}.png`),fullPage:true });
    };
    await mount(null,'connect');
    assert.equal(await page.getByRole('button',{name:'2. Test relæer'}).isDisabled(),true);
    assert.equal(await page.locator('form').first().evaluate(f => f.checkValidity()),false);
    await mount(base,'map');
    await page.getByLabel('Hvad styrer dette relæ?').selectOption('COURT_LIGHT:court1');
    assert.equal(await page.getByRole('button',{name:'3. Aktivér',exact:true}).isDisabled(),true);
    const mapped = structuredClone(base);
    mapped.devices[0].channels=[{id:'channel1',channel:0,kind:'COURT_LIGHT',label:'Bane 1 lys',courtId:'court1',setupTestedAt:null,setupConfirmedAt:null,lastError:null}];
    await mount(mapped,'test');
    await page.getByRole('button',{name:'Test lyset i 3 sekunder'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Ja, det virker',exact:true}).count(),0);
    mapped.devices[0].channels[0].setupTestedAt='2026-09-17T12:00:00Z';
    await mount(mapped,'confirm');
    await page.getByRole('button',{name:'Ja, det virker',exact:true}).waitFor();
    mapped.devices[0].channels[0].setupConfirmedAt='2026-09-17T12:00:05Z';
    await mount(mapped,'activate');
    await page.getByText('3. Klar til at aktivere',{exact:true}).waitFor();
    await page.getByText('Tilpas tider (valgfrit)',{exact:true}).click();
    await page.getByLabel('Lys før (min.)').fill('20');
    await mount({...mapped,enabled:true},'active');
    await page.getByRole('button',{name:'Pause / ret opsætning'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({ok:true,states:6,viewport:'390x844',screenshots:out}));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
