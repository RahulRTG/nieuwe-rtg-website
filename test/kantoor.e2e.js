/* Scherm-test voor RTG Kantoor, de samenhanglaag over de kantoorwereld.

   Wat hier bewezen wordt is de belofte van laag 2 uit PLATFORM.md, en niet of
   de agenda werkt -- dat toetst test/agenda.e2e.js. Drie dingen:

     1. wat u in de SPECIALIST maakt, komt hier vanzelf te staan (want dit
        scherm leest de domeinen en houdt geen eigen lijst bij);
     2. wat hier staat, wijst terug naar diezelfde specialist;
     3. er is geen enkele manier om vanaf dit scherm iets te maken of te
        wijzigen -- zodra die er wel is, is het geen samenhanglaag meer.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Kantoor: wat in de specialist staat komt hier terug, en werken doe je daar',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoor-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Kantoor Echt', email: 'ka' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-03-03', tier: 'rtg' });
    assert.ok(reg.token, 'registreren hoort een token te geven');

    /* IN DE SPECIALIST maken, niet hier. Dat is precies het punt: het scherm
       dat we zo openen heeft deze afspraak nooit gezien en houdt hem ook niet
       bij -- hij komt uit kern/agenda.js. */
    const morgen = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const gemaakt = await api(base, '/api/agenda/toevoegen',
      { titel: 'Bestuursoverleg', datum: morgen, tijd: '09:30' }, reg.token);
    assert.ok(gemaakt && !gemaakt.error, 'de afspraak hoort in de agenda te landen: ' + JSON.stringify(gemaakt));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#werkdag .reis', { timeout: 15000 });

    const beeld = await page.evaluate(() => {
      const regels = [...document.querySelectorAll('#werkdag .reis')].map(a => ({
        titel: (a.querySelector('h3') || {}).textContent || '',
        link: a.getAttribute('href'),
        bron: (a.querySelector('.bron') || {}).textContent || '',
        sig: a.getAttribute('data-sig') || ''
      }));
      return {
        regels,
        stilte: (document.querySelector('#stilte') || {}).textContent || '',
        poorten: [...document.querySelectorAll('.poort')].map(p => p.getAttribute('href')),
        /* Alles waarmee je GEGEVENS zou kunnen veranderen. Twee dingen tellen
           met reden niet mee: de referentieknop kopieert alleen, en de
           hamburger van het app-menu is navigatie -- die staat sinds de
           headerstandaard in de kop van elke app en zegt niets over deze laag.
           Alles wat overblijft is wel een bediening die schrijft, en die hoort
           hier niet te bestaan. */
        schrijfdingen: [...document.querySelectorAll('#inhoud button, #inhoud input, #inhoud textarea, #inhoud select')]
          .filter(e => !e.classList.contains('rtg-ref') && e.id !== 'osMenuBtn')
          .map(e => e.tagName + '.' + (e.className || '-'))
      };
    });

    // 1. wat in de specialist staat, staat hier
    const afspraak = beeld.regels.find(r => r.titel.indexOf('Bestuursoverleg') === 0);
    assert.ok(afspraak, 'de afspraak uit de agenda hoort op het kantoorscherm te staan, ' +
      'gevonden: ' + JSON.stringify(beeld.regels));

    // 2. en wijst terug naar de specialist
    assert.equal(afspraak.link, '/apps/agenda.html',
      'elke regel hoort naar de app te wijzen waar het echte werk gebeurt');
    assert.equal(afspraak.bron, 'Agenda');
    assert.equal(afspraak.sig, 'actief', 'een afspraak van morgen is open, niet dringend');

    // 3. en er valt hier niets te veranderen
    assert.deepEqual(beeld.schrijfdingen, [],
      'op een samenhanglaag hoort geen enkel bedieningselement te staan dat schrijft; ' +
      'gevonden: ' + beeld.schrijfdingen.join(', '));

    // de vier poorten wijzen naar de vier specialisten, en niet naar zichzelf
    assert.deepEqual(beeld.poorten,
      ['/apps/office.html', '/apps/agenda.html', '/apps/notities.html', '/apps/bestanden.html']);

    /* Geen storing, dus ook geen storingsmelding. Andersom is belangrijker en
       staat in test/kantoorwereld.test.js: als een bron WEL zwijgt, hoort dat
       hardop gezegd te worden. */
    assert.equal(beeld.stilte.trim(), '', 'zonder storing hoort er niets over stille bronnen te staan');

    assert.deepEqual(fouten, [], 'de pagina hoort zonder consolefouten te laden');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
