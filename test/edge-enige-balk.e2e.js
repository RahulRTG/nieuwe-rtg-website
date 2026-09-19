/* ============================================================================
   DE EDGE IS DE ENE BALK -- en wat hij overneemt, neemt hij ook MEE.

   Naast de Edge stonden op 135 van 291 schermen nog eigen vaste balken: de
   gedeelde app-kop `.ios-nav` op 108 schermen, de suitebalk en suitenavigatie
   van de sociale schermen op tien, de ops-navigatie van Travel op vier, de
   sociale commandobalk op drie, de statusstrook op een. Dat is dezelfde
   bediening twee keer, en op de smalle schermen kostte het de halve hoogte.

   Sinds `kern/../rtg-adaptive-edge-claim.js` claimt de Edge zo'n balk: hij
   krijgt `rtg-edge-owned-bar`, de CSS verbergt hem, en zijn knoppen worden
   geoogst naar het Edge-blad met hun eigen handlers. Deze toets bewaakt de drie
   dingen die daarbij fout kunnen gaan, en alle drie zijn ze een keer echt
   fout gegaan tijdens het bouwen:

   1. DE BALK IS WEG EN ZIJN KNOPPEN NIET. Verbergen zonder oogsten is een
      functie onbereikbaar maken; dat is geen opruiming maar een gebrek
      (ADAPTIEF.md: verbergen bestaat niet).
   2. DE RUIMTE GAAT MEE. `.comm` staat `position:fixed; inset:var(--suite-stack)`
      en werd door die 116px ook vrijgehouden van de casco-bovenbalk. De eerste
      versie zette die op nul, en toen liep de titel van Berichten onder de
      bovenbalk door. Nul was het verkeerde getal; de inzet van de Edge is het
      goede.
   3. DE GRENDEL: EEN NAAM IS GEEN BALK. `ios.js` plakt `ios-nav` ook op
      `header.ritkop` van rit.html, en rtg-aankomst-2026.css maakt daar een hero
      van 430px met een foto van. Wie op de klassenaam claimt, haalt daar de
      INHOUD weg. De claim meet daarom of het ding op dat moment ook werkelijk
      een balk is. Zonder deze derde proef zou de toets groen staan terwijl de
      regel te grof is -- en dat is precies het geval dat je niet ziet aankomen.

   Draait alleen waar een browser beschikbaar is. Draai: npm run e2e
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, elevateTier, wachtTot } = require('./helper');

const pw = laadPlaywright();

/* Per scherm de balk die de Edge hoort over te nemen, en een knop die daarna
   in het blad terug moet zijn. De knoptekst is met opzet een STUK van het
   label: die teksten zijn vertaalbaar, en een toets die op een volledige zin
   staat, zakt bij de eerste taalronde zonder dat er iets stuk is. */
const SCHERMEN = [
  { pad: '/apps/comm.html', balk: '.rtg-suitebar', ook: ['.rtg-suitenav', '.rtg-intel-strip'],
    knop: 'Salon', vrijVan: '.comm' },
  { pad: '/apps/vonk.html', balk: '.rtg-suitebar', ook: ['.rtg-suitenav'] },
  { pad: '/apps/genootschap.html', balk: '.rtg-suitebar', ook: ['.rtg-suitenav'] },
  { pad: '/apps/salon.html', balk: '.rtg-social-commandbar', ook: ['.salon-socialnav'] },
  { pad: '/apps/sociaal.html', balk: '.rtg-social-commandbar' },
  { pad: '/apps/luchthaven.html', balk: '.tos-opsnav' },
  { pad: '/apps/ovcontrol.html', balk: '.tos-opsnav' }
];

/* Deze functies reizen naar de BROWSER, dus ze mogen niets uit deze module
   aanroepen: een helper die hier bestaat, bestaat daar niet. Dat kostte een
   ronde -- `KLAAR is not defined`, en de wacht liep gewoon vijftien seconden
   door voordat hij het zei. */
function geclaimd(gegeven) {
  if (!document.body || document.body.getAttribute('data-rtg-adaptive-ready') !== 'true') return false;
  return gegeven.balken.every(sel => {
    const el = document.querySelector(sel);
    return el && el.classList.contains('rtg-edge-owned-bar');
  });
}

function meet(gegeven) {
  const zichtbaar = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
      r.width > 0 && r.height > 0;
  };
  const nogZichtbaar = gegeven.balken.filter(sel => zichtbaar(document.querySelector(sel)));
  const top = document.querySelector('.rtg-edge-top');
  const topOnder = top && zichtbaar(top) ? top.getBoundingClientRect().bottom : 0;
  const vrij = gegeven.vrijVan ? document.querySelector(gegeven.vrijVan) : null;
  return {
    nogZichtbaar,
    bladActies: Array.from(document.querySelectorAll('.rtg-adaptive-controls .rtg-adaptive-sheet-action'))
      .map(b => (b.textContent || '').trim()),
    topOnder: Math.round(topOnder),
    vrijTop: vrij ? Math.round(vrij.getBoundingClientRect().top) : null
  };
}

/* Het blad opent via de knop die er zelf in zit; geen gesimuleerde toestand. */
function openBlad() {
  const b = document.querySelector('[data-rtg-adaptive-action="context"]');
  if (b) b.click();
}
const bladOpen = () => {
  const s = document.querySelector('.rtg-adaptive-sheet');
  return !!(s && !s.hidden && document.querySelector('.rtg-adaptive-controls'));
};

test('de Edge neemt de eigen balk van een scherm over, met knoppen en ruimte',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-enigebalk-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = async (pad, body, token) => (await fetch(base + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {})
    })).json();
    const stempel = Date.now();
    const lid = await api('/api/auth/register', { name: 'Balkproef', email: 'balk' + stempel + '@v.test',
      phone: '06' + String(stempel).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
    const kantoor = (await api('/api/office/login', { code: 'RTG-OFFICE' })).token;
    await elevateTier(base, lid.token, 'business', kantoor);

    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await context.addInitScript((sleutel) => {
      try { localStorage.setItem('rtg_member_token', sleutel); } catch (e) {}
      try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await context.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));

    for (const scherm of SCHERMEN) {
      const gegeven = { balken: [scherm.balk].concat(scherm.ook || []), vrijVan: scherm.vrijVan || '' };
      await t.test(scherm.pad, async () => {
        await page.goto(base + scherm.pad, { waitUntil: 'domcontentloaded' });
        await wachtTot(page, geclaimd, gegeven,
          { wat: scherm.pad + ': de Edge claimt ' + gegeven.balken.join(' + ') });
        await page.evaluate(openBlad);
        await wachtTot(page, bladOpen, null, { wat: scherm.pad + ': het Edge-blad opent' });
        const m = await page.evaluate(meet, gegeven);

        assert.deepEqual(m.nogZichtbaar, [],
          scherm.pad + ': de Edge heeft deze balk geclaimd en hij staat er nog: ' + m.nogZichtbaar.join(', '));
        /* Oogsten is de andere helft: een geclaimde balk zonder enige knop in
           het blad zou een functie hebben laten verdwijnen. */
        assert.ok(m.bladActies.length > 0, scherm.pad + ': het Edge-blad kreeg geen enkele handeling');
        if (scherm.knop) {
          assert.ok(m.bladActies.some(x => x.includes(scherm.knop)),
            scherm.pad + ': "' + scherm.knop + '" is niet geoogst. Blad: ' + m.bladActies.join(' | '));
        }
        if (scherm.vrijVan) {
          assert.ok(m.vrijTop >= m.topOnder,
            scherm.pad + ': ' + scherm.vrijVan + ' begint op ' + m.vrijTop +
            ' en loopt daarmee onder de Edge-bovenbalk door (die eindigt op ' + m.topOnder + ')');
        }
      });
    }

    /* DE TWEEDE GRENDEL, en die kwam uit een echt gebrek. browser.html heeft
       zijn ADRESBALK in de kop staan: een form met `rtg://` en een invoerveld.
       Het Edge-blad oogst `button` en `a[href]` en kan een invoerveld niet
       dragen, dus die kop claimen betekende de adresbalk kwijt. De toets
       ledenschermen vond het ("browser: zegt niet waar het voor is"); deze
       proef houdt het vast op de plek waar de regel woont. */
    await t.test('een balk met een invoerveld blijft bij het scherm', async () => {
      await page.goto(base + '/apps/browser.html', { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.body &&
        document.body.getAttribute('data-rtg-adaptive-ready') === 'true' &&
        !!document.querySelector('header.ios-nav #adres'), null,
        { wat: 'de adresbalk van browser.html' });
      const balk = await page.evaluate(() => {
        const kop = document.querySelector('header.ios-nav');
        const veld = document.querySelector('header.ios-nav #adres');
        const s = getComputedStyle(kop), r = veld.getBoundingClientRect();
        return { geclaimd: kop.classList.contains('rtg-edge-owned-bar'),
          kopZichtbaar: s.display !== 'none',
          veldZichtbaar: r.width > 0 && r.height > 0 };
      });
      assert.equal(balk.geclaimd, false, 'de Edge claimde een balk met een invoerveld erin');
      assert.equal(balk.kopZichtbaar, true, 'de adresbalk van de browser is van het scherm verdwenen');
      assert.equal(balk.veldZichtbaar, true, 'het adresveld zelf is niet meer te zien');
    });

    /* DE GRENDEL. ios.js plakt `ios-nav` op de hero van rit.html; die is 430px
       hoog en draagt een foto. Zonder deze proef zou een grovere claimregel
       onopgemerkt de inhoud van dat scherm weghalen. */
    await t.test('een hero die alleen de naam draagt, blijft staan', async () => {
      await page.goto(base + '/apps/rit.html', { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.body &&
        document.body.getAttribute('data-rtg-adaptive-ready') === 'true' &&
        !!document.querySelector('header.ritkop.ios-nav'), null,
        { wat: 'de hero van rit.html met zijn ios-nav-klasse' });
      const hero = await page.evaluate(() => {
        const el = document.querySelector('header.ritkop.ios-nav');
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { geclaimd: el.classList.contains('rtg-edge-owned-bar'), positie: s.position,
          hoogte: Math.round(r.height), zichtbaar: s.display !== 'none' && r.height > 0 };
      });
      assert.equal(hero.geclaimd, false, 'de Edge claimde een hero alsof het een balk was');
      assert.equal(hero.zichtbaar, true, 'de hero van rit.html is van het scherm verdwenen');
      assert.ok(hero.hoogte > 200, 'de hero is geen hero meer (' + hero.hoogte + 'px); de grendel toetst niets meer');
    });
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
