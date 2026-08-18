/* SCHERM-TOETS voor de twee kaarten in Mijn backoffice: "Vooruit" en "Uit uw post".

   WAAROM DEZE ER MOET ZIJN. Beide kaarten zijn tot nu toe alleen op API-niveau
   bewezen (test/bureau.test.js, test/postdatum.test.js). Dat toetst wat de
   server ZEGT, niet wat een mens ZIET -- en juist bij deze twee zit de belofte
   in het scherm: "u bevestigt" is een knop, en "niemand heeft dit ingetypt" is
   een regel tekst onder een lijst. Een kaart die niet rendert, of een knop die
   niets doet, is aan de API-kant onzichtbaar.

   DRIE BEWERINGEN, en de derde is de belofte zelf:

   1. Een lid zonder datums krijgt geen lege doos maar een ZIN die zegt dat er
      nog niets staat en waarom dat straks verandert.
   2. Post die binnenkomt verschijnt als VOORSTEL, met de zin waar de datum uit
      komt -- en de tower staat op dat moment nog steeds op nul. Er gaat niets
      vanzelf.
   3. Na EEN klik op "Zet in mijn agenda" staat de regel in Vooruit, en is het
      voorstel weg. Dat is de hele keten door het scherm heen.

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

const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const BERICHT = (naar, onderwerp, tekst) => [
  'From: Balie <balie@buiten.test>', 'To: ' + naar, 'Subject: ' + onderwerp,
  'Date: Tue, 05 Aug 2026 09:00:00 +0000', 'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8', '', tekst, ''
].join('\r\n');

test('Vooruit en Uit uw post: van lege kaart naar een termijn, met EEN klik',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vooruit-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Vooruit Kijker', email: 'vk' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1985-03-03', tier: 'rtg' });
    const adres = (await api(base, '/api/member/rtmail/adres', {}, reg.token)).adres;
    assert.ok(adres, 'het lid heeft een postadres');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);

    /* De weg die een MENS ook loopt: het bedieningspaneel open, en daar de tegel
       "Mijn backoffice". De knop #boBtn zelf is verborgen (os-verborgen-knop) --
       hij is nog wel het model waar de tegel op klikt, maar niet de deur.
       Rechtstreeks op die verborgen knop klikken zou een scherm toetsen dat
       niemand zo bedient. */
    const openBackoffice = async () => {
      await page.goto(base + '/apps/app.html', { waitUntil: 'load' });
      /* Twee dingen liggen modaal over de pagina en vangen elke klik op. De
         knop is dan volgens de driver zichtbaar en klikbaar, en er gebeurt
         alleen niets -- dat kostte hier twee ronden.

         #gate is de toegangspoort; die gaat vanzelf weg zodra het token pakt.
         #onbGate is het onboarding-gesprek, en dat blijft liggen tot de intake
         af is. Dat is CORRECT gedrag: een gratis account hoort eerst vier dingen
         te geven. Wij halen hem weg omdat deze toets over de twee KAARTEN gaat;
         of de onboarding zelf klopt, staat in de aanmeldtoetsen. Zelfde aanpak
         en zelfde voorbehoud als test/werktafel.e2e.js. */
      await page.waitForSelector('#gate', { state: 'hidden', timeout: 20000 });
      await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.remove(); });
      /* HET BEDIENINGSPANEEL OPENEN ZOALS EEN MENS HET DOET.

         Hier stond `click('#osCcBtn')`, en die knop bestaat nog maar draagt
         sinds de OS-verbouwing `.os-verborgen-knop` (`display:none !important`).
         De toets wachtte dus twintig seconden op iets dat nooit zichtbaar wordt.
         De verleiding is om hem met evaluate() alsnog aan te klikken, maar dan
         toetst hij een weg die geen enkele gebruiker heeft -- en dat is precies
         hoe je een scherm groen houdt terwijl het onbruikbaar is.

         De echte weg is een haal vanaf de BOVENRAND (shared/randen.js): begin
         binnen 24 px van de rand en sleep minstens 40 px omlaag. Dat doen we
         hier, met wat marge. */
      await page.mouse.move(200, 5);
      await page.mouse.down();
      await page.mouse.move(200, 40, { steps: 5 });
      await page.mouse.move(200, 90, { steps: 5 });
      await page.mouse.up();
      await page.waitForSelector('#osCcBo', { timeout: 20000 });
      await page.click('#osCcBo');
      /* Wachten op INHOUD en niet op zichtbaarheid: de kaart is een lege div die
         een render later wordt gevuld, en een lege div is voor de driver niet
         zichtbaar. Wie hier op zichtbaarheid wacht, wacht op iets dat pas waar
         wordt door de stap die hij aan het afwachten is. */
      await page.waitForFunction(() => {
        const el = document.querySelector('#boVooruitCard');
        return el && !el.hasAttribute('aria-busy') &&
          (/nog niets met een datum/i.test(el.textContent) || /Automatisch verzameld uit/i.test(el.textContent));
      }, { timeout: 20000 });
    };

    /* ---- 1. Leeg is niet stil ---- */
    await openBackoffice();
    const leeg = await page.evaluate(() => document.querySelector('#boVooruitCard').textContent);
    assert.match(leeg, /nog niets met een datum/i,
      'een lege kaart hoort te zeggen dat er nog niets is: ' + leeg);

    /* ---- 2. Post wordt een VOORSTEL, en verandert de tower nog niet ---- */
    const dag = overDagen(21);
    const binnen = await api(base, '/api/mail/binnen', { bericht: BERICHT(adres,
      'Bevestiging afspraak', 'Beste, uw afspraak staat op ' + dag + ' om 19:30. Tot dan.') });
    assert.equal(binnen.ok, true, JSON.stringify(binnen));

    await openBackoffice();
    await page.waitForFunction(() => {
      const el = document.querySelector('#boPostCard');
      return el && /Zet in mijn agenda/.test(el.textContent);
    }, { timeout: 20000 });
    const voorstel = await page.evaluate(() => document.querySelector('#boPostCard').textContent);
    assert.match(voorstel, /uw afspraak staat op/i, 'de ZIN staat erbij, zodat een mens kan oordelen');
    assert.match(voorstel, /u bevestigt/i, 'en het scherm zegt dat er niets vanzelf gaat');
    assert.match(voorstel, /van buiten/i, 'post van buiten is onbetrouwd, en dat staat erbij');

    // op dit moment staat er nog steeds NIETS in de tower
    const nogLeeg = await page.evaluate(() => document.querySelector('#boVooruitCard').textContent);
    assert.match(nogLeeg, /nog niets met een datum/i,
      'zolang niemand klikt, verandert de tower niet: ' + nogLeeg);

    /* ---- 3. EEN klik, en de keten is rond ---- */
    await page.click('#boPostCard [data-poneem]');
    /* Wachten tot de HERKOMST er staat, en niet tot "er staat niet meer dat het
       leeg is". Na de klik zet de kaart eerst een "…"-plaatshouder neer terwijl
       hij opnieuw ophaalt; die haalt de zwakke voorwaarde meteen, en dan meet
       deze toets de plaatshouder in plaats van het resultaat. */
    await page.waitForFunction(() => {
      const el = document.querySelector('#boVooruitCard');
      return el && /Automatisch verzameld uit/.test(el.textContent);
    }, { timeout: 20000 });

    const na = await page.evaluate(() => document.querySelector('#boVooruitCard').textContent);
    assert.match(na, /Bevestiging afspraak/, 'de afspraak staat nu in Vooruit: ' + na);
    assert.match(na, /Automatisch verzameld uit/, 'met de herkomst erbij');
    assert.match(na, /Agenda/, 'en die herkomst is de agenda, want daar hoort een afspraak te wonen');

    const postNa = await page.evaluate(() => document.querySelector('#boPostCard').textContent);
    assert.doesNotMatch(postNa, /Zet in mijn agenda/,
      'en het voorstel is weg -- er is over besloten: ' + postNa);

    assert.deepEqual(fouten, [], 'geen paginafouten onderweg');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
