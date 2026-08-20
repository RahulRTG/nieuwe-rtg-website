/* Schermtoets voor de Aansluiting in het Belastingkantoor.

   De tegenhanger van test/btw-scherm.e2e.js: daar maakt de ondernemer zijn
   aangifte op, hier legt de inspecteur hem naast het factuurregister. De
   bewering die deze toets draagt is de reden dat beide kanten dezelfde telling
   delen (kern/fiscaal/btwtelling.js): het bedrag dat de zaak op ZIJN scherm ziet
   staat op het scherm van de inspecteur als hetzelfde getal. Wijken die twee,
   dan is een verschil geen bevinding meer maar ruis, en dan is het hele scherm
   waardeloos.

   En het tweede: over een LOPENDE periode wordt "niet aangegeven" niet als
   verwijt gepresenteerd, want indienen mag daar nog niet.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser die er ECHT is; zie laadScherm() in test/helper.js voor wat
   hier tweeendertig keer misging. */
const pw = laadScherm();
const api = async (base, pad, body, token) => (await fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) })).json();

test('Belastingkantoor: de aansluiting toont hetzelfde getal als de zaak zelf ziet',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aansl-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // de zaak factureert en maakt zijn eigen aangifte op
    const zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).token;
    assert.ok(zaak, 'de zaak is ingelogd');
    await api(base, '/api/supplier/facturen/maak',
      { omschrijving: 'Diner', aantal: 1, bedrag: 218, koperNaam: 'Gast' }, zaak);
    const nu = new Date();
    const periode = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);
    const eigen = await api(base, '/api/supplier/btw/opmaken', { periode }, zaak);
    assert.ok(eigen.aangifte, 'de zaak heeft een aangifte opgemaakt');
    const eigenBtw = eigen.aangifte.verschuldigdCenten;
    assert.ok(eigenBtw > 0, 'er zit btw in');

    // de inspecteur logt in op zijn eigen naam en pincode
    const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
    const man = roster.staff.find(m => m.role === 'manager');
    const rijk = (await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' })).token;
    assert.ok(rijk, 'de inspecteur is ingelogd');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => { localStorage.setItem('rtg_werk_rijk', t); }, rijk);
    await page.goto(base + '/apps/belastingkantoor.html', { waitUntil: 'load' });
    await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });

    await page.click('.tab[data-t="aansl"]');
    await page.waitForSelector('#aanslLijst .item', { timeout: 15000 });
    /* Het kantoor opent op de laatst AFGESLOTEN periode en niet op de lopende:
       anders staat er elke dag een scherm vol zaken die nog niet hoefden. */
    const opent = await page.inputValue('#aanslPer');
    assert.match(opent, /^\d{4}K[1-4]$/, 'het opent op een kwartaal');
    assert.notEqual(opent, periode, 'en niet op het lopende kwartaal');

    // nu het lopende kwartaal, waar de factuur van zojuist in zit
    await page.fill('#aanslPer', periode);
    await page.click('#aanslGa');
    await page.waitForFunction(p => document.querySelector('#aanslLijst').textContent.includes('Aansluiting ' + p) &&
      document.querySelector('#aanslPer').value === p &&
      !document.querySelector('#aanslLijst').hasAttribute('aria-busy'), periode, { timeout: 15000 });
    const tekst = (await page.$eval('#aanslLijst', e => e.textContent)).replace(/\s+/g, ' ');

    /* DE BEWERING WAAR HET OM DRAAIT. Het bedrag op het inspecteursscherm is het
       bedrag uit de aangifte van de zaak -- op de cent, en dus ook in de opmaak
       waarin dit scherm euro's schrijft. */
    const alsEuro = '€ ' + (eigenBtw / 100).toLocaleString('nl-NL');
    assert.ok(tekst.includes('gefactureerde btw ' + alsEuro),
      'het scherm toont ' + alsEuro + ' als gefactureerde btw; er stond: ' + tekst.slice(0, 400));
    assert.match(tekst, /alleen concept/, 'een concept telt niet als aangifte');
    assert.match(tekst, /Deze periode loopt nog/, 'en over een lopende periode is dat geen verwijt');
    assert.match(tekst, /1 factuur\b/, 'een factuur is geen "1 facturen"');

    /* De naheffingen-tab. Wat hier te bewijzen valt op een server waar alle
       facturen van vandaag zijn: het tabblad tekent zich, het formulier staat er,
       en de WEIGERING van de server komt er letterlijk uit in plaats van dat het
       scherm er iets vriendelijkers van maakt. Over een lopend kwartaal valt
       niets na te heffen, en dat is precies wat er moet komen te staan.

       Het opleggen zelf staat in test/btw-naheffing.test.js: dat vraagt een
       AFGESLOTEN tijdvak, en dat is via deze weg niet te maken. */
    await page.click('.tab[data-t="nh"]');
    await page.waitForFunction(() => /Geen naheffingen/.test(document.querySelector('#nhLijst').textContent),
      null, { timeout: 15000 });
    assert.match(await page.$eval('#nhLijst', e => e.textContent), /Geen naheffingen/);

    await page.fill('#nhPer', periode);
    await page.fill('#nhCode', eigen.aangifte.code);
    await page.click('#nhMaak');
    await page.waitForFunction(() => /periode/.test(document.querySelector('#melding').textContent),
      null, { timeout: 15000 });
    assert.match(await page.$eval('#melding', e => e.textContent), /loopt de periode nog/,
      'de weigering van de server staat er letterlijk');
    assert.match(await page.$eval('#nhLijst', e => e.textContent), /Geen naheffingen/,
      'en er is niets ontstaan');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
