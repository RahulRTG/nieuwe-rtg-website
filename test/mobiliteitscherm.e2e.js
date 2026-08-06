/* Scherm-toets op het Mobility OS: leggen de twee schermen de weg werkelijk af?

   WAAROM DEZE TOETS BESTAAT

   test/mobiliteit.test.js bewijst dat de API klopt. Dat is precies wat het
   bewijst en niets meer -- niet dat de reizigersapp ook maar een regel JS
   uitvoert, en niet dat de dispatcher ooit een knop ziet. Dat gat heeft in dit
   huis al twee keer maandenlang opengestaan met alles op groen (zie
   test/blindevlek.test.js), en scripts/schermen.js telt precies de schermen
   waar geen enkele toets meer doet dan even langslopen. Twee nieuwe schermen
   toevoegen zonder deze toets zou die meter de verkeerde kant op duwen.

   WAT ER WORDT AFGELEGD, EN WAAROM JUIST DAT

   1. De REIZIGER boekt echt: bestemming kiezen uit onze eigen zaken, aanvragen,
      en daarna staat de lopende rit op het scherm. Dat laatste is de bewering
      die telt -- een app die de aanvraag wegstuurt en daarna niets toont, laat
      een mens op straat staan zonder te weten of er iets gebeurt.
   2. De DISPATCHER ziet die rit, met de REKENSOM van de matcher eronder. Dat is
      geen versiering: staat de uitleg er niet, dan gaat een planner handmatig
      toewijzen en is de motor een dure decoratie. Deze toets rekent daarom af
      op de factornamen in beeld, niet alleen op "er staat iets".
   3. Een afgewezen voertuig staat er MET zijn reden. Een lege kandidatenlijst
      zonder uitleg leest als een storing.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };

async function post(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(r => r.json()).catch(() => ({}));
}

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await post(base, '/api/auth/register', { name: 'Reiziger', email: 'mb' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim123', geboortedatum: '1990-01-01',
    geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

async function zaakToken(base) {
  const roster = await post(base, '/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.staff || []).find(x => x.role === 'manager');
  assert.ok(m, 'de taxizaak heeft een manager');
  const login = await post(base, '/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' });
  assert.ok(login.token, 'de manager logt in');
  return login.token;
}

async function open(base, url, sleutel, token) {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([s, t]) => {
    localStorage.setItem(s, t);
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, [sleutel, token]);
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  return { browser, page, fouten };
}

test('de reizigersapp boekt echt een rit, en toont hem daarna',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const s = await open(base, '/apps/ov.html', 'rtg_member_token', token);
    browser = s.browser;
    const page = s.page;

    // de bestemmingen komen uit RTG zelf; de app vult ze bij het openen
    await page.waitForFunction(() => document.querySelector('#velNaar').options.length > 1,
      null, { timeout: 20000 });
    const opties = await page.$$eval('#velNaar option', els => els.map(e => e.textContent));
    assert.ok(opties.some(o => /restaurant|hotel|koffie|bar/i.test(o)),
      'de bestemmingslijst bevat onze eigen zaken, kreeg: ' + opties.slice(0, 5).join(' | '));

    // een echte zaak kiezen en aanvragen
    const zaakOptie = await page.$$eval('#velNaar option', els =>
      (els.find(e => e.value.startsWith('zaak:')) || {}).value || '');
    assert.ok(zaakOptie, 'er staat een RTG-zaak in de lijst');
    await page.selectOption('#velNaar', zaakOptie);
    await page.click('#velBoek');

    /* De bewering die telt: na het aanvragen VERDWIJNT het formulier en staat de
       lopende rit in beeld, met de keten eronder. Een app die de aanvraag
       wegstuurt en daarna hetzelfde formulier toont, laat iemand tweemaal
       boeken zonder het te weten. */
    await page.waitForFunction(() => {
      const k = document.querySelector('#lopendKaart');
      return k && !k.classList.contains('weg');
    }, null, { timeout: 20000 });
    assert.ok(await page.$eval('#boekBlok', el => el.classList.contains('weg')),
      'het boekformulier is weg zodra er een rit loopt');
    const sub = await page.textContent('#lopendSub');
    assert.match(sub, /km/, 'de lopende rit toont de afstand, kreeg: ' + sub);
    assert.match(sub, /€/, 'en het bedrag');
    const ketenAf = await page.$$eval('#lopendKeten span.af', els => els.length);
    assert.ok(ketenAf >= 1, 'de statusketen staat op minstens een stap');

    // en de server is het ermee eens: er staat echt een opdracht op dit lid
    const mijn = await post(base, '/api/mob/mijn', {}, token);
    assert.ok(mijn.lopend && mijn.lopend.ref, 'de server kent de lopende rit ook');

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('het dispatchscherm toont de openstaande rit met de rekensom van de matcher',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const lid = await nieuwLid(base);
    const zaak = await zaakToken(base);

    // een wagen die mag rijden, en een die dat niet mag: allebei moeten ze in beeld
    const goed = await post(base, '/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen A',
      loc: { lat: 38.909, lng: 1.433 }, energieNiveau: 80, bestuurder: 'chauffeur-a',
      papieren: PAPIEREN_OK }, zaak);
    assert.equal(goed.asset && goed.asset.inzetbaar, true, 'Wagen A mag rijden');
    const fout = await post(base, '/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen B',
      loc: { lat: 38.9091, lng: 1.4331 }, energieNiveau: 90, bestuurder: 'chauffeur-b',
      papieren: Object.assign({}, PAPIEREN_OK, { taxivergunning: '2020-01-01' }) }, zaak);
    assert.equal(fout.asset && fout.asset.inzetbaar, false, 'Wagen B heeft een verlopen vergunning');

    const rit = await post(base, '/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
      van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lid);
    assert.ok(rit.opdracht, 'de rit staat klaar: ' + JSON.stringify(rit).slice(0, 160));

    const s = await open(base, '/apps/dispatch.html', 'rtg_pda_token', zaak);
    browser = s.browser;
    const page = s.page;

    await page.waitForFunction(() => {
      const b = document.querySelector('#vBord');
      return b && !b.classList.contains('weg') && document.querySelectorAll('#lijstOpen .rij').length > 0;
    }, null, { timeout: 20000 });

    const open1 = await page.textContent('#lijstOpen');
    assert.match(open1, new RegExp(rit.opdracht.ref), 'de openstaande rit staat op het bord');

    /* De rekensom. Hier rekent deze toets bewust af op de FACTORNAMEN en niet op
       "er staat iets": een balkje zonder uitleg is precies het scherm dat een
       planner doet terugvallen op handmatig toewijzen. */
    await page.waitForFunction(() => document.querySelectorAll('#lijstOpen .balk').length > 0,
      null, { timeout: 20000 });
    const balken = await page.$$eval('#lijstOpen .balk', els => els.map(e => e.textContent));
    for (const factor of ['nabijheid', 'aankomsttijd', 'eerlijk'])
      assert.ok(balken.some(b => b.includes(factor)), 'de factor "' + factor + '" staat met zijn uitleg in beeld');

    // en het afgewezen voertuig staat er MET reden; niet stil weggelaten
    const uitleg = await page.$$eval('#lijstOpen .uitleg', els => els.map(e => e.textContent));
    assert.ok(uitleg.some(u => /Wagen B/.test(u) && /vergunning/.test(u)),
      'de afgewezen wagen staat erbij met zijn reden, kreeg: ' + uitleg.join(' | '));

    // de vloot toont beide wagens, met hun stand
    const vloot = await page.textContent('#lijstVloot');
    assert.match(vloot, /Wagen A/);
    assert.match(vloot, /Wagen B/);

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
