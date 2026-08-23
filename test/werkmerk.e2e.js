/* HET MERK VAN DE KLANT IN EEN ECHTE BROWSER -- en waar het ophoudt.

   Dit is de white-label-vraag op het scherm waar hij toe doet: de medewerker
   van een klant ziet zijn eigen organisatie boven zijn werkruimte staan. Drie
   dingen zijn van buiten niet te zien aan een groene API-toets, en juist zij
   zijn de reden dat dit bestand bestaat:

   1. DE KLEUR BLIJFT BINNEN HET EIGEN BLOK. De accentkleur van de klant komt op
      de merkbalk en NIET op de schil van RTG. Dezelfde grens die
      test/mediazaak.e2e.js voor de leden-app afrekent -- een tenant die de hele
      app kan omverven, kan iemand laten denken dat hij ergens anders is.
   2. DE HERKOMSTREGEL BLIJFT STAAN, OOK IN 'private'. Dat is de modus waarin
      het RTG-merk uit de schil verdwijnt. Wiens software je personeelsdossier
      bewaart, is geen merkvraag maar een AVG-vraag.
   3. EEN WERKRUIMTE ZONDER TENANT KRIJGT GEEN VERZONNEN MERK. Dan blijft de
      balk gewoon weg.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');

const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkmerk-'));
const ACCENT = '#1B7F5A';

test('het Werk OS draagt de naam van de klant, en de RTG-schil verft niet mee',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  let browser;
  try {
    const post = (pad, body, token) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body) }).then(r => r.json());
    const bedrijf = (pad, body) => post('/api/bedrijf' + pad, body);

    /* Twee werkruimtes: een met een tenant erachter en een zonder. De tweede is
       er niet voor de volledigheid maar voor bewering 3. */
    const met = await bedrijf('/werkruimte/maak', { naam: 'Haarlem BV', land: 'NL' });
    const zonder = await bedrijf('/werkruimte/maak', { naam: 'Losse werkruimte', land: 'NL' });
    const lidA = await bedrijf('/lid/aanmeld', { werkruimte: met.werkruimte, naam: 'Pia' });
    await bedrijf('/lid/besluit', { werkruimte: met.werkruimte, beheerToken: met.beheerToken, lidId: lidA.lidId, akkoord: true });
    const lidB = await bedrijf('/lid/aanmeld', { werkruimte: zonder.werkruimte, naam: 'Sam' });
    await bedrijf('/lid/besluit', { werkruimte: zonder.werkruimte, beheerToken: zonder.beheerToken, lidId: lidB.lidId, akkoord: true });

    const tech = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).token;
    assert.ok(tech, 'de eigenaar beheert de tenants');
    await post('/api/techniek/tenant', { org: 'O-HAARLEM', naam: 'Imran Group', modus: 'private' }, tech);
    await post('/api/techniek/tenant/bind', { org: 'O-HAARLEM', soort: 'werkruimte', code: met.werkruimte }, tech);
    await post('/api/techniek/tenant/merk',
      { org: 'O-HAARLEM', merk: { naam: 'Imran Group One', payoff: 'Werk zoals het hoort', accent: ACCENT } }, tech);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const inloggen = async (code, token) => {
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.removeItem('rtg_werk_sessie'); });
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      await page.fill('#iWerkruimte', code);
      await page.fill('#iToken', token);
      await page.click('#inlogGa');
      await page.waitForTimeout(1100);
    };

    /* ---- de werkruimte MET een tenant ---- */
    await inloggen(met.werkruimte, lidA.lidToken);
    const m = await page.evaluate(() => {
      const balk = document.getElementById('wkMerk');
      const shell = document.querySelector('.wk-shell');
      const top = document.querySelector('.wk-top');
      const kleur = (el) => el ? getComputedStyle(el).borderLeftColor : null;
      return {
        zichtbaar: balk ? !balk.hidden : false,
        tekst: balk ? balk.innerText.replace(/\s+/g, ' ') : '',
        merkRand: kleur(balk),
        eigenschap: shell ? getComputedStyle(shell).getPropertyValue('--wk-merk-accent').trim() : '',
        nietGebouwd: (document.getElementById('wkNietGebouwd') || {}).innerText || '',
        contract: (document.getElementById('wkContract') || {}).innerText || '',
        /* De grenscontrole loopt ALLES na wat buiten de merkbalk staat. Twee
           eigenschappen van twee elementen prikken zou een lek missen dat
           precies ergens anders zit -- en dan zakt deze toets niet terwijl de
           grens wel weg is. */
        buiten: (function () {
          const raak = [];
          for (const el of document.querySelectorAll('*')) {
            if (!balk || balk === el || balk.contains(el)) continue;
            const c = getComputedStyle(el);
            for (const eig of ['backgroundColor', 'color', 'borderTopColor', 'borderRightColor',
              'borderBottomColor', 'borderLeftColor', 'outlineColor', 'backgroundImage', 'boxShadow']) {
              if (/27,\s*127,\s*90/.test(String(c[eig]))) {
                raak.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + eig);
                break;
              }
            }
          }
          return raak;
        })()
      };
    });

    assert.equal(m.zichtbaar, true, 'de merkbalk staat er');
    assert.match(m.tekst, /Imran Group One/, 'met de naam van de klant');
    assert.match(m.tekst, /Werk zoals het hoort/, 'en zijn payoff');

    /* Bewering 1. De kleur zit op de merkbalk, en NERGENS anders: niet in de
       kopbalk en niet in de achtergrond van de schil. */
    assert.equal(m.eigenschap, ACCENT, 'de accentkleur staat als eigenschap op de schil');
    assert.equal(m.merkRand, 'rgb(27, 127, 90)', 'en wordt op de merkbalk gebruikt');
    assert.deepEqual(m.buiten, [],
      'buiten de merkbalk draagt geen enkel element de kleur van de klant: ' + m.buiten.join(', '));

    /* Bewering 2. De herkomstregel staat er, en dit is de modus 'private'. */
    assert.match(m.tekst, /Rahul Travel Group/, 'de herkomstregel staat in de voet, ook in private');
    assert.match(m.tekst, /eigen domein bestaat hier niet/, 'en de grens staat erbij');

    assert.match(m.nietGebouwd, /policies|trust/,
      'wat er per organisatie niet is, staat op het scherm en niet alleen in de JSON');

    /* Het pakket en het verbruik staan er OOK, en dat is de andere helft van
       dezelfde eerlijkheid: een grens waar je tegenaan loopt zonder hem te
       hebben zien naderen, voelt als een storing. */
    assert.match(m.contract, /Proef/, 'het pakket staat op het scherm');
    assert.match(m.contract, /Verzoeken dit uur/, 'met de teller erbij');
    assert.match(m.contract, /worden nergens gemeten, dus ze gelden ook niet/,
      'en met wat er NIET onder valt');

    /* ---- de werkruimte ZONDER tenant: bewering 3 ---- */
    await inloggen(zonder.werkruimte, lidB.lidToken);
    const z = await page.evaluate(() => {
      const balk = document.getElementById('wkMerk');
      const shell = document.querySelector('.wk-shell');
      return { verborgen: balk ? balk.hidden : null, tekst: balk ? balk.innerText : '',
        eigenschap: shell ? getComputedStyle(shell).getPropertyValue('--wk-merk-accent').trim() : 'x' };
    });
    assert.equal(z.verborgen, true, 'geen tenant, geen merkbalk');
    assert.equal(z.tekst.trim(), '', 'en er staat geen verzonnen naam');
    assert.equal(z.eigenschap, '', 'en geen achtergebleven kleur van de vorige klant');

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
