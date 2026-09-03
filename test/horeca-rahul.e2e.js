/* HET BEHEERSCHERM: de actiebonnen van Rahul en de meetlat van de dienst.

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
   5. DE MEETLAT TOONT WAT NIET GEMETEN IS ALS NIET GEMETEN. Twaalf regels, en
      wat er geen bron voor heeft krijgt geen nul maar een streepje met een
      reden. Een nul die uit het ontbreken van gegevens komt, is geen resultaat
      maar een lege avond -- en dat is precies de fout die een meetlat
      waardeloos maakt.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpVerandering, wachtOpZichtbaar } = require('./helper');
const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahulscherm-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de manager ziet wat Rahul deed en wat wacht, en bevestigt met zijn naam erbij',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const tok = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const H = (pad, body) => post(base, pad, body, tok);

    const rek = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'RB-1', gasten: 2 })).body.rekening;
    await H('/api/supplier/horeca/rekening/regel', { rekeningId: rek.id, naam: 'Menu', prijs: 120, aantal: 1, gang: 1, station: 'warm' });
    await H('/api/supplier/horeca/rahul/doe', { handeling: 'korting.toekennen',
      gegevens: { rekeningId: rek.id, centen: 3000, reden: 'wachttijd goedgemaakt' },
      waarom: 'De gang stond 22 minuten over zijn serveermoment' });
    await H('/api/supplier/horeca/rahul/doe', { handeling: 'medewerker.beoordelen', gegevens: { wie: 'iemand' },
      waarom: 'Rahul wilde de dienst evalueren' });

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/horeca-beheer.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_sup_token', t);
    }, tok);
    await page.goto(base + '/apps/horeca-beheer.html', { waitUntil: 'domcontentloaded' });
    /* De kaart tekent zich in TWEE stappen, en lees() hieronder leest ze allebei:
       /rahul/bonnen zet de bonnenlijst neer, en pas dáárna vult /rahul/register de
       zin over de grens. Wachten op alleen de bonnen treft die zin dus nog leeg
       aan -- vandaar allebei. Twee items = het wachtende voorstel en de weigering. */
    await wachtTot(page, () => document.querySelectorAll('#mRahulBonnen .item').length >= 2,
      null, { wat: 'de twee actiebonnen van Rahul (het voorstel en de weigering)' });
    await wachtOpVerandering(page, '#mRahulGrensUit', '');

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
    const voor = (await H('/api/supplier/horeca/rekening', { rekeningId: rek.id })).body.rekening;
    assert.equal(voor.totalen.korting, 0, 'voor de tik staat er niets op de rekening');

    const knoppen = await page.$$('[data-bevestig]');
    assert.equal(knoppen.length, 1, 'alleen het wachtende voorstel heeft een knop, de geweigerde niet');
    await knoppen[0].click();
    /* De knop verdwijnt pas als het scherm zich HERTEKENT met de verse bonnen, en
       dat gebeurt na het antwoord op /rahul/bevestig: de stand is dan geen 'wacht'
       meer, dus rendert bon() er geen knop meer bij. Zijn verdwijning is dus het
       teken dat de server het werk deed én dat het scherm het toont -- precies wat
       de drie beweringen hieronder nodig hebben. Vlak na de klik staat hij er nog,
       dus dit valt niet meteen door. */
    await wachtOpZichtbaar(page, '[data-bevestig]', { weg: true });

    const na = (await H('/api/supplier/horeca/rekening', { rekeningId: rek.id })).body.rekening;
    assert.equal(na.totalen.korting, 3000, 'na de tik staat de korting erop');
    beeld = await lees();
    assert.match(beeld.bonnen, new RegExp('Bevestigd door ' + mgr.name.split(' ')[0]),
      'en de naam van de mens staat op de bon: ' + beeld.bonnen.slice(0, 200));
    assert.equal((await page.$$('[data-bevestig]')).length, 0, 'er valt niets meer te bevestigen');

    /* ---- 5. de meetlat ---- */
    /* De meetlat haalt zijn eigen /dienstmeting op en stond onder dezelfde vaste
       wachttijd als de bonnen hierboven; nu die weg is, wacht hij op zijn eigen
       teken. Dat is een REGEL in de lijst en niet de kop erboven: die kop staat er
       met een streepje al vóór de meting binnen is. */
    await wachtTot(page, () => document.querySelectorAll('#mMeetlat .item').length > 0,
      null, { wat: 'de regels van de meetlat' });
    const meet = await page.evaluate(() => ({
      telling: document.getElementById('mMeetTelling').textContent,
      lat: document.getElementById('mMeetlat').innerText.replace(/\s+/g, ' ')
    }));
    assert.match(meet.telling, /gemeten/, 'de kop telt de soorten: ' + meet.telling);
    assert.match(meet.telling, /niet gemeten/, 'inclusief wat er niet gemeten is');

    assert.match(meet.lat, /spreiding tussen gerechten van dezelfde gang/,
      'de regels van HORECA.md staan er woordelijk');
    assert.match(meet.lat, /geen spreiding van nul/i,
      'en een lege avond krijgt geen nul maar een reden: ' + meet.lat.slice(0, 200));

    /* EN ER STAAT WERKELIJK GEEN GETAL. De reden alleen is niet genoeg: een
       scherm dat de uitleg toont en er tóch een nul naast zet, liegt met een
       voetnoot. Dus wordt de waardekolom van die regel apart nagekeken. */
    const zonderGetal = await page.evaluate(() => {
      const rij = [...document.querySelectorAll('#mMeetlat .item')]
        .find(el => el.innerText.indexOf('spreiding tussen gerechten') >= 0);
      if (!rij) return null;
      const cellen = rij.querySelectorAll(':scope > span');
      return cellen[cellen.length - 1].textContent.trim();
    });
    assert.ok(zonderGetal !== null, 'de regel staat op het scherm');
    assert.doesNotMatch(zonderGetal, /\d/,
      'de waardekolom van een niet-gemeten regel draagt geen getal, maar: "' + zonderGetal + '"');
    assert.match(meet.lat, /uit het model/,
      'een nul die uit het ontwerp komt, staat als zodanig');
    assert.match(meet.lat, /ranglijst/,
      'en de reden waarom bedieningshandelingen niet geteld worden, is een besluit');

    /* GEEN SAMENVATTEND CIJFER. "9 van de 12 groen" telt dingen op die niet in
       dezelfde eenheid staan, en verbergt dat er acht helemaal niet gemeten
       worden. */
    assert.doesNotMatch(meet.telling, /%|score|van de 12/i,
      'er staat geen samenvattend cijfer: ' + meet.telling);

    assert.deepEqual(fouten, [], 'geen scriptfouten op het beheerscherm');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
