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
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Kantoor: wat in de specialist staat komt hier terug, en werken doe je daar',
  { skip: geenBrowser(pw) }, async () => {
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

    /* En een afspraak van VANDAAG met een tijd erop. Die hoort ergens anders
       terecht te komen dan die van morgen: op de Command Timeline (laag 3 uit
       CANVAS.md), en juist NIET ook in het register eronder. Dezelfde dag komt
       hier dus uit de agenda -- het scherm rekent hem niet zelf uit. */
    const vandaag = new Date().toISOString().slice(0, 10);
    const nu = await api(base, '/api/agenda/toevoegen',
      { titel: 'Vergadering inkoop', datum: vandaag, tijd: '14:00' }, reg.token);
    assert.ok(nu && !nu.error, 'de afspraak van vandaag hoort in de agenda te landen: ' + JSON.stringify(nu));

    browser = await pw.chromium.launch(browserOpties(pw));
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
      const st = document.querySelector('#stand');
      return {
        regels,
        /* Laag 0 van het Command Canvas (CANVAS.md). Wat er te bewijzen valt is
           niet dat er een woord staat, maar WELK: er staat vandaag iets op de
           agenda, dus de wereld hoort 'Druk' te melden. Zweeg er een bron, dan
           hoort hier 'Onbekend' te staan -- en dat is de enige reden dat dit
           veld het waard is om na te kijken. */
        stand: st ? st.textContent : '',
        niveau: st ? st.getAttribute('data-niveau') : '',
        rust: (document.querySelector('#rust') || {}).textContent || '',
        /* Laag 3: de Command Timeline. Per punt het uur, de titel en waar hij
           heen wijst -- een punt zonder weg is een plaatje van uw dag. */
        lijn: [...document.querySelectorAll('#vandaag .cv-stip')].map(s => ({
          uur: (s.querySelector('.cv-uur') || {}).textContent || '',
          titel: (s.querySelector('.cv-titel') || {}).textContent || '',
          href: (s.querySelector('.cv-wat') || { getAttribute: () => null }).getAttribute('href')
        })),
        lijnZichtbaar: !document.querySelector('#vandaagVak').hidden,
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

    /* 4. LAAG 3: wat vandaag op de klok staat, staat op de tijdlijn -- en daar
       alleen. Het register eronder houdt wat er verder speelt; stond de
       vergadering op allebei, dan staat hetzelfde ding twee keer op een scherm
       dat zijn hele bestaan aan weglaten ontleent. */
    assert.equal(beeld.lijnZichtbaar, true, 'met een afspraak vandaag hoort de tijdlijn te staan');
    assert.deepEqual(beeld.lijn, [{ uur: '14:00', titel: 'Vergadering inkoop', href: '/apps/agenda.html' }],
      'de afspraak van vandaag hoort met haar UUR op de tijdlijn te staan, en naar de agenda te wijzen; ' +
      'gevonden: ' + JSON.stringify(beeld.lijn));
    assert.equal(beeld.regels.filter(r => r.titel.indexOf('Vergadering inkoop') === 0).length, 0,
      'wat op de tijdlijn staat, hoort NIET ook in het register te staan: ' + JSON.stringify(beeld.regels));

    /* Geen storing, dus ook geen storingsmelding -- maar wel een OORDEEL. Hier
       stond alleen dat #stilte leeg was, en die controle bleef ook slagen toen
       dat element verdween: `(null || {}).textContent || ''` is netjes leeg
       (LAT.md regel 9, een toets die niet kan zakken). De stand kan dat niet:
       hij staat er of hij staat er niet, en hij zegt wat hij weet.

       'Druk' en niet 'Operationeel', want er staat vandaag iets: dat is de
       koppeling zelf: de stand is geen sierstrook maar volgt de gegevens. Het
       rustige geval (niets vandaag -> gezond) staat in test/wereldkern.test.js,
       waar het zonder browser te maken is. */
    assert.equal(beeld.niveau, 'aandacht',
      'een afspraak van vandaag maakt de dag druk, gevonden: ' + beeld.niveau);
    assert.match(beeld.stand, /Druk/, 'en Kantoor noemt dat "Druk"');
    assert.match(beeld.rust, /1 zaak die uw aandacht vraagt/,
      'de rustregel hoort de dag in EEN zin te zeggen, gevonden: ' + beeld.rust);
    assert.ok(beeld.rust.indexOf('niet compleet') < 0,
      'zonder storing hoort er niets over stille bronnen te staan: ' + beeld.rust);

    assert.deepEqual(fouten, [], 'de pagina hoort zonder consolefouten te laden');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
