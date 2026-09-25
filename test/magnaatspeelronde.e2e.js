/* Magnaat na 1.0, DE SPEELRONDE IN EEN ECHTE BROWSER EN TEGEN EEN ECHTE SERVER.
   Een kantoormens op naam opent het Magnaat-kantoor en ziet het blok
   "Hoe spelers de balans ervaren": eerst leeg met de uitleg, en daarna -- met
   het echte antwoord van de server, aangevuld met oordelen -- de tabel per niveau
   en moment en de losse regels, met tekst die ge-escaped wordt. De route is de
   bestaande /api/office/magnaat/status; een lid komt er niet bij. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, kantoorAlsPersoon, wachtOpTekst } = require('./helper');

const pw = laadPlaywright();

test('het kantoor ziet de speelronde: eerst leeg, dan per niveau en moment, en een lid komt er niet bij', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-speelronde-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const post = (pad, tok) => fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' });
    const lid = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ronde Speler', email: 'ronde@x.nl', phone: '0612345672', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json();
    assert.ok(lid.token);
    assert.ok([401, 403].includes((await post('/api/office/magnaat/status', lid.token)).status), 'een lid komt niet bij de speelronde');

    const kantoor = await kantoorAlsPersoon(base);
    assert.ok(kantoor, 'een kantoormens op naam');
    const echt = await (await post('/api/office/magnaat/status', kantoor)).json();
    assert.equal(echt.speelronde.totaal, 0, 'de echte server geeft de speelronde mee');
    assert.match(echt.speelronde.grens, /Anoniem/);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((t) => { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, kantoor);
    await page.goto(base + '/apps/magnaat-kantoor.html', { waitUntil: 'domcontentloaded' });
    await wachtOpTekst(page, 'Nog geen oordelen', { in: '#speelronde' });

    /* Hetzelfde echte antwoord, met oordelen erbij: zo wordt de tabel getekend zonder dat de toets een heel leven hoeft te spelen. */
    await page.route('**/api/office/magnaat/status', async (route) => {
      const r = await route.fetch();
      const d = await r.json();
      d.speelronde.totaal = 3;
      d.speelronde.perNiveau.zwaar.voorbij['te-zwaar'] = 2;
      d.speelronde.perNiveau.normaal.zelfstandig.goed = 1;
      d.speelronde.regels = [{ moeilijkheid: 'zwaar', moment: 'voorbij', dag: 92, oordeel: 'te-zwaar', tekst: '<b>te duur</b> personeel', op: '2026-09-25' }];
      return route.fulfill({ response: r, json: d });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wachtOpTekst(page, 'te duur', { in: '#speelronde' });
    const rijen = await page.$$eval('#speelronde tbody tr', (tr) => tr.map(r => Array.from(r.cells).map(c => c.textContent)));
    assert.deepEqual(rijen, [
      ['normaal', 'je kunt van je eigen bedrijf leven', '0', '1', '0', '1'],
      ['zwaar', 'dit leven is voorbij', '0', '0', '2', '2']
    ]);
    assert.equal(await page.$('#speelronde b'), null, 'tekst van een speler wordt niet als HTML getekend');
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
