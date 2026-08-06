/* ============================================================================
   DE SCHERMEN MET EEN EIGEN SESSIESOORT, EN DE TWEE DOORVERWIJSSTUBS.

   Twaalf van de vijftien schermen die na TAKEN 4.9 nog geen eigen toets hadden.
   Ze stonden er allemaal om dezelfde reden op: ze draaien niet op de ledenpas
   maar op een ANDERE sleutel -- een kantoorcode, een zaak-inlog, een clubcode,
   een raadcode -- en de bestaande schermtoetsen loggen als lid in.

   WAT HIER GETOETST WORDT, EN WAAROM DAT NIET "OPENT HIJ" IS

   Een scherm dat de verkeerde sleutel krijgt, kan drie dingen doen. Twee ervan
   zijn fout en zien er van buiten hetzelfde uit:

     1. leeg blijven -- de bezoeker denkt dat het systeem stuk is
     2. wegsturen naar de inlog -- hij verliest waar hij heen wilde, en dat is
        precies de kwaal uit TAKEN 5.5
     3. zeggen WELKE sleutel hij mist, met een weg ernaartoe

   Alleen de derde deugt. Dus staat per scherm vast welke sleutel het noemt.

   EN ER KWAM ER EEN UIT. `foundation/clubswerk.html` deed nog nummer 2: hij
   stuurde uitgelogd naar de personeels-app. Dezelfde kwaal als de acht apps uit
   5.5, de Arena, het RTF-kantoor en de Societeit -- dit was de laatste van die
   familie. Hij toont nu zijn eigen deur, en dat ligt hieronder vast.

   DE TWEE STUBS ZIJN GEEN UITZONDERING MAAR EEN BELOFTE. `kantoorpda.html` en
   `zorgbalie.html` zijn bewust geen apps (TAKEN 5.1): het zijn doorverwijzingen
   met een meta-refresh naar `personeel.html`. Precies daarom horen ze getoetst:
   een stub die niet doorverwijst is een wit scherm voor iemand die op zijn werk
   staat, en aan een meta-refresh valt niets af te lezen zonder hem te draaien.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eigensessie-'));

/* Per scherm: welke sleutel het mist, en dus wat het hoort te zeggen. De eis is
   met opzet de NAAM van de sleutel en niet een algemeen "log in" -- wie op het
   verkeerde scherm staat, moet weten waar hij dan wel moet zijn. */
const EIGEN_SLEUTEL = [
  { app: 'concierge', eist: /kantoorcode|backoffice/i },
  { app: 'ghost', eist: /zaak-app|inlog van uw zaak/i },
  { app: 'doos', eist: /doosmodus|zaakdoos/i },
  { app: 'werkplek', eist: /log eerst in|welk huis|waar werk je/i },
  { app: 'defensie', eist: /defensie/i },
  { app: 'foundation/club', eist: /clubcode/i },
  { app: 'foundation/partner', eist: /raadcode|stadspartner/i },
  { app: 'foundation/beroepen', eist: /beroepen-?bibliotheek/i },
  { app: 'foundation/magazine', eist: /rtfoundation|magazine|30%/i },
  /* werk.html erbij op 6 augustus. scripts/schermen.js noemde hem als een van de
     vier schermen waar geen enkele toets de weg van aflegt, en hij hoort in deze
     lijst en niet in een eigen bestand: het RTG Werk OS draait op een
     WERKRUIMTECODE plus een lid-token, dus precies de vorm waar deze toets voor
     bestaat -- niet "gaat hij open" maar "zegt hij welke sleutel hij mist". */
  { app: 'werk', eist: /werkruimte|lid-token/i }
];

/* De twee stubs, met waar ze heen horen te wijzen. `kantoor=1` is geen detail:
   dat is het verschil tussen de kantoorcode-inlog en de gewone personeelsinlog,
   en de zorgbalie hoort juist de gewone te krijgen. */
const STUBS = [
  { app: 'kantoorpda', naar: '/apps/personeel.html', zoek: 'kantoor=1' },
  { app: 'zorgbalie', naar: '/apps/personeel.html', zoek: null }
];

/* Een schone bezoeker: cookie-melding weg, en GEEN enkele sessiesleutel. Dat
   laatste is de hele opstelling -- met een ledentoken erin zouden een paar van
   deze schermen iets anders doen en meet de toets niet waar hij over gaat. */
const SLEUTELS = ['rtg_member_token', 'rtg_office_token', 'rtg_sup_token',
  'rtf_sessie', 'rtf_club_code', 'rtf_raadcode'];

async function toon(page, base, app) {
  const pad = '/apps/' + app + '.html';
  /* Een meta-refresh met content="0" breekt de navigatie af (ERR_ABORTED) en
     vernielt de context van een evaluate die er middenin valt. Dat is bij deze
     twaalf geen randgeval maar de kern, dus wordt het opgevangen in plaats van
     omzeild. */
  const ga = async () => {
    try { await page.goto(base + pad, { waitUntil: 'domcontentloaded' }); }
    catch (e) { await page.waitForTimeout(400); }
  };
  await ga();
  try {
    await page.evaluate(s => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      for (const k of s) localStorage.removeItem(k);
    }, SLEUTELS);
  } catch (e) { /* al doorverwezen; de sleutels stonden er toch niet */ }
  await ga();
  await page.waitForTimeout(1300);
  return page.evaluate(() => ({
    pad: location.pathname + location.search,
    deur: !!document.querySelector('.rtgdeur'),
    tekst: document.body.innerText.replace(/\s+/g, ' ').trim()
  }));
}

async function opstelling() {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  /* De service worker MOET uit. Anders haalt hij tientallen schermen vooruit op
     en telt deze toets als VEEGTOETS -- en dan tellen zijn eigen schermen niet
     mee in scripts/schermen.js. Dat is hier eerder misgegaan. */
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  return { browser, page, fouten };
}

/* Het AANTAL komt uit de lijst en staat niet in de tekst. Er stond "negen" toen
   het er negen waren, en bij de tiende zou die kop stil hebben gelogen -- precies
   de soort verkeerde bewering die dit huis met een handhaver bewaakt. */
test('elk scherm met een eigen sleutel zegt WELKE sleutel het mist (' + EIGEN_SLEUTEL.length + ')',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const o = await opstelling();
    browser = o.browser;

    const stuk = [];
    for (const s of EIGEN_SLEUTEL) {
      const r = await toon(o.page, base, s.app);
      if (r.pad !== '/apps/' + s.app + '.html') { stuk.push(s.app + ': stuurt weg naar ' + r.pad); continue; }
      if (r.tekst.length < 60) { stuk.push(s.app + ': bijna leeg (' + r.tekst.length + ' tekens)'); continue; }
      if (!s.eist.test(r.tekst)) stuk.push(s.app + ': noemt zijn sleutel niet -- ' + r.tekst.slice(0, 130));
    }
    assert.deepEqual(stuk, [], 'alle ' + EIGEN_SLEUTEL.length + ' wijzen naar hun eigen sleutel:\n  ' + stuk.join('\n  '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('het clubswerk-kantoor toont zijn eigen deur en stuurt niemand meer weg',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const o = await opstelling();
    browser = o.browser;

    const r = await toon(o.page, base, 'foundation/clubswerk');
    assert.equal(r.pad, '/apps/foundation/clubswerk.html', 'clubswerk blijft waar hij is');
    assert.ok(r.deur, 'en toont de gedeelde deur: ' + r.tekst.slice(0, 160));
    assert.ok(r.tekst.length > 120, 'de deur vertelt wat er achter zit (' + r.tekst.length + ' tekens)');

    /* HET TERUG-ADRES IS DE HALVE REPARATIE. Zonder dat komt iemand na het
       inloggen op de personeelsstart uit in plaats van waar hij heen wilde --
       dat is dezelfde bezoeker kwijtraken, alleen een stap later. */
    const inlog = await o.page.evaluate(() => {
      const a = document.querySelector('.rtgdeur a[href]');
      return a ? a.getAttribute('href') : null;
    });
    assert.ok(inlog && inlog.includes('terug='),
      'de inloglink draagt het terug-adres: ' + inlog);
    assert.ok(inlog.includes(encodeURIComponent('/apps/foundation/clubswerk.html')),
      'en dat adres is dit scherm: ' + inlog);

    /* Geen paginafout. Dit is precies waar de reparaties uit 5.5 op stukliepen:
       de laadlus draaide door zonder sessie en overschreef de deur met een
       401-melding, of de deur verving #main voordat de listeners gebonden
       waren ("Cannot read properties of null"). */
    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('de twee doorverwijsstubs komen echt op de personeelsinlog uit',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const o = await opstelling();
    browser = o.browser;

    for (const s of STUBS) {
      const r = await toon(o.page, base, s.app);
      assert.ok(r.pad.startsWith(s.naar),
        s.app + ' komt uit op ' + s.naar + ' (nu: ' + r.pad + ')');
      if (s.zoek) assert.ok(r.pad.includes(s.zoek),
        s.app + ' vraagt de kantoorcode-inlog (' + s.zoek + '): ' + r.pad);
      else assert.equal(r.pad.includes('kantoor=1'), false,
        s.app + ' vraagt juist NIET de kantoorcode-inlog: ' + r.pad);
      /* En er staat ook echt een inlog, geen half geladen scherm. */
      assert.ok(r.tekst.length > 80, s.app + ': het doel is leeg (' + r.tekst.length + ' tekens)');
    }
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
