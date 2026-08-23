/* DE ACTIEBONNEN VAN RAHUL op het scherm: /apps/horeca-beheer.html.

   De regels staan vast in test/horeca-rahul.test.js. Wat hier bewezen wordt is
   het deel dat de hele opdracht draagt: "nooit ongemerkt" gaat over wat een
   MENS ziet, niet over wat er in een bestand staat.

   1. EEN WACHTEND VOORSTEL STAAT OP HET SCHERM, met wat het is en waarom het
      wacht, en met een knop om het te bevestigen.
   2. EEN GEWEIGERDE POGING STAAT ER OOK, met zijn reden. Juist die: een poging
      die niemand ziet is de gevaarlijkste.
   3. BEVESTIGEN DOET HET WERK, en pas dan. Voor de tik staat er geen korting op
      de rekening; erna wel, met de naam van de mens op de bon.
   4. DE GRENS STAAT ER ALS TEKST EN NIET ALS VERZONNEN GETAL: zonder instelling
      zegt het scherm met zoveel woorden dat elke korting een mens vraagt.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahulscherm-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de manager ziet wat Rahul deed en wat wacht, en bevestigt met zijn naam erbij',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const tok = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const H = (pad, body) => post(base, '/api/supplier/horeca' + pad, body, tok);

    const rek = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'RB-1', gasten: 2 })).body.rekening;
    await H('/rekening/regel', { rekeningId: rek.id, naam: 'Menu', prijs: 120, aantal: 1, gang: 1, station: 'warm' });
    await H('/rahul/doe', { handeling: 'korting.toekennen',
      gegevens: { rekeningId: rek.id, centen: 3000, reden: 'wachttijd goedgemaakt' },
      waarom: 'De gang stond 22 minuten over zijn serveermoment' });
    await H('/rahul/doe', { handeling: 'medewerker.beoordelen', gegevens: { wie: 'iemand' },
      waarom: 'Rahul wilde de dienst evalueren' });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/horeca-beheer.html', { waitUntil: 'load' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_sup_token', t);
    }, tok);
    await page.goto(base + '/apps/horeca-beheer.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    const lees = () => page.evaluate(() => ({
      bonnen: document.getElementById('mRahulBonnen').innerText.replace(/\s+/g, ' '),
      grens: document.getElementById('mRahulGrensUit').textContent
    }));
    let beeld = await lees();

    /* 1 + 2: allebei de bonnen staan er, met hun reden */
    assert.match(beeld.bonnen, /korting toekennen/i, 'het voorstel staat er');
    assert.match(beeld.bonnen, /wacht op een mens/, 'met wat het is');
    assert.match(beeld.bonnen, /geen kortingsgrens/i, 'en waarom het wacht');
    assert.match(beeld.bonnen, /22 minuten/, 'met de aanleiding erbij');
    assert.match(beeld.bonnen, /medewerker beoordelen/i, 'de geweigerde poging staat er ook');
    assert.match(beeld.bonnen, /geweigerd/, 'als geweigerd');
    assert.match(beeld.bonnen, /ranglijst/i, 'met de reden waarom het nooit mag');

    /* 4: de grens als tekst, niet als verzonnen getal */
    assert.match(beeld.grens, /geen kortingsgrens/i, 'zonder instelling staat er geen bedrag: ' + beeld.grens);

    /* 3: bevestigen doet het werk, en pas dan */
    const voor = (await H('/rekening', { rekeningId: rek.id })).body.rekening;
    assert.equal(voor.totalen.korting, 0, 'voor de tik staat er niets op de rekening');

    const knoppen = await page.$$('[data-bevestig]');
    assert.equal(knoppen.length, 1, 'alleen het wachtende voorstel heeft een knop, de geweigerde niet');
    await knoppen[0].click();
    await page.waitForTimeout(900);

    const na = (await H('/rekening', { rekeningId: rek.id })).body.rekening;
    assert.equal(na.totalen.korting, 3000, 'na de tik staat de korting erop');
    beeld = await lees();
    assert.match(beeld.bonnen, new RegExp('Bevestigd door ' + mgr.name.split(' ')[0]),
      'en de naam van de mens staat op de bon: ' + beeld.bonnen.slice(0, 200));
    assert.equal((await page.$$('[data-bevestig]')).length, 0, 'er valt niets meer te bevestigen');

    assert.deepEqual(fouten, [], 'geen scriptfouten op het beheerscherm');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
