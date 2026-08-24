/* Het horecascherm in een echte browser: /apps/horeca.html.

   Twee dingen worden hier bewezen, en het zijn allebei dingen die van buiten
   niet te zien zijn aan een groene API-toets:

   1. UITGELOGD STAAT ER EEN DEUR, geen leeg scherm en geen omleiding die
      kwijtraakt waar je heen wilde (dezelfde regel als TAKEN 5.5).
   2. INGELOGD DRAAIT DE DIENST ECHT: een rekening openen, een gerecht met een
      ALLERGIE erop, de gang vrijgeven, en dan verschijnt diezelfde bon op het
      keukenscherm MET die allergie in beeld. Dat laatste is de bewering die er
      het meest toe doet -- een allergie die het scherm niet haalt, is precies
      de fout die een horecasysteem niet mag maken.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-horecascherm-'));

async function zaakToken(base) {
  const post = (pad, body) => fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const roster = await post('/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = (roster.staff || []).find(x => x.role === 'manager') || (roster.staff || [])[0];
  assert.ok(mgr, 'de demozaak heeft personeel');
  const inlog = await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' });
  assert.ok(inlog.token, 'de zaak-inlog werkt: ' + JSON.stringify(inlog).slice(0, 120));
  return inlog.token;
}

/* De zaak-API, met het token erin. De meervoudsvariant van deze suite
   (horecaschermen.e2e.js) heeft zijn eigen versie; die is daar gedefinieerd en
   hier dus niet beschikbaar. */
const zaakApi = (base, token) => (pad, body) => fetch(base + '/api/supplier/horeca' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(r => r.json());

test('het horecascherm toont uitgelogd een deur en ingelogd de zaal en de keuken',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const browserApi = pw.chromium ? pw : null;
    assert.ok(browserApi, 'er is een browser-API');
    browser = await browserApi.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- uitgelogd: een deur, geen leeg scherm ---- */
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
    });
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      deur: !!document.querySelector('.rtgdeur'), tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/horeca.html', 'de pagina stuurt niemand weg');
    assert.ok(uit.deur || /personeel|inlog|zaak/i.test(uit.tekst),
      'uitgelogd staat er een deur met een weg vooruit: ' + uit.tekst.slice(0, 160));

    /* ---- ingelogd: de dienst draait ---- */
    const token = await zaakToken(base);
    const api = zaakApi(base, token);
    /* De bereidingsstappen van dit gerecht, vooraf vastgelegd: drie minuten
       marineren, acht grillen, drie saus. Dat maakt de norm 14 en geeft elke
       stap zijn eigen aanzetmoment (kern/horeca/stappen.js). */
    await api('/keuken/stappen', { naam: 'Tournedos', stappen: [
      { station: 'koud', minuten: 3, wat: 'marineren' },
      { station: 'grill', minuten: 8, wat: 'grillen' },
      { station: 'warm', minuten: 3, wat: 'saus afwerken' }
    ] });
    await page.evaluate(t => { localStorage.setItem('rtg_sup_token', t); }, token);
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    await page.fill('#zTafel', 'Tafel 24');
    await page.fill('#zGasten', '2');
    await page.click('#zOpen');
    await page.waitForTimeout(500);
    let tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Tafel 24/, 'de open rekening staat in de lijst');

    await page.click('[data-open]');
    await page.waitForTimeout(400);
    await page.fill('#zNaam', 'Tournedos');
    await page.fill('#zPrijs', '34.50');
    await page.fill('#zAantal', '2');
    await page.fill('#zGang', '2');
    await page.fill('#zStation', 'grill');
    await page.fill('#zAllergie', 'noten');
    await page.click('#zRegel');
    await page.waitForTimeout(500);
    tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Tournedos/, 'de regel staat op de rekening');
    assert.match(tekst, /noten/, 'de allergie staat op het zaalscherm');
    assert.match(tekst, /69[.,]00/, 'het bedrag telt op (2 x 34,50)');

    /* ---- de stoel, van het zaalscherm tot aan de pas ----
       De API heeft hier zijn eigen toets (test/horeca-gezelschap.js). Wat DAAR
       niet uit blijkt is of de bediening er ook bij kan en of de runner het
       ziet -- en dat is precies het gat waar deze suite voor bestaat. */
    await page.fill('#zStoelNaam', 'Bij het raam');
    await page.click('#zStoelBij');
    await page.waitForTimeout(500);
    tekst = await page.evaluate(() => document.getElementById('zGezelschap').innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Bij het raam/, 'de stoel staat op het zaalscherm');
    assert.match(tekst, /Op de tafel/, 'en wat op niemands naam staat, blijft zichtbaar van de tafel');

    // de tournedos naar die stoel, via de keuzelijst naast de regel
    await page.evaluate(() => {
      const rij = [...document.querySelectorAll('#zDetail .item')].find(x => x.textContent.includes('Tournedos'));
      const sel = rij.querySelector('select[data-regelstoel]');
      sel.value = String([...sel.options].find(o => o.text === 'Bij het raam').value);
      sel.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(700);
    tekst = await page.evaluate(() => document.getElementById('zGezelschap').innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Bij het raam .*1 regel/, 'de regel telt nu bij die stoel: ' + tekst.slice(0, 120));

    // de keuken ziet nog niets: de gang is niet vrijgegeven
    await page.click('#tabKeuken');
    await page.waitForTimeout(600);
    let keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.ok(!/Tournedos/.test(keuken), 'zonder vrijgave staat er niets op het keukenscherm');
    assert.match(keuken, /alleen wat de zaal heeft vrijgegeven/i, 'en het scherm zegt waarom');

    // gang vrijgeven in de zaal, daarna staat hij er wel -- met de allergie
    await page.click('#tabZaal');
    await page.waitForTimeout(400);
    await page.fill('#zVrijGang', '2');
    await page.fill('#zServeerOm', '19:42');
    await page.click('#zVrij');
    await page.waitForTimeout(500);
    await page.click('#tabKeuken');
    await page.waitForTimeout(700);
    keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(keuken, /Tournedos/, 'na vrijgave staat de bon op het keukenscherm');
    /* EN DE VRIJGAVE LIEP VIA DE OFFLINE-LAAG, ook nu er gewoon verbinding is.
       Een PDA in een dode hoek van de kelder is geen storing van de zaak: de
       keuken kan online staan terwijl het toestel dat niet is.

       Dat de gang hierboven op het keukenscherm staat bewijst dat de weg WERKT,
       maar niet dat hij LANGS de offline-laag loopt -- rechtstreeks vrijgeven
       geeft precies hetzelfde beeld. Dus wordt de lijn hieronder er echt
       uitgetrokken; alleen dan is het verschil zichtbaar. */
    assert.equal(await page.evaluate(() => window.RTGHorecaEdge.handRij().length), 0,
      'de gang is aangekomen, dus er wacht niets op dit toestel');
    assert.equal(await page.evaluate(() => !!document.getElementById('zEdgeStrook').hidden), true,
      'en de strook is stil, want er staat niets te wachten');

    /* ---- de zaal zonder lijn ---- */
    await page.click('#tabZaal');
    await page.waitForTimeout(400);
    await page.fill('#zNaam', 'Kaasplank');
    await page.fill('#zPrijs', '18');
    await page.fill('#zAantal', '1');
    await page.fill('#zGang', '3');
    await page.fill('#zStation', 'koud');
    await page.fill('#zAllergie', '');
    await page.click('#zRegel');
    await page.waitForTimeout(600);

    let lijnDicht = true;
    await page.route('**/api/supplier/horeca/offline/handelingen', async (route) => {
      if (lijnDicht) return route.abort('failed');
      return route.continue();
    });
    await page.fill('#zVrijGang', '3');
    await page.fill('#zServeerOm', '');
    await page.click('#zVrij');
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.RTGHorecaEdge.handRij().length), 1,
      'zonder lijn staat de gang op dit toestel');
    assert.equal(await page.evaluate(() => !!document.getElementById('zEdgeStrook').hidden), false,
      'en dat staat op het scherm');
    await page.click('#tabKeuken');
    await page.waitForTimeout(600);
    keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.ok(!/Kaasplank/.test(keuken), 'de keuken heeft hem nog niet');

    lijnDicht = false;
    await page.evaluate(() => window.RTGHorecaEdge.handLeeg());
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => window.RTGHorecaEdge.handRij().length), 0, 'de rij is leeg');
    await page.click('#tabZaal');
    await page.waitForTimeout(300);
    await page.click('#tabKeuken');
    await page.waitForTimeout(800);
    keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(keuken, /Kaasplank/, 'en zodra de lijn terug is, staat de gang alsnog bij de keuken');
    assert.match(keuken, /Allergie: noten/, 'met de allergie in een eigen label');
    assert.match(keuken, /serveren 19:42/i, 'en met de gewenste serveertijd');
    assert.match(keuken, /van \d+ min/, 'de looptijd staat naast de norm, niet alleen een kleur');

    /* DE BEREIDINGSSTAPPEN STAAN OP DE BON, elk met zijn eigen aanzetmoment.
       Zonder dit is de hele stappenlaag een rekensom die niemand ziet: de kok
       krijgt nog steeds een gerecht van veertien minuten aan een station in
       plaats van drie handelingen op drie plekken. */
    assert.match(keuken, /marineren/, 'de eerste stap staat op de bon');
    assert.match(keuken, /grillen/, 'de tweede ook');
    assert.match(keuken, /saus afwerken/, 'en de derde');
    assert.match(keuken, /koud/, 'met het station van de stap erbij');
    assert.match(keuken, /van 14 min/, 'en de norm is de som van de stappen (3 + 8 + 3)');
    const stapTijden = await page.evaluate(() =>
      [...document.querySelectorAll('.bon .stappen li')].map(li => li.textContent.replace(/\s+/g, ' ')));
    assert.ok(stapTijden.length >= 3, 'de stappen staan als eigen lijst: ' + JSON.stringify(stapTijden));
    assert.ok(stapTijden.every(t => /\d\d:\d\d/.test(t)), 'elk met een aanzettijd: ' + JSON.stringify(stapTijden));

    /* EEN STAP STUURT HET STATIONSBORD. Op het bord van de GRILL staat het
       gerecht met de grill-stap groot, en de statusknoppen staan er NIET -- het
       warme station maakt af en meldt klaar. Zou de grill dat mogen, dan staat
       er een bord bij de pas dat niet af is. */
    await page.fill('#kStation', 'grill');
    await page.click('#kToon');
    await page.waitForTimeout(700);
    const grill = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(grill, /Tournedos/, 'de tournedos staat op het bord van de grill');
    assert.match(grill, /grillen/, 'met de eigen stap van dit station');
    assert.match(grill, /stap 2 van 3/, 'en waar die stap in de rij staat');
    assert.match(grill, /komt van koud/, 'met wat ervoor komt');
    assert.match(grill, /gaat naar warm/, 'en wat erna');
    assert.match(grill, /warm maakt af en meldt klaar/i, 'en wie hem afmaakt');
    assert.equal(await page.evaluate(() =>
      !!document.querySelector('.bon [data-stand]')), false,
      'de grill heeft geen statusknoppen: die horen bij het laatste station');

    await page.fill('#kStation', 'warm');
    await page.click('#kToon');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() =>
      !!document.querySelector('.bon [data-stand]')), true,
      'het laatste station heeft ze wel');
    await page.fill('#kStation', '');
    await page.click('#kToon');
    await page.waitForTimeout(500);
    assert.match(keuken, /Bij het raam/, 'en de stoel staat op de bon, zodat de runner weet waar het bord heen gaat');
    assert.match(keuken, /aanzetten \d\d:\d\d/, 'de cadans zegt wanneer het aan moet, niet alleen hoe lang het loopt');

    // een stand doorzetten werkt vanaf het keukenscherm
    await page.click('[data-stand="gestart"]');
    await page.waitForTimeout(600);
    const regie = await page.evaluate(() => document.getElementById('kRegie').innerText.replace(/\s+/g, ' '));
    assert.match(regie, /Tafel 24/, 'de tafel staat op het regiescherm');

    /* ---- de handelingen OP een rekening ----
       Achttien endpoints hadden geen scherm; dit zijn de vijf die een bediening
       elk uur nodig heeft. Het scherpst bij `regel/weg`: je kon iets op een
       rekening zetten en er niets meer af halen. */
    const rek3 = await api('/rekening/open', { kanaal: 'tafel', tafel: 'Tafel 11', gasten: 2 });
    await api('/rekening/regel', { rekeningId: rek3.rekening.id, naam: 'Oesters', prijs: 24, station: 'koud', gang: 1 });
    await api('/rekening/regel', { rekeningId: rek3.rekening.id, naam: 'Vergissing', prijs: 99, station: 'koud', gang: 1 });
    const rek4 = await api('/rekening/open', { kanaal: 'tafel', tafel: 'Tafel 12', gasten: 2 });
    await api('/rekening/regel', { rekeningId: rek4.rekening.id, naam: 'Wijn', prijs: 40, station: 'bar', gang: 0 });

    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      [...document.querySelectorAll('#zLijst [data-open]')]
        .find(b => b.closest('.item').textContent.includes('Tafel 11')).click();
    });
    await page.waitForTimeout(900);

    // een misgetikte regel eraf, zolang de keuken er niet aan begon
    const eraf = await page.evaluate(() => {
      const rij = [...document.querySelectorAll('#zDetail .item')].find(x => x.textContent.includes('Vergissing'));
      return rij && !!rij.querySelector('[data-regelweg]');
    });
    assert.ok(eraf, 'een niet-vrijgegeven regel krijgt een eraf-knop');
    await page.evaluate(() => {
      [...document.querySelectorAll('#zDetail .item')].find(x => x.textContent.includes('Vergissing'))
        .querySelector('[data-regelweg]').click();
    });
    await page.waitForTimeout(900);
    let stand = (await api('/rekening', { rekeningId: rek3.rekening.id })).rekening;
    assert.equal(stand.regels.length, 1, 'de regel is er echt af');
    assert.equal(stand.totalen.bruto, 2400);

    // korting vraagt een reden, en het SCHERM vraagt hem -- niet pas de server
    await page.fill('#zKortProcent', '10');
    await page.click('#zKorting');
    await page.waitForTimeout(500);
    let melding = await page.evaluate(() => document.getElementById('melding').innerText);
    assert.match(melding, /Waarom wordt er korting gegeven/, 'zonder reden gebeurt er niets');
    stand = (await api('/rekening', { rekeningId: rek3.rekening.id })).rekening;
    assert.equal(stand.totalen.korting, 0, 'en er staat ook geen korting op');

    await page.fill('#zKortReden', 'stamgast');
    await page.click('#zKorting');
    await page.waitForTimeout(900);
    stand = (await api('/rekening', { rekeningId: rek3.rekening.id })).rekening;
    assert.equal(stand.totalen.korting, 240, '10% van 24,00');

    // samenvoegen VERPLAATST: de som is precies het geheel
    const voor = stand.totalen.netto;
    const ander = (await api('/rekening', { rekeningId: rek4.rekening.id })).rekening.totalen.netto;
    /* De juiste rekening KIEZEN en niet de eerste pakken: er staan er meer open
       (Tafel 24 uit het eerste deel van deze toets), en selectedIndex 1 pakte
       die. Dan meet de assertie hieronder iets anders dan er gebeurt. */
    const gekozen = await page.evaluate(() => {
      const s = document.getElementById('zSamenMet');
      const o = [...s.options].find(x => x.text.indexOf('Tafel 12') === 0);
      if (!o) return null;
      s.value = o.value;
      return o.value;
    });
    assert.equal(gekozen, rek4.rekening.id, 'Tafel 12 staat in de samenvoeglijst');
    await page.click('#zVoegSamen');
    await page.waitForTimeout(1200);
    stand = (await api('/rekening', { rekeningId: rek3.rekening.id })).rekening;
    assert.equal(stand.totalen.netto, voor + ander, 'samenvoegen brengt geen cent bij of af');
    melding = await page.evaluate(() => document.getElementById('melding').innerText);
    assert.match(melding, /Samengevoegd/, 'en het scherm zegt het bedrag hardop terug');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
