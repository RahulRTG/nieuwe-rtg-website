/* Scherm-test voor het DELEN van een clip, gevonden door de voltooiproef
   (scripts/lib/voltooi/clips.js). Twee fouten op dezelfde knop:

   1. De duur was de tijd van "opnemen" tot "delen", niet die van de opname:
      wie twee seconden opnam en daarna rustig een titel typte, deelde een clip
      die volgens de kaart veel langer duurde (tot 60 s).
   2. Een dubbele tik op Deel maakte twee kaarten voor een opname: de knop ging
      pas na een geslaagde deling dicht, en het verzoek droeg geen sleutel.

   Camera en recorder zijn hier een nep (een canvas-stroom en een recorder die
   bij stop een brok aflevert); de rest is het echte scherm tegen de echte
   server. MUTATIE GEZIEN ZAKKEN: de oude regel terugzetten
   (`duurS = ... (Date.now() - opnameStart)` bij het delen, zonder idem) liet
   beide beweringen zakken. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Clips delen: de duur is die van de opname, en een dubbele tik is een kaart',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-clipdeel-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Clip Deel', email: 'cd' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1995-05-05', tier: 'rtg' });
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      window.MediaRecorder = class {
        static isTypeSupported() { return true; }
        constructor() { this.state = 'inactive'; }
        start() { this.state = 'recording'; window.__opnameVan = Date.now(); }
        stop() {
          if (this.state === 'inactive') return;
          this.state = 'inactive'; window.__opnameTot = Date.now();
          this.ondataavailable && this.ondataavailable({ data: new Blob([new Uint8Array(2048)], { type: 'video/webm' }) });
          this.onstop && this.onstop();
        }
      };
    }, reg.token);
    await page.goto(base + '/apps/clips.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.RTGMedia && document.querySelector('#feed'), null, { timeout: 15000 });
    await page.evaluate(() => {
      window.RTGMedia.camera = async () => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; return c.captureStream(); };
    });
    await page.evaluate(() => document.querySelector('#studioOpen').click());
    await page.waitForFunction(() => /Klaar om op te nemen/.test((document.querySelector('#studioStatus') || {}).textContent || ''), null, { timeout: 8000 });

    // twee seconden opnemen, dan nog drie seconden een titel typen
    await page.click('#opneem');
    await page.waitForTimeout(2000);
    await page.click('#stopOpname');
    await page.waitForTimeout(3000);
    await page.fill('#clipTitel', 'Grachten in de mist');
    await page.dblclick('#deelClip');
    await page.waitForFunction(() => /staat in uw archief|bewaren lukte niet/.test((document.querySelector('#melding') || {}).textContent || ''), null, { timeout: 10000 });
    await page.waitForTimeout(500);

    const feed = await api(base, '/api/clips/feed', {}, reg.token);
    const mijn = (feed.mijn || []).filter((c) => c.titel === 'Grachten in de mist');
    assert.equal(mijn.length, 1, 'een opname, een kaart -- ook na een dubbele tik');
    /* Gemeten in de pagina, zodat een trage machine de toets niet laat wankelen:
       de opname zelf duurde `opname` seconden, en het delen kwam minstens drie
       seconden later. De oude rekening gaf opname + 3 of meer. */
    const opname = await page.evaluate(() => Math.round((window.__opnameTot - window.__opnameVan) / 1000));
    assert.ok(Math.abs(mijn[0].duurS - Math.max(1, opname)) <= 1,
      'de duur van de opname (' + opname + ' s), niet tot het delen: ' + mijn[0].duurS);
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    child.kill('SIGKILL');
  }
});
