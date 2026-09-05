/* DE SERVICE-COCKPIT.

   Wat deze toetsen vastleggen is niet dat het scherm laadt, maar wat het WEL en
   NIET doet:

   1. Er is geen zoekbalk waarmee je elk lid kunt opzoeken. Je komt binnen via de
      wachtrij en opent een ZAAK -- dat onderscheid met de ledenbalie (vrije
      inzage, met een reden en een journaalregel) is de reden dat deze laag
      bestaat.
   2. Alles wat het bord beweert, draagt een waarom: de prioriteit toont haar
      opbouw EN wat er niet gewogen is, de routering haar reden.
   3. Een klok die niet gemeten is, zegt dat -- er staat geen streepje en geen nul.
   4. Het bord stelt geen oorzaak vast. Er is geen onderzoekende AI, en dat staat
      er met zoveel woorden bij in plaats van dat er een gok wordt getoond.

   Draait alleen waar Playwright met een passende browser staat; anders
   overgeslagen. Draai: npm run e2e */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, kantoorAlsPersoon } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadScherm();

async function api(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  return r.json();
}

async function metCockpit(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cockpit-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const lid = await api(base, '/api/auth/register', { name: 'Cockpit Lid',
      email: 'cockpit' + process.pid + '@x.nl', phone: '0612345777',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    const balie = await kantoorAlsPersoon(base);
    assert.ok(balie, 'geen kantoorzetel');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, balie);
    const page = await ctx.newPage();
    await fn(page, base, lid.token, balie);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

test('de wachtrij toont de zaak, en het bord heeft geen ledenzoeker', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base, lidToken) => {
    await api(base, '/api/service/open', { onderwerp: 'betaling', titel: 'Mijn uitbetaling ontbreekt',
      impact: 'zwaar', geld: 'flink', betrokken: { soort: 'betaling', code: 'PAY-829192' } }, lidToken);
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr[data-id]', { timeout: 20000 });

    const rij = await page.textContent('tbody tr[data-id]');
    assert.match(rij, /SUP-/, 'de wachtrij toont geen zaaknummer');
    assert.match(rij, /P2/, 'de berekende prioriteit staat er niet: ' + rij);

    /* GEEN LEDENZOEKER. Elk invoerveld op dit scherm hoort bij een HANDELING op
       een zaak; er is er geen waarmee je door het ledenbestand bladert. */
    const velden = await page.$$eval('input, select', els => els.map(e => (e.placeholder || e.id || '')));
    assert.equal(velden.filter(v => /codenaam|lid|zoek/i.test(v)).length, 0,
      'er staat een ledenzoeker op de cockpit: ' + JSON.stringify(velden));
  });
});

test('elke bewering op het bord draagt een waarom', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base, lidToken) => {
    await api(base, '/api/service/open', { onderwerp: 'betaling', titel: 'Mijn uitbetaling ontbreekt',
      impact: 'zwaar', geld: 'flink' }, lidToken);
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr[data-id]', { timeout: 20000 });
    await page.click('tbody tr[data-id]');
    await page.waitForSelector('details.waarom', { timeout: 20000 });

    const waarom = await page.textContent('details.waarom');
    assert.match(waarom, /routering/i, 'de routering legt zich niet uit');
    assert.match(waarom, /impact/, 'de opbouw van de prioriteit staat er niet');
    /* HET BELANGRIJKSTE VELD. Een zaak die laag uitkomt omdat niemand de omvang
       inschatte, is iets anders dan een zaak die aantoonbaar klein is. */
    assert.match(waarom, /niet gewogen/i, 'wat er NIET is gewogen staat er niet bij');
    /* EN HET BORD GOKT NIET. */
    assert.match(waarom, /geen oorzaak vast|geen onderzoekende AI/i,
      'het bord doet alsof het weet wat er mis is');
  });
});

test('een klok die niet gemeten is, zegt dat in plaats van nul', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base, lidToken) => {
    await api(base, '/api/service/open', { onderwerp: 'app', titel: 'Het scherm blijft leeg' }, lidToken);
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr[data-id]', { timeout: 20000 });
    await page.click('tbody tr[data-id]');
    await page.waitForSelector('dl.feiten', { timeout: 20000 });

    const feiten = await page.textContent('dl.feiten');
    assert.match(feiten, /niet gemeten/, 'een ongemeten klok toont een getal of een streepje: ' + feiten);
    assert.doesNotMatch(feiten.split('hersteltijd')[1] || '', /^\s*0 min/,
      'de hersteltijd staat op 0 terwijl er niets is hersteld');
  });
});

test('het werkblad verschijnt ook als de gedeelde schil de kop heeft verbouwd', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base, lidToken) => {
    await api(base, '/api/service/open', { onderwerp: 'app', titel: 'Het scherm blijft leeg' }, lidToken);
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr[data-id]', { timeout: 20000 });

    /* DIT IS GEEN KUNSTGREEP MAAR EEN NAGESPEELDE WERKELIJKHEID. shared/basis.js
       en shared/bediening.js laden met defer en verbouwen de header; #titel was
       daardoor soms al weg op het moment dat er werd geklikt. Omdat het scherm
       DAAR als eerste in schreef, sloeg de TypeError toe voordat het werkblad
       was gevuld: een dode klik zonder foutmelding, die zich als een willekeurige
       flake voordeed. De inhoud van een bord mag nooit afhangen van een
       sierlijkheid in de kop. */
    await page.evaluate(() => { const t = document.querySelector('#titel'); if (t) t.remove(); });
    await page.click('tbody tr[data-id]');
    await page.waitForSelector('dl.feiten', { timeout: 20000 });
    assert.match(await page.textContent('#main'), /SUP-/, 'het werkblad bleef leeg toen de kop weg was');
  });
});

test('het kwaliteitsbord zegt even groot wat het NIET meet', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base, lidToken) => {
    await api(base, '/api/service/open', { onderwerp: 'app', titel: 'Het scherm blijft leeg' }, lidToken);
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tKwaliteit', { timeout: 20000 });
    await page.click('#tKwaliteit');
    await page.waitForFunction(() => /Zonder opnieuw uitleggen/.test(document.body.textContent), null, { timeout: 20000 });

    const tekst = await page.textContent('#main');
    /* Met een handvol zaken hoort er GEEN percentage te staan maar een reden.
       Een callcenterbord zou hier 0% of 100% tonen, en allebei zijn onwaar. */
    assert.match(tekst, /niet te zeggen/i, 'er staat een verhouding over een handvol zaken');
    /* En wat er niet gemeten is, staat er even groot bij -- anders vult een
       medewerker het gat met zijn eigen indruk, en gaat DIE rondzingen. */
    assert.match(tekst, /Wat hier NIET staat/i, 'het bord verzwijgt wat het niet meet');
    assert.match(tekst, /tevredenheid/i, 'de afwezigheid van een tevredenheidscijfer is niet uitgelegd');
    assert.match(tekst, /ranglijst op mensen/i, 'de afwezigheid van afhandeltijd per medewerker is niet uitgelegd');
  });
});

test('een medewerker vraagt toegang en opent niets uit zichzelf', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base, lidToken, balie) => {
    await api(base, '/api/service/open', { onderwerp: 'zaak', titel: 'Mijn werkruimte reageert niet' }, lidToken);
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr[data-id]', { timeout: 20000 });
    await page.click('tbody tr[data-id]');
    await page.waitForSelector('#hVraag', { timeout: 20000 });

    /* De keuzelijst toont alleen wat het TEAM nodig heeft -- geen vrij tekstveld,
       want dan vraagt iemand iets dat het team niet mag en krijgt hij een
       weigering waar hij niets aan heeft. */
    const caps = await page.$$eval('#hCap option', els => els.map(e => e.textContent));
    assert.deepEqual(caps, ['organisatie.stand'],
      'de UI toont meer dan de enige capability met een echte lezer: ' + caps);

    await page.fill('#hDoel', 'de operationele werkruimte reageert sinds gisteren niet');
    await page.click('#hVraag');
    await page.waitForFunction(() => /Het lid ziet het in zijn app/.test(document.body.textContent), null, { timeout: 20000 });

    /* En er is nog NIETS open: een bevestiging is geen machtiging. */
    const mijne = await api(base, '/api/office/service/machtigingen', {}, balie);
    assert.equal(mijne.machtigingen.length, 0,
      'er ging iets open zonder dat het lid had bevestigd');
  });
});

/* DE AI VRAAGT LANGS DEZELFDE KNOP, EN HET LID ZIET DAT HET GEEN MENS IS.
   Twee dingen die alleen in de browser te zien zijn: dat de cockpit de AI kan
   inzetten zonder zelf iets te openen, en dat de hulp-la van het lid "RTG AI"
   toont in plaats van de technische sleutel `ai:onderzoeker`. */
test('de AI vraagt het lid om toegang, en opent niets uit zichzelf', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base, lidToken, balie) => {
    await api(base, '/api/service/open', { onderwerp: 'zaak', titel: 'Mijn werkruimte reageert niet' }, lidToken);
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr[data-id]', { timeout: 20000 });
    await page.click('tbody tr[data-id]');
    await page.waitForSelector('#aiVraag', { timeout: 20000 });

    await page.fill('#aiReden', 'uitzoeken waar de operationele werkruimte vastloopt');
    await page.click('#aiVraag');
    await page.waitForFunction(() => /Het lid beslist/.test(document.body.textContent), null, { timeout: 20000 });

    /* Er ging niets open: een verzoek is geen machtiging, ook niet voor een AI. */
    const mijne = await api(base, '/api/office/service/machtigingen', {}, balie);
    assert.equal(mijne.machtigingen.length, 0, 'de AI kreeg toegang zonder dat het lid bevestigde');

    /* En wat het LID leest is een naam en een waarschuwing, geen sleutel. */
    const verzoeken = await api(base, '/api/service/bevestigingen', {}, lidToken);
    assert.equal(verzoeken.verzoeken.length, 1, JSON.stringify(verzoeken).slice(0, 200));
    assert.equal(verzoeken.verzoeken[0].machine, true, 'het lid kan niet zien dat er een machine vraagt');
  });
});

/* HET KANALENBORD ZEGT WAT ER NIET IS VASTGESTELD.

   Twee ingangen van deze laag hangen aan inrichting en falen stil op de goede
   manier. Dit bord maakt dat zichtbaar -- maar de verleiding is dan om "in orde"
   te schrijven omdat de code klopt, en dat is je eigen bestand meten in plaats
   van de werkelijkheid. Deze toets houdt vast dat het bord dat NIET doet: bij de
   post staat er even groot bij dat DNS en de provider buiten beeld blijven. */
test('het kanalenbord zegt even groot wat het niet kan vaststellen', { skip: geenBrowser(pw) }, async () => {
  await metCockpit(async (page, base) => {
    await page.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tKanalen', { timeout: 20000 });
    await page.click('#tKanalen');
    await page.waitForFunction(() => /Waar een melding binnenkomt/.test(document.body.textContent), null, { timeout: 20000 });
    const tekst = await page.evaluate(() => document.body.textContent);

    /* OP DE RIJ EN NIET OP DE PAGINA. De inleidende zin van dit bord noemt DNS
       ook, dus een `match` op de hele body slaagde ook toen de rij zijn lijst
       kwijt was -- de toets mat de kop in plaats van wat hij beweert te toetsen.
       Gevonden door de rij met opzet stuk te maken en te zien dat er niets zakte. */
    const items = await page.$$eval('.waarom li', els => els.map(e => e.textContent));
    assert.ok(items.some(t => /niet over zichzelf vaststellen/i.test(t)),
      'de mailingang doet alsof hij weet of er post aankomt: ' + JSON.stringify(items));
    /* En zonder spraakmodel staat het GEVOLG erbij in gewone woorden. Zonder die
       zin leest een rode regel als een ontbrekend extraatje in plaats van als
       een uitsluiting. */
    assert.match(tekst, /meetypen/i, 'het gevolg van geen ondertiteling staat er niet bij');
  });
});
