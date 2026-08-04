/* ============================================================================
   DE RTF-KINDERSCHERMEN: WAT ZIET EEN KIND ALS HET NOG NERGENS BIJ HOORT?

   Acht schermen van de RTFoundation-kant, alle acht uit de lijst van TAKEN 4.9.
   Ze vallen uiteen in twee soorten, en juist het verschil is de moeite waard:

   DE GESLOTEN VIER (arena, bieb, geloofbieb, schoolbieb) horen bij een gezin.
   Zonder gezinssessie moeten ze een DEUR tonen die vertelt wat er achter zit en
   hoe je een gezin aanmaakt -- geen leeg scherm en geen omleiding. De Arena
   stuurde tot deze ronde nog weg naar de RTF-startpagina; dat is dezelfde kwaal
   als bij de acht kantoor-apps (5.5) en is hier meegenomen.

   DE OPEN VIER (klas, speeltuin, speelhal, schoolpartner) zijn met opzet open,
   en daar zit hun eigen belofte:

   - DE KLAS-PDA vraagt een klascode en een voornaam, "meer heb je niet nodig".
     Dat is dataminimalisatie bij kinderen, in een zin. Een veld erbij (een
     achternaam, een e-mailadres, een geboortedatum) is precies het soort
     uitbreiding dat er ongemerkt in sluipt en dat deze toets moet tegenhouden.
   - DE SPEELTUIN EN DE SPEELHAL zijn spellen voor jonge kinderen. De merkregel
     uit CLAUDE.md geldt daar het hardst: geen verslavende engagement-patronen.
     Geen highscore-ranglijst, geen dagelijkse reeks, geen "kom morgen terug".
     Een spel dat een kind terugroept is precies wat dit huis niet doet.
   - SCHOOLPARTNER is de zakelijke kant en moet eerlijk zeggen dat een school
     zich eerst aanmeldt -- geen inlogscherm dat suggereert dat je zo binnen bent.

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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfkind-'));

const GESLOTEN = ['foundation/arena', 'foundation/bieb', 'foundation/geloofbieb', 'foundation/schoolbieb'];

async function toon(page, base, app) {
  const pad = '/apps/' + app + '.html';
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.removeItem('rtf_sessie'); });
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);   // een omleiding zou hierbinnen gebeuren
  return page.evaluate(() => ({
    pad: location.pathname,
    deur: !!document.querySelector('.rtgdeur'),
    velden: [...document.querySelectorAll('input:not([type=hidden]), textarea, select')]
      .map(e => (e.getAttribute('placeholder') || e.getAttribute('aria-label') || e.name || e.id || e.type)),
    tekst: document.body.innerText.replace(/\s+/g, ' ')
  }));
}

test('de gesloten RTF-apps tonen een deur op de app zelf, niet de startpagina',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const stuk = [];
    for (const app of GESLOTEN) {
      const r = await toon(page, base, app);
      if (r.pad !== '/apps/' + app + '.html') { stuk.push(app + ': stuurt weg naar ' + r.pad); continue; }
      if (!r.deur) { stuk.push(app + ': geen deur -- ' + r.tekst.slice(0, 110)); continue; }
      /* De deur hoort te vertellen wat er achter zit EN hoe je een gezin
         aanmaakt. Een deur die alleen "nee" zegt is een muur. */
      if (!/gezin/i.test(r.tekst)) stuk.push(app + ': de deur legt niet uit dat dit bij een gezin hoort');
      if (r.tekst.length < 140) stuk.push(app + ': de deur zegt bijna niets (' + r.tekst.length + ' tekens)');
    }
    assert.deepEqual(stuk, [], 'de vier gesloten RTF-apps tonen hun eigen deur:\n  ' + stuk.join('\n  '));

    /* EEN uitzondering, met naam en reden. Deze apps stoppen hun script met
       `throw new Error('geen sessie')` nadat Sessie.eisProfiel() de deur al
       heeft getoond -- dat is hoe ze voorkomen dat de rest van de pagina
       doorloopt op een sessie die er niet is. De melding is dus opzettelijk en
       hoort bij een deur die zijn werk doet.

       Alleen die ene tekst wordt doorgelaten. Elke andere fout zakt gewoon, en
       dat is het punt: een uitzondering met een naam laat de toets scherp,
       terwijl "negeer paginafouten hier" hem stomp zou maken. */
    const echt = fouten.filter(f => !/^geen sessie$/.test(String(f).trim()));
    assert.deepEqual(echt, [], 'paginafouten (anders dan de bedoelde stop): ' + echt.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('de klas-PDA vraagt een klascode en een voornaam, en niets meer',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const r = await toon(page, base, 'foundation/klas');
    assert.equal(r.pad, '/apps/foundation/klas.html', 'de klas-PDA is gewoon open, want een kind heeft hier geen account');
    assert.match(r.tekst, /klascode/i, 'hij vraagt om de klascode van het bord: ' + r.tekst.slice(0, 160));
    assert.match(r.tekst, /voornaam/i, 'en om een voornaam');
    assert.match(r.tekst, /meer heb je niet nodig/i,
      'en zegt er met zoveel woorden bij dat dat alles is: ' + r.tekst.slice(0, 200));

    /* DE KERN: geen veld erbij. Wat hier niet gevraagd wordt, kan ook niet
       lekken -- en bij een kind van acht is elke extra vraag er een te veel.
       Een achternaam, een e-mailadres of een geboortedatum is precies de
       uitbreiding die er ongemerkt in sluipt omdat hij "handig" is. */
    const teveel = r.velden.filter(v => /achternaam|e-?mail|mail|geboorte|telefoon|adres|wachtwoord/i.test(String(v)));
    assert.deepEqual(teveel, [], 'de klas-PDA vraagt niets extras: ' + JSON.stringify(r.velden));

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('de speeltuin en de speelhal roepen geen kind terug: geen ranglijst, geen reeks',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const stuk = [];
    for (const app of ['foundation/speeltuin', 'foundation/speelhal']) {
      const r = await toon(page, base, app);
      if (r.pad !== '/apps/' + app + '.html') { stuk.push(app + ': stuurt weg naar ' + r.pad); continue; }

      // de spellen staan er echt, en het scherm is niet leeg
      if (r.tekst.length < 100) { stuk.push(app + ': bijna leeg (' + r.tekst.length + ' tekens)'); continue; }

      /* GEEN VERSLAVENDE PATRONEN. Dit is de merkregel uit CLAUDE.md, op de
         plek waar hij het hardst geldt: schermen voor jonge kinderen. Een
         highscore-ranglijst of een dagelijkse reeks voelt als een leuke
         toevoeging en is precies wat een kind terugroept. */
      const val = [
        [/\bhighscore\b|\brecord\b|\branglijst\b|\bleaderboard\b/i, 'een ranglijst of highscore'],
        [/\d+\s*dagen op rij|\bstreak\b|\breeks van\b/i, 'een dagenreeks'],
        [/kom morgen terug|morgen weer|dagelijkse (beloning|bonus)/i, 'een terugkom-lokkertje']
      ];
      for (const [patroon, wat] of val) {
        const m = r.tekst.match(patroon);
        if (m) stuk.push(app + ': ' + wat + ' op het scherm ("' + m[0] + '")');
      }
    }
    assert.deepEqual(stuk, [], 'de kinderspellen roepen niemand terug:\n  ' + stuk.join('\n  '));
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('schoolpartner zegt eerlijk dat een school zich eerst aanmeldt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const r = await toon(page, base, 'schoolpartner');
    assert.equal(r.pad, '/apps/schoolpartner.html', 'de partnerpagina is open');
    assert.match(r.tekst, /inloggen/i, 'er is een inlog voor wie al klant is');

    /* De eerlijkheid zit in het tweede deel: een school die hier voor het eerst
       komt, is niet met een inlogscherm geholpen. Zonder die zin lijkt het of
       je zo naar binnen kunt en loopt iedereen vast op een code die hij niet
       heeft. */
    assert.match(r.tekst, /nieuw hier|meldt zich eerst|aanmeld/i,
      'en het zegt wat een nieuwe school moet doen: ' + r.tekst.slice(0, 220));

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
