/* Scherm-toets op de bank: legt een toets de weg van deze app werkelijk af?

   WAAROM JUIST DEZE APP EERST

   scripts/schermen.js telde 105 van de 188 schermen waar geen enkele toets de
   weg aflegt -- ze worden wel geopend (test/leven.e2e.js veegt er langs voor
   een teken van leven) maar verder nooit aangeraakt. Bij negen van die 105
   gaat het over geld, toegang of identiteit, en daar is "het ziet er compleet
   uit" het duurst. De bank staat bovenaan dat lijstje.

   Let op wat er WEL al getoetst was: server/routes/bank.js heeft toetsen
   (test/bank.test.js, test/bankdeuren.test.js, test/office-bank.test.js). De
   API klopt dus. Wat niemand had nagegaan is of het SCHERM doet wat het
   belooft -- precies het gat waar deze meter over gaat. Een app kan een
   correcte API hebben en toch een leeg of liegend scherm tonen.

   TWEE STANDEN, ALLEBEI GETOETST

   De ledenbank staat achter een schakelaar (`bankLedenAan`, om te zetten
   vanuit de boardroom). Standaard staat hij UIT, en dat is ook de stand
   waarin dit huis vandaag draait -- zie TAKEN.md 4.5. Een toets die alleen
   de mooie stand beproeft, toetst dus niet wat er verscheept wordt.

   1. UIT: het scherm moet eerlijk zeggen dat de bank nog niet open is, en
      juist GEEN akkoordknop en geen IBAN tonen. Dat is de belangrijkste
      bewering van de twee: een financieel scherm dat doet alsof er een
      rekening is, is erger dan een scherm dat niets doet.
   2. AAN: de hele weg. Voorwaarden, akkoord, een echte rekening, een
      storting, en het bedrag dat op het scherm verschijnt is HETZELFDE
      bedrag als in het grootboek -- 12,50 en niet 1250 en niet "een bedrag".

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, kantoorAlsPersoon } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Banklid', email: 'bk' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

/* De schakelaar omzetten gaat zoals in het echt: via de backoffice, door een
   herleidbaar persoon.

   EN HIJ MOET ALTIJD EXPLICIET WORDEN GEZET, ook op "uit". De opslag wordt
   tussen toetsen gedeeld, dus een toets die de bank live zet en hem zo laat
   staan, bepaalt wat de VOLGENDE toets ziet. Dat is hier ook echt gebeurd:
   de dichte-stand-toets ging uit van de standaard, slaagde in zijn eentje,
   en zakte zodra de twee live-toetsen ervoor hadden gedraaid. Een toets die
   afhangt van de volgorde bewijst niet wat hij beweert, dus zet elke toets
   hieronder de stand die hij nodig heeft, en zet hem daarna terug. */
async function bankZet(base, aan) {
  const kantoor = await kantoorAlsPersoon(base);
  if (!kantoor) return false;
  const r = await fetch(base + '/api/office/bank/leden', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor },
    body: JSON.stringify({ aan: aan === true }) }).then(r => r.json()).catch(() => ({}));
  return r && r.ledenAan === (aan === true);
}

async function opScherm(base, token) {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  await ctx.addInitScript(t => {
    localStorage.setItem('rtg_member_token', t);
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, token);
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  // Bank is nu een stand van RTG Geld; open meteen de echte schil. Zo toetst
  // deze suite de huidige gebruikersroute en niet de compatibiliteitsomleiding.
  await page.goto(base + '/apps/geld.html#bank', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#bkApp', { timeout: 15000 });
  return { browser, page, fouten };
}

test('bank, schakelaar UIT: het scherm zegt eerlijk dat er nog geen rekening is',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    if (!await bankZet(base, false)) assert.fail('de ledenbank kon niet dicht worden gezet; deze stand is NIET beproefd');
    const token = await nieuwLid(base);
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

    // de stand waarin dit huis vandaag draait, en dus de stand die telt
    const ov = await fetch(base + '/api/bank/overzicht', { method: 'POST', headers: H }).then(r => r.json());
    assert.equal(ov.online, false, 'de ledenbank is dicht gezet (anders toetst deze toets de verkeerde stand)');

    const s = await opScherm(base, token);
    browser = s.browser;
    const page = s.page;
    await page.waitForFunction(() => {
      const el = document.querySelector('#bkApp');
      return el && !el.textContent.includes('Laden');
    }, null, { timeout: 20000 });

    const tekst = await page.textContent('#bkApp');

    /* De kern: geen valse rekening. Geen IBAN, geen saldo, geen akkoordknop
       die iets opent wat er niet is. Zou de app die toch tonen, dan zakt dit. */
    assert.equal(await page.$('#bkAkk'), null, 'er staat GEEN akkoordknop terwijl de bank dicht is');
    assert.ok(!/NL\d{2}[A-Z]{4}/.test(tekst), 'er staat geen IBAN op het scherm, kreeg: ' + tekst.slice(0, 200));

    // en het zegt wel iets: een dicht scherm mag niet leeg zijn (dood is stiller dan stuk)
    assert.ok(tekst.trim().length > 40, 'het scherm legt uit wat er aan de hand is, kreeg: ' + JSON.stringify(tekst.slice(0, 120)));

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('bank, schakelaar AAN: van voorwaarden naar een rekening met het juiste bedrag erop',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const live = await bankZet(base, true);
    if (!live) {
      /* Geen stille overslag: zonder backoffice-persoon kan deze stand niet
         eerlijk worden beproefd, en dan hoort dat te worden gezegd. */
      assert.fail('de ledenbank kon niet live worden gezet via de backoffice; deze stand is dus NIET beproefd');
    }
    const token = await nieuwLid(base);
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

    const s = await opScherm(base, token);
    browser = s.browser;
    const page = s.page;

    // 1. eerst de voorwaarden, en nog geen IBAN
    await page.waitForSelector('#bkAkk', { timeout: 20000 });
    const voor = await page.textContent('#bkApp');
    assert.ok(!/NL\d{2}[A-Z]{4}/.test(voor), 'voor akkoord staat er nog geen IBAN op het scherm');

    await page.click('#bkAkk');
    await page.waitForSelector('.bk-rek', { timeout: 20000 });

    /* 2. Het IBAN halen we bij de SERVER en eisen we op het scherm -- niet
       andersom, want dan zou het scherm zijn eigen bewijs zijn. */
    const ov = await fetch(base + '/api/bank/overzicht', { method: 'POST', headers: H }).then(r => r.json());
    const rek = (ov.rekeningen || [])[0];
    assert.ok(rek && rek.iban, 'de server heeft na akkoord een rekening: ' + JSON.stringify(ov).slice(0, 200));
    assert.ok((await page.textContent('#bkApp')).includes(rek.iban),
      'het IBAN van de server staat op het scherm (' + rek.iban + ')');

    /* 3. Storten, en de enige vraag die er bij een bank toe doet: staat het
       BEDRAG er, en klopt het. */
    const stort = await fetch(base + '/api/bank/storten', { method: 'POST', headers: H,
      body: JSON.stringify({ iban: rek.iban, centen: 1250, route: 'ideal', oms: 'Proefstorting', idem: 'ijk-' + Date.now() }) })
      .then(r => r.json());
    assert.ok(stort && stort.error == null, 'de storting is geboekt: ' + JSON.stringify(stort).slice(0, 200));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const el = document.querySelector('#bkApp');
      return el && /12[,.]50/.test(el.textContent);
    }, null, { timeout: 20000 });

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    await bankZet(base, false).catch(() => {});   // de volgende toets begint schoon
    if (browser) await browser.close();
    child.kill();
  }
});

test('bank, schakelaar AAN: het hart toont de boeking, en meenemen geeft er echte velden van',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    if (!await bankZet(base, true)) assert.fail('de ledenbank kon niet live worden gezet; deze stand is NIET beproefd');
    const token = await nieuwLid(base);
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
    await fetch(base + '/api/bank/akkoord', { method: 'POST', headers: H });
    const ov = await fetch(base + '/api/bank/overzicht', { method: 'POST', headers: H }).then(r => r.json());
    const rek = (ov.rekeningen || [])[0];
    assert.ok(rek && rek.iban, 'er is een rekening om op te boeken: ' + JSON.stringify(ov).slice(0, 200));
    await fetch(base + '/api/bank/storten', { method: 'POST', headers: H,
      body: JSON.stringify({ iban: rek.iban, centen: 4200, route: 'ideal', oms: 'Hartproef', idem: 'ijk-h-' + Date.now() }) });

    const s = await opScherm(base, token);
    browser = s.browser;
    const page = s.page;

    await page.waitForFunction(() => {
      const el = document.querySelector('#bkHart');
      return el && el.textContent.includes('Hartproef');
    }, null, { timeout: 25000 });

    /* Meenemen: echte velden, en -- de reparatie die hier eerder nodig was --
       een datum die een datum IS. Het grootboek geeft `at` als getal; wie dat
       als tekst afknipt zet 1785764826 in de kolom datum. Diezelfde fout is
       deze week ook in werkplek.js gevonden, dus het is geen theorie. */
    await page.waitForFunction(() => window.RTGUitvoer && RTGUitvoer.beschikbaar(), null, { timeout: 15000 });
    const d = await page.evaluate(() => RTGUitvoer.gegevens());

    assert.ok(d.kolommen.includes('datum') && d.kolommen.includes('bedrag'),
      'de uitvoer heeft een datum- en een bedragkolom, kreeg: ' + d.kolommen.join(', '));

    const iDat = d.kolommen.indexOf('datum');
    const iBed = d.kolommen.indexOf('bedrag');
    const iOms = d.kolommen.indexOf('omschrijving');
    const rij = d.rijen.find(r => String(r[iOms]).includes('Hartproef'));
    assert.ok(rij, 'de eigen boeking staat erbij, kreeg: ' + JSON.stringify(d.rijen.slice(0, 3)));
    assert.match(String(rij[iDat]), /^\d{4}-\d{2}-\d{2}$/,
      'de datum is een datum en geen rauw tijdstempel, kreeg: ' + rij[iDat]);
    assert.equal(String(rij[iBed]), '42.00', 'het bedrag staat in euro, kreeg: ' + rij[iBed]);

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    await bankZet(base, false).catch(() => {});   // de volgende toets begint schoon
    if (browser) await browser.close();
    child.kill();
  }
});
