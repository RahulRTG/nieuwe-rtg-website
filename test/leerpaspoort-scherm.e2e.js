/* HET LEERPASPOORT IN EEN ECHTE BROWSER: de leerlijn van een leerlingprofiel.

   test/rtfleerlingtoegang.test.js bewijst dat /api/rtf/leerling/* de ladder
   op leeftijd snijdt. Dat zegt niets over het SCHERM: of de fasekiezer ook
   werkelijk alleen die fasen toont, of inschrijven via de knop het paspoort
   bijwerkt, of een oefenvraag van de server op het scherm landt en door de
   server wordt nagekeken. scripts/schermen.js eist een toets die deze weg
   zelf aflegt; dit is die toets.

   DE SESSIE. Het scherm draagt RTG School (/apps/rtgschool/leer.js, examen.js,
   bijles.js) maar praat niet met /api/onderwijs (dat is de ledendeur): elk pad
   wordt in leerpaspoort.html vertaald naar /api/rtf/leerling/*, achter de
   gezinscode en het PROFIELTOKEN uit `rtf_sessie`. Een kindprofiel met een
   geboortedatum dus (gezin aanmaken, kind toevoegen, profiel kiezen met zijn
   pincode; zelfde weg als scripts/a11y.js). Twee kinderen, omdat de grens
   tussen hen loopt: Milan is 11 (groep kind, alleen basisschool) en Sam is 14
   (tiener, basisschool en voortgezet onderwijs).

   WAT ER WORDT VASTGELEGD, EN WAAROM JUIST DAT

   1. DE WEIGERING MET REDEN. De beheerder (een volwassene met geboortedatum)
      komt door de toegangsdeur -- het scherm is voor hem niet verboden -- maar
      het paspoort zelf hoort bij een LEERLINGPROFIEL: de server zegt dat, het
      scherm toont die zin in de melding en laat de fasekiezer leeg. Een ouder
      krijgt niet stilletjes het paspoort van een kind.
   2. DE LADDER OP LEEFTIJD, IN DE KIEZER. Milan (11) ziet in #ladderKies de
      groepen van de basisschool en geen havo of universiteit; de examenkiezer
      blijft daardoor leeg (examentraining is voor 12+). Inschrijven op groep 5
      via #inschrijfKnop gaat naar /api/rtf/leerling/inschrijf, en daarna staat
      het in het paspoort en in de kerncijfers -- ZONDER score: de kerncijfers
      tellen behaalde doelen en stappen, geen punten. "Jaar erbij" blijft weg,
      want een groep heeft geen leerjaren.
   3. WAT DE KIEZER NIET AANBIEDT, WEIGERT DE SERVER OOK. Vanaf Milans scherm
      wordt de examentraining voor havo langs de eigen api() van de pagina
      gevraagd, en de server zegt "Deze leerstof hoort nog niet bij jouw
      leeftijdspas." -- de deur zit niet alleen in de kiezer.
   4. OEFENEN IS EEN ECHTE UITKOMST. De leerlijn van groep 5 komt van de server;
      "Oefenen" haalt een verse opgave (#oefenKaart), en het antwoord wordt door
      de SERVER nagekeken: het scherm toont "Goed zo." of "Bijna: ..." en telt
      door naar 2/5. Het scherm kent het antwoord niet.
   5. DE TIENER MAG WEL. Sam (14) ziet havo op de ladder (en geen hbo of wo),
      kiest havo in de examenkiezer, en #examenStartKnop geeft een eerste vraag
      van tien.

   DE GRENS UIT CLAUDE.md, "leren is geen wedstrijd": dit scherm toont geen
   ranglijst en geen score, en dat is hier vastgelegd waar het meetbaar is (de
   kerncijfers na het inschrijven). De progressiegrens van de spellen
   (kern/spellen/grens.js) raakt dit scherm niet: een leerpaspoort bewaart
   behaalde doelen en geen prestaties, ook niet voor een volwassene.

   Wat NIET is beproefd: een leerdoel werkelijk BEHALEN (vier van vijf goed;
   de opgaven zijn vers en het scherm kent het antwoord niet, dus dat is een
   servertoets: test/leerstof.test.js), het niveau-advies en Rahul Bijles (die
   twee hangen aan een model of een demo-antwoord en beweren niets over de
   deur), en "Jaar erbij" (Milan heeft geen leerjaren; voor Sam is het niet
   meer dan een tweede inschrijfknop).

   Draai los: node --test test/leerpaspoort-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpTekst, wachtOpZichtbaar } = require('./helper');

const pw = laadPlaywright();
const OVERSLAAN = geenBrowser(pw);
const SCHERM = '/apps/foundation/leerpaspoort.html';

let child, base, browser, TMP;
let BEHEERDER, MILAN, SAM;

const post = async (pad, body) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

async function kindprofiel(gezin, naam, geboortedatum, pin) {
  const p = (await post('/api/foundation/gezin/profiel/maak', { code: gezin.code, token: gezin.token,
    naam, rol: 'kind', geboortedatum, pin })).body;
  assert.ok(p.profiel && p.profiel.id, naam + ' bestaat: ' + JSON.stringify(p).slice(0, 160));
  const kies = (await post('/api/foundation/gezin/profiel/kies',
    { code: gezin.code, profielId: p.profiel.id, pin })).body;
  assert.ok(kies.token, naam + ' kiest zijn profiel: ' + JSON.stringify(kies).slice(0, 160));
  return { code: gezin.code, token: kies.token, profiel: kies.profiel };
}

test.before(async () => {
  if (OVERSLAAN) return;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerpaspoort-scherm-'));
  ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }));
  /* De beheerder krijgt een geboortedatum, zodat de weigering in stap 1 over
     de ROL gaat en niet over een ontbrekende leeftijd. */
  const gezin = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Paspoortgezin', naam: 'Papa',
    pin: '1234', geboortedatum: '1985-01-01', bevoegdGezin: true, privacyAkkoord: true })).body;
  assert.ok(gezin.token, 'het gezin bestaat: ' + JSON.stringify(gezin).slice(0, 160));
  BEHEERDER = { code: gezin.code, token: gezin.token, profiel: { naam: 'Papa', beheerder: true } };
  MILAN = await kindprofiel(gezin, 'Milan', '2015-04-04', '5678');
  SAM = await kindprofiel(gezin, 'Sam', '2012-06-01', '2468');
  browser = await pw.chromium.launch(browserOpties(pw));
});

test.after(async () => {
  if (browser) try { await browser.close(); } catch (e) { /* al dicht */ }
  if (child) await stop(child);
  if (TMP) try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
});

/* Een eigen browsercontext per sessie, met de sessie al in localStorage
   VOORDAT de pagina laadt -- sessie.js beslist bij het inlezen al over de deur. */
async function openAls(sessie) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('rtf_sessie', JSON.stringify(s));
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, sessie);
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  return { ctx, page, fouten };
}

const optiewaarden = (page, sel) => page.evaluate((s) =>
  [...document.querySelectorAll(s + ' option')].map((o) => o.value).filter(Boolean), sel);

test('1. de weigering met reden: een ouder krijgt geen leerpaspoort, en het scherm zegt waarom',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page, fouten } = await openAls(BEHEERDER);
    try {
      const ladder = page.waitForResponse((r) => r.url().endsWith('/api/rtf/leerling/ladder'));
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      const r = await ladder;
      assert.equal(r.status(), 403, 'de server weigert de ladder voor een niet-leerling');
      assert.equal((await r.json()).error, 'Het leerpaspoort hoort bij een leerlingprofiel.');
      await wachtOpTekst(page, 'Het leerpaspoort hoort bij een leerlingprofiel.', { in: '#melding' });
      /* De toegangsdeur zelf stond open (een volwassene mag het scherm zien);
         de weigering komt uit het paspoort en niet uit het slot. */
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('rtf-toegang-dicht')), false);
      assert.deepEqual(await optiewaarden(page, '#ladderKies'), [], 'geen fasen te kiezen zonder paspoort');
      assert.equal(await page.evaluate(() => document.querySelector('#paspoort').textContent.trim()), 'Laden…',
        'het paspoort wordt niet gevuld');
      assert.deepEqual(fouten, [], 'geen JS-fouten bij de weigering: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });

test('2. het kind van 11: de ladder van de basisschool, inschrijven op groep 5, geen score',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page, fouten } = await openAls(MILAN);
    try {
      const ladder = page.waitForResponse((r) => r.url().endsWith('/api/rtf/leerling/ladder'));
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      assert.equal((await ladder).status(), 200, 'de ladder komt van de server');
      await wachtTot(page, () => document.querySelectorAll('#ladderKies option').length > 1, null,
        { wat: 'fasen in de kiezer' });
      await wachtOpTekst(page, 'Je staat nog niet op de ladder', { in: '#paspoort' });

      const fasen = await optiewaarden(page, '#ladderKies');
      assert.ok(fasen.includes('po-g5'), 'groep 5 staat op de ladder: ' + fasen.join(', '));
      for (const hoger of ['havo', 'vwo', 'hbo-b', 'wo-b']) {
        assert.ok(!fasen.includes(hoger), hoger + ' staat NIET op de ladder van een kind van 11: ' + fasen.join(', '));
      }
      assert.deepEqual(await optiewaarden(page, '#examenKies'), [],
        'de examenkiezer biedt een kind van 11 niets aan (examentraining is 12+)');

      await page.selectOption('#ladderKies', 'po-g5');
      const inschrijf = page.waitForResponse((r) => r.url().endsWith('/api/rtf/leerling/inschrijf'));
      await page.locator('#inschrijfKnop').click();
      assert.equal((await inschrijf).status(), 200, 'inschrijven via de knop lukt');
      await wachtOpTekst(page, 'Je bent ingeschreven op Groep 5', { in: '#paspoort' });
      await wachtOpTekst(page, 'Ingeschreven; je paspoort loopt vanaf hier mee.', { in: '#melding' });
      assert.match(await page.evaluate(() => document.querySelector('#paspoort').textContent),
        /De normale trede hierna: Groep 6/, 'de ladder zegt wat de volgende trede is');

      /* Geen score: de kerncijfers zijn fase, leerjaar, doelen en stappen. */
      const kpis = await page.evaluate(() => [...document.querySelectorAll('#schoolKpi .kpi')]
        .map((k) => k.querySelector('b').textContent.trim() + ' | ' + k.querySelector('span').textContent.trim()));
      assert.deepEqual(kpis, ['Groep 5 | Mijn fase', 'jaar 1 | Leerjaar', '0 | Leerdoelen behaald', '0 | Stappen op de ladder']);
      assert.doesNotMatch(kpis.join(' '), /score|punten|rang/i);
      assert.equal(await page.evaluate(() => document.querySelector('#jaarKnop').hidden), true,
        'een groep heeft geen leerjaren, dus geen "Jaar erbij"');
      assert.ok((await page.evaluate(() => document.querySelector('#eerlijk').textContent)).length > 20,
        'de eerlijke regel van de ladder staat eronder');
      assert.deepEqual(fouten, [], 'geen JS-fouten bij het inschrijven: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });

test('3. wat de kiezer een kind niet aanbiedt, weigert de server ook',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page } = await openAls(MILAN);
    try {
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.querySelectorAll('#ladderKies option').length > 1, null,
        { wat: 'fasen in de kiezer' });
      /* Langs de eigen api() van de pagina, met de eigen sessie: precies wat een
         aangepast scherm zou proberen. */
      const uitkomst = await page.evaluate(() => api('/api/leerstof/examen', { fase: 'havo' })
        .then((d) => ({ ok: true, d })).catch((e) => ({ ok: false, error: e.message })));
      assert.equal(uitkomst.ok, false, 'geen examentraining voor een kind van 11');
      assert.equal(uitkomst.error, 'Deze leerstof hoort nog niet bij jouw leeftijdspas.');
      assert.equal(await page.evaluate(() => document.querySelector('#examenBlok').hidden), true);
    } finally { await ctx.close(); }
  });

test('4. oefenen: de leerlijn komt van de server, en de server kijkt het antwoord na',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page, fouten } = await openAls(MILAN);
    try {
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.querySelectorAll('#leerKies option').length > 1, null,
        { wat: 'fasen in de leerlijnkiezer' });
      const vakken = page.waitForResponse((r) => r.url().endsWith('/api/rtf/leerling/vakken'));
      await page.selectOption('#leerKies', 'po-g5');
      assert.equal((await vakken).status(), 200, 'de leerlijn van groep 5 komt van de server');
      await wachtTot(page, () => document.querySelectorAll('#vakken [data-oefen]').length > 0, null,
        { wat: 'leerdoelen met een oefenknop' });
      assert.ok(await page.locator('#vakken .vakkop').count() > 0, 'de leerlijn is per vak geordend');
      assert.equal(await page.evaluate(() => document.querySelector('#oefenKaart').hidden), true, 'nog geen oefenkaart');

      const oefen = page.waitForResponse((r) => r.url().endsWith('/api/rtf/leerling/oefen'));
      await page.locator('#vakken [data-oefen]').first().click();
      assert.equal((await oefen).status(), 200, 'de oefensessie start op de server');
      await wachtOpZichtbaar(page, '#oefenKaart');
      assert.match(await page.evaluate(() => document.querySelector('#oefenStand').textContent), /^1\/5 · /,
        'vijf opgaven, dit is de eerste');
      assert.ok((await page.evaluate(() => document.querySelector('#oefenVraag').textContent)).trim().length > 0,
        'de vraag staat op het scherm');

      /* Antwoorden: een optie als die er is, anders het invulveld. Wat het
         antwoord is weet het scherm niet; de server zegt goed of bijna. */
      const antwoord = page.waitForResponse((r) => r.url().endsWith('/api/rtf/leerling/antwoord'));
      if (await page.locator('#oefenOpties [data-antw]').count() > 0) {
        await page.locator('#oefenOpties [data-antw]').first().click();
      } else {
        await page.locator('#oefenIn').fill('42');
        await page.locator('#oefenStuur').click();
      }
      const na = await (await antwoord).json();
      assert.equal(typeof na.goed, 'boolean', 'de server heeft nagekeken');
      await wachtOpTekst(page, na.goed ? 'Goed zo.' : 'Bijna: het juiste antwoord was', { in: '#oefenUit' });
      await wachtOpTekst(page, /^2\/5/, { in: '#oefenStand' });
      assert.deepEqual(fouten, [], 'geen JS-fouten bij het oefenen: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });

test('5. de tiener van 14: havo op de ladder, en de examentraining begint',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page, fouten } = await openAls(SAM);
    try {
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.querySelectorAll('#examenKies option').length > 1, null,
        { wat: 'fasen in de examenkiezer' });
      const fasen = await optiewaarden(page, '#ladderKies');
      assert.ok(fasen.includes('po-g8') && fasen.includes('havo'), 'basisschool en voortgezet onderwijs: ' + fasen.join(', '));
      assert.ok(!fasen.includes('hbo-b') && !fasen.includes('wo-b'), 'geen vervolgonderwijs op 14: ' + fasen.join(', '));
      const examen = await optiewaarden(page, '#examenKies');
      assert.ok(examen.includes('havo') && !examen.some((f) => /^po-/.test(f)),
        'de examenkiezer biedt het voortgezet onderwijs en niet de basisschool: ' + examen.join(', '));

      await page.selectOption('#examenKies', 'havo');
      const start = page.waitForResponse((r) => r.url().endsWith('/api/rtf/leerling/examen'));
      await page.locator('#examenStartKnop').click();
      assert.equal((await start).status(), 200, 'de examentraining start voor een tiener');
      await wachtOpZichtbaar(page, '#examenBlok');
      assert.equal(await page.evaluate(() => document.querySelector('#examenStand').textContent), '1/10');
      assert.ok((await page.evaluate(() => document.querySelector('#examenVraag').textContent)).trim().length > 0,
        'de eerste examenvraag staat op het scherm');
      assert.deepEqual(fouten, [], 'geen JS-fouten bij de examentraining: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });
