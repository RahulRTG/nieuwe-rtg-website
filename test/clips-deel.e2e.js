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
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtTot, volgVerzoeken, wachtOpRust } = require('./helper');
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
    await volgVerzoeken(page);
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

    // De neprecorder krijgt twee seconden opnametijd en drie seconden daarna.
    // Alleen de datumklok staat vast; browsergebeurtenissen en timers blijven echt.
    const opnameVan = Date.now();
    await page.clock.setFixedTime(new Date(opnameVan));
    await page.click('#opneem');
    await wachtTot(page, () => window.__opnameVan !== undefined && !document.querySelector('#stopOpname').disabled,
      null, { wat: 'de recorder is gestart en Stop is beschikbaar' });
    await page.clock.setFixedTime(new Date(opnameVan + 2000));
    await page.click('#stopOpname');
    await wachtTot(page, () => window.__opnameTot !== undefined && !document.querySelector('#deelClip').disabled &&
      /Opname klaar/.test(document.querySelector('#studioStatus').textContent),
    null, { wat: 'de opname is afgerond en de clip kan worden gedeeld' });
    await page.clock.setFixedTime(new Date(opnameVan + 5000));
    await page.fill('#clipTitel', 'Grachten in de mist');
    await page.dblclick('#deelClip');
    await wachtTot(page, () => /staat in uw archief/.test((document.querySelector('#melding') || {}).textContent || '') &&
      document.querySelector('#deelClip').disabled,
    null, { ms: 10000, wat: 'de gedeelde clip is lokaal bewaard en delen is afgesloten' });
    await wachtOpRust(page, '#feed', { ms: 10000 });

    const feed = await api(base, '/api/clips/feed', {}, reg.token);
    const mijn = (feed.mijn || []).filter((c) => c.titel === 'Grachten in de mist');
    assert.equal(mijn.length, 1, 'een opname, een kaart -- ook na een dubbele tik');
    /* De recorder en het scherm gebruiken dezelfde gecontroleerde klok:
       twee seconden opname, daarna drie seconden voor de titel.
       De oude rekening gaf vijf seconden. */
    const opname = await page.evaluate(() => Math.round((window.__opnameTot - window.__opnameVan) / 1000));
    assert.equal(opname, 2, 'de duurproef heeft werkelijk twee seconden opnametijd aangeboden');
    assert.ok(Math.abs(mijn[0].duurS - Math.max(1, opname)) <= 1,
      'de duur van de opname (' + opname + ' s), niet tot het delen: ' + mijn[0].duurS);
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    child.kill('SIGKILL');
  }
});
