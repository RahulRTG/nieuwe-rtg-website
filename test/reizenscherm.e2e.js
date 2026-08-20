/* Scherm-toets op DE REIS in /apps/reizen.html (REIZEN.md fase 1).

   WAAROM DIT BESTAND ER IS. De groepering wordt op de server bewezen
   (test/reizen.test.js). Wat een pure toets niet kan zien is de fout die een
   gebruiker als eerste opvalt en het langst gelooft: een KOP die iets anders
   zegt dan de regels eronder. "Ibiza - 2 onderdelen" boven een rij waarin een
   reis naar Gstaad staat, is erger dan geen groepering, want de kop leest als
   een bevestiging.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:

   1. Twee reizen krijgen twee koppen, met hun eigen bestemming.
   2. De regels onder een kop horen bij die kop -- gemeten, niet aangenomen.
   3. De teller bovenaan telt REIZEN en geen regels. Dat is precies wat er
      eerder misging: een verblijf en een reisaanvraag naar dezelfde plaats
      lazen als "2 reizen gepland" terwijl het er een is. Deze opstelling maakt
      dat verschil zichtbaar: drie boekingen, twee reizen.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser, laadPlaywright } = require('./helper');

const pw = laadPlaywright();
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

test('het reisscherm groepeert per reis, en de kop zegt hetzelfde als de regels eronder',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reizenscherm-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const reg = await post('/api/auth/register', { name: 'Reiziger', email: 'rs' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    const lid = reg.body.token;
    assert.ok(lid, 'het lid staat ingeschreven');

    /* DRIE ECHTE BOEKINGEN DIE TWEE REIZEN HOREN TE WORDEN: een samengestelde
       reis naar Ibiza en een verblijf in dezelfde plaats in hetzelfde venster
       (samen een reis, uit twee herkomsten), plus een reis naar een andere
       bestemming (de tweede). Alles via de gewone routes -- de groepering moet
       op ECHTE gegevens werken en niet alleen op nagebootste. */
    const cat = await post('/api/reisbureau', {}, lid);
    const ibiza = cat.body.reizen.find(r => /ibiza/i.test(r.bestemming));
    const ander = cat.body.reizen.find(r => !/ibiza/i.test(r.bestemming));
    assert.ok(ibiza && ander, 'de catalogus heeft Ibiza en nog een bestemming');
    assert.equal((await post('/api/reisbureau/boek', { tripId: ibiza.id, personen: 2, vertrek: dag(30) }, lid)).status, 200);
    assert.equal((await post('/api/reisbureau/boek', { tripId: ander.id, personen: 2, vertrek: dag(90) }, lid)).status, 200);

    const hotels = await post('/api/hotels', {}, lid);
    const huis = hotels.body.huizen.find(h => /ibiza/i.test(h.stad || ''));
    assert.ok(huis, 'er is een verblijf in Ibiza om bij die reis te horen');
    const vb = await post('/api/verblijf', { supplierCode: huis.code, roomId: huis.kamers[0].id,
      aankomst: dag(30), vertrek: dag(34), personen: 2 }, lid);
    assert.equal(vb.status, 200);

    // wat de server ervan maakt, vóór het scherm: twee reizen, drie onderdelen
    const api = (await post('/api/reis/reizen', {}, lid)).body;
    assert.equal(api.reizen.length, 2, 'de server maakt er twee reizen van');
    const ibizaReis = api.reizen.find(r => /ibiza/i.test(r.bestemming));
    assert.equal(ibizaReis.telling.onderdelen, 2, 'de Ibiza-reis heeft twee onderdelen');
    assert.deepEqual(ibizaReis.herkomsten.sort(), ['partner', 'rtg'], 'uit twee herkomsten');

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, lid);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/reizen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const el = document.querySelector('#komend');
      return el && !/Laden/.test(el.textContent) && el.querySelector('.regkop');
    }, null, { timeout: 20000 });

    /* De koppen MET hun regels, uit de opmaak zelf: alles tussen deze kop en de
       volgende. Zo wordt gemeten wat er werkelijk onder een kop hangt, in
       plaats van dat twee losse tellingen naast elkaar worden gelegd. */
    const blokken = await page.$$eval('#komend > *', (nodes) => {
      const uit = [];
      for (const n of nodes) {
        if (n.classList.contains('regkop')) uit.push({ kop: n.innerText.replace(/\s+/g, ' ').trim(), regels: [] });
        else if (uit.length && n.classList.contains('reis')) uit[uit.length - 1].regels.push(n.innerText.replace(/\s+/g, ' ').trim());
      }
      return uit;
    });

    await t.test('twee reizen, twee koppen, elk met hun eigen bestemming', () => {
      assert.equal(blokken.length, 2, 'twee koppen: ' + JSON.stringify(blokken.map(b => b.kop)));
      assert.ok(blokken.some(b => /Ibiza/i.test(b.kop)), 'er is een kop voor Ibiza');
      assert.ok(blokken.some(b => new RegExp(ander.bestemming, 'i').test(b.kop)),
        'en een voor ' + ander.bestemming);
    });

    await t.test('de regels onder een kop horen bij die kop', () => {
      const ib = blokken.find(b => /Ibiza/i.test(b.kop));
      assert.equal(ib.regels.length, 2, 'twee regels onder Ibiza: ' + JSON.stringify(ib.regels));
      for (const r of ib.regels) assert.match(r, /Ibiza/i, 'elke regel eronder gaat over Ibiza: ' + r);
      /* Hoofdletterongevoelig: de kop staat in kleinkapitalen via CSS, en
         innerText geeft dat zo terug. Waar het om gaat is het getal. */
      assert.match(ib.kop, /2 onderdelen/i, 'en de kop telt ze: ' + ib.kop);
      const rest = blokken.find(b => !/Ibiza/i.test(b.kop));
      assert.equal(rest.regels.length, 1);
      assert.match(rest.regels[0], new RegExp(ander.bestemming, 'i'));
    });

    await t.test('de teller bovenaan telt reizen en geen regels', async () => {
      const stand = await page.$eval('#stand', el => el.innerText.replace(/\s+/g, ' '));
      assert.match(stand, /2 reizen gepland/i,
        'drie boekingen zijn twee reizen; de stand hoort dat te zeggen: ' + stand);
      const tel = await page.$eval('#tel', el => el.innerText.trim().toLowerCase());
      assert.equal(tel, '2 reizen');
    });

    assert.deepEqual(fouten, [], 'geen scriptfouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
