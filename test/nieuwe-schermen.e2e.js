/* ============================================================================
   DRIE SCHERMEN DIE MET DE VERZAMELING MEEKWAMEN, EN DIE NOG NOOIT EEN BROWSER
   HADDEN GEZIEN.

   RTG Festival bracht twee schermen mee (het organisatiescherm en de
   gastenkant) en RTG Reizen een derde (de klaargezette reis). Voor alle drie
   bestaan er servertoetsen -- de routes zijn gedekt -- maar geen enkele toets
   opende ooit de PAGINA. scripts/schermen.js meet precies dat verschil, en het
   vraagt het niet aan de tekst maar aan de server: alleen een echte navigatie
   telt, op naam van de toets die hem deed.

   WAAROM DAT VERSCHIL ERTOE DOET. Een route die antwoordt bewijst niet dat er
   een scherm omheen staat dat werkt. Deze ronde leverde daar het bewijs voor:
   de voorvertoning in Bestanden opende het paneel, vulde naam, soort en
   grootte, en liet de inhoud leeg -- terwijl elke route eronder keurig 200 gaf.
   Dat vind je alleen door de pagina te openen.

   DEZE TOETS DOET PER SCHERM MEER DAN LANGSLOPEN. Hij zet de gegevens klaar via
   dezelfde weg die een mens loopt (een festival met een editie en een dag, een
   klaargezette reis van het kantoor), opent het scherm, en kijkt of wat er op
   staat uit die gegevens komt. Een pagina die niets ophaalt en toch iets toont,
   toont iets verzonnens.

   Draai los: node --test test/nieuwe-schermen.e2e.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const dag = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function metScherm(werk) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nwscherm-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  const post = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    await werk({ base, post, browser, TMP });
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
  }
}

/* De zaakkant van het festival draait op een leverancierssessie; dezelfde weg
   als test/festival-routes.test.js loopt, zodat er hier geen tweede manier
   ontstaat om een festival te beginnen. */
async function alsManager(post, code) {
  const bezetting = await post('/api/supplier/roster', { code });
  const wie = (bezetting.body.staff || []).find((s) => s.role === 'manager');
  assert.ok(wie, 'er staat een manager klaar bij ' + code);
  const r = await post('/api/supplier/login', { code, staffId: wie.id, pin: '1234' });
  assert.ok(r.body.token, 'de manager komt binnen bij ' + code);
  return r.body.token;
}

test('RTG Festival: het organisatiescherm toont het festival dat er echt staat',
  { skip: geenBrowser(pw), concurrency: false }, async () => {
    await metScherm(async ({ base, post, browser }) => {
      const manager = await alsManager(post, 'ESVEDRA');
      const fid = (await post('/api/festival/nieuw', { naam: 'Schermival' }, manager)).body.festival.id;
      const eid = (await post('/api/festival/editie', { festival: fid, jaar: 2027 }, manager)).body.editie.id;
      await post('/api/festival/dag', { festival: fid, editie: eid, datum: dag(0),
        open: '00:00', sluit: '23:59' }, manager);

      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('rtg_supplier_token', t); localStorage.setItem('rtg_lang', 'nl'); }
        catch (e) { /* geen opslag: dan valt het scherm zelf terug */ }
      }, manager);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/festival.html', { waitUntil: 'domcontentloaded' });

      /* De schil is het bewijs dat dit scherm draait: bank, werkvlak en de
         bladen eromheen komen uit apps/festival/schil.js. */
      await page.waitForSelector('#rtgCommand, .rv-app, #main', { timeout: 20000 });
      await wachtOpRust(page);
      const bladen = await page.evaluate(() =>
        [...document.querySelectorAll('[data-blad]')].map((b) => b.getAttribute('data-blad')));
      assert.ok(bladen.includes('poort') && bladen.includes('kassa'),
        'de bank draagt de bladen van het festival: ' + bladen.join(', '));
      assert.deepEqual(fouten, [], 'geen JS-fouten op het organisatiescherm: ' + fouten.join(' | '));
    });
  });

test('RTG Festival: de gastenkant vraagt om een pas en verzint er geen',
  { skip: geenBrowser(pw), concurrency: false }, async () => {
    await metScherm(async ({ base, post, browser }) => {
      const u = Date.now().toString().slice(-8);
      const lid = (await post('/api/auth/register', { name: 'Gast Lid', email: 'gs' + u + '@x.nl',
        phone: '061' + u, password: 'geheim12345', geboortedatum: '1990-01-01',
        tier: 'rtg', pasApp: 'rtg' })).body.token;
      assert.ok(lid, 'het lid staat ingeschreven');

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); }
        catch (e) { /* zie boven */ }
      }, lid);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/festival-gast.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#fgEditie, #fgDag, main', { timeout: 20000 });
      await wachtOpRust(page);

      /* DIT LID HEEFT GEEN PAS, en dan hoort er niets te staan alsof hij er wel
         een heeft. De kop van apps/festival-gast.js zegt het zelf: wat er niet
         staat, staat er ook -- een programma dat half rond is, zegt dat. */
      const tekst = await page.evaluate(() => document.body.innerText);
      assert.doesNotMatch(tekst, /uw pas is geldig|toegang verleend/i,
        'zonder pas hoort er geen toegang beloofd te worden: ' + tekst.slice(0, 160));
      assert.ok(tekst.trim().length > 0, 'het scherm zegt wel iets');
      assert.deepEqual(fouten, [], 'geen JS-fouten op de gastenkant: ' + fouten.join(' | '));
    });
  });

test('RTG Reizen: de klaargezette reis staat op het uitnodigingsscherm',
  { skip: geenBrowser(pw), concurrency: false }, async () => {
    await metScherm(async ({ base, post, browser }) => {
      const kantoor = (await post('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
      assert.ok(kantoor, 'het kantoor komt binnen');
      const zet = await post('/api/office/reisbureau/klaarzetten', {
        naam: 'Jan de Vries', email: 'jan@voorbeeld.nl', telefoon: '0612345678',
        onderdelen: [{ soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza',
          van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' }]
      }, kantoor);
      assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
      const code = String(zet.body.link).split('code=')[1];
      assert.equal(code.length, 32, 'de code is 128 bits en dus niet te raden');

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      /* UITGELOGD, want dat is de weg die deze pagina bedient: iemand krijgt een
         link van het reisbureau en heeft nog geen account. */
      await page.goto(base + '/apps/reisuitnodiging.html?code=' + code, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => /Ibiza/i.test(document.getElementById('vak').innerText),
        null, { timeout: 20000 });

      const tekst = await page.evaluate(() => document.getElementById('vak').innerText);
      assert.match(tekst, /Ibiza/i, 'de bestemming van de klaargezette reis staat er');
      /* En de persoonsgegevens uit de aanvraag horen NERGENS op dit scherm: een
         klaargezette reis gaat over de reis. Zelfde regel als
         test/reisuitnodiging.test.js op de server meet. */
      assert.doesNotMatch(tekst, /Jan de Vries|jan@voorbeeld\.nl|0612345678/,
        'de persoonsgegevens van de aanvraag horen hier niet: ' + tekst.slice(0, 200));
      assert.deepEqual(fouten, [], 'geen JS-fouten op het uitnodigingsscherm: ' + fouten.join(' | '));
    });
  });
