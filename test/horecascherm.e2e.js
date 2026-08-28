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
const { startServer, letOpFouten, laadPlaywright, geenBrowser, browserOpties, volgVerzoeken, wachtOpRust,
  wachtOpTekst, wachtOpVerandering, wachtOpZichtbaar, wachtTot, tekstVan } = require('./helper');

const pw = laadPlaywright();
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
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const browserApi = pw.chromium ? pw : null;
    assert.ok(browserApi, 'er is een browser-API');
    browser = await browserApi.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await volgVerzoeken(page);

    /* ---- uitgelogd: een deur, geen leeg scherm ---- */
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
    });
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await wachtOpRust(page);
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
    await wachtOpRust(page);

    await page.fill('#zTafel', 'Tafel 24');
    await page.fill('#zGasten', '2');
    await page.click('#zOpen');
    await wachtOpTekst(page, /Tafel 24/);
    let tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Tafel 24/, 'de open rekening staat in de lijst');

    await page.click('[data-open]');
    await wachtOpRust(page);
    await page.fill('#zNaam', 'Tournedos');
    await page.fill('#zPrijs', '34.50');
    await page.fill('#zAantal', '2');
    await page.fill('#zGang', '2');
    await page.fill('#zStation', 'grill');
    await page.fill('#zAllergie', 'noten');
    await page.click('#zRegel');
    await wachtOpTekst(page, /Tournedos/);
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
    // de stoel komt van de server terug en wordt pas daarna getekend: wachten
    // tot zijn naam echt in het gezelschap staat
    await wachtOpTekst(page, /Bij het raam/, { in: '#zGezelschap' });
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
    /* De STOEL stond er al, dus op zijn naam wachten valt meteen door. Wat
       verandert is de telling erachter (0 -> 1 regel), en die komt pas terug
       nadat de server de regel heeft omgehangen. Vandaar een wacht op een
       nieuwe tekst in plaats van op een bekende: de assertie hieronder blijft
       zo zelf de bewering doen. */
    await wachtOpVerandering(page, '#zGezelschap', tekst);
    tekst = await page.evaluate(() => document.getElementById('zGezelschap').innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Bij het raam .*1 regel/, 'de regel telt nu bij die stoel: ' + tekst.slice(0, 120));

    // de keuken ziet nog niets: de gang is niet vrijgegeven
    await page.click('#tabKeuken');
    await wachtOpTekst(page, /alleen wat de zaal heeft vrijgegeven/i);
    let keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.ok(!/Tournedos/.test(keuken), 'zonder vrijgave staat er niets op het keukenscherm');
    assert.match(keuken, /alleen wat de zaal heeft vrijgegeven/i, 'en het scherm zegt waarom');

    // gang vrijgeven in de zaal, daarna staat hij er wel -- met de allergie
    await page.click('#tabZaal');
    await wachtOpRust(page);
    await page.fill('#zVrijGang', '2');
    await page.fill('#zServeerOm', '19:42');
    await page.click('#zVrij');
    await wachtOpRust(page);
    await page.click('#tabKeuken');
    await wachtOpTekst(page, /Tournedos/);
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
    /* De tabwissel laadt de zaal opnieuw (app.js roept laad() aan) en tekent de
       open rekening opnieuw; pas als dat detail stil ligt, staat er weer een
       rekening waar een regel bij kan. Rust MAG hier: de klik zet zelf meteen
       een verzoek uit, dus er is geen stilte "omdat er nog niets begonnen is". */
    await wachtOpRust(page, '#zDetail');
    await page.fill('#zNaam', 'Kaasplank');
    await page.fill('#zPrijs', '18');
    await page.fill('#zAantal', '1');
    await page.fill('#zGang', '3');
    await page.fill('#zStation', 'koud');
    await page.fill('#zAllergie', '');
    await page.click('#zRegel');
    // de kaasplank moet echt op de rekening staan voordat gang 3 wordt vrijgegeven
    await wachtOpTekst(page, /Kaasplank/, { in: '#zDetail' });

    let lijnDicht = true;
    await page.route('**/api/supplier/horeca/offline/handelingen', async (route) => {
      if (lijnDicht) return route.abort('failed');
      return route.continue();
    });
    await page.fill('#zVrijGang', '3');
    await page.fill('#zServeerOm', '');
    await page.click('#zVrij');
    /* Zonder lijn valt de vrijgave in de wachtrij van dit toestel en zegt het
       scherm dat met zoveel woorden ("Geen lijn..."). Die melding is het teken
       dat de offline-weg is gelopen; de asserties hieronder gaan over de rij
       en de strook, en blijven dus zelf iets bewijzen. */
    await wachtOpTekst(page, /Geen lijn/, { in: '#melding' });
    assert.equal(await page.evaluate(() => window.RTGHorecaEdge.handRij().length), 1,
      'zonder lijn staat de gang op dit toestel');
    assert.equal(await page.evaluate(() => !!document.getElementById('zEdgeStrook').hidden), false,
      'en dat staat op het scherm');
    await page.click('#tabKeuken');
    /* Hier MOET er juist niets verschijnen -- dat is de bewering -- dus is er
       geen tekst om op te wachten. Wachten tot het bord opnieuw is opgehaald en
       stil ligt; de tabwissel start dat verzoek meteen, dus deze rust kan niet
       doorvallen op een scherm dat nog niet begonnen was. */
    await wachtOpRust(page, '#kBord');
    keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.ok(!/Kaasplank/.test(keuken), 'de keuken heeft hem nog niet');

    lijnDicht = false;
    await page.evaluate(() => window.RTGHorecaEdge.handLeeg());
    /* leeg() haalt een pakket pas uit de rij als de SERVER het heeft bevestigd
       (shared/wachtrij.js, regel 3), dus een lege rij is hier het bewijs dat de
       gang is aangekomen -- en pas daarna kan de keuken hem tonen. */
    await wachtTot(page, () => window.RTGHorecaEdge.handRij().length === 0, null,
      { wat: 'de wachtrij van dit toestel leeg (de gang is bevestigd)' });
    assert.equal(await page.evaluate(() => window.RTGHorecaEdge.handRij().length), 0, 'de rij is leeg');
    await page.click('#tabZaal');
    // heen en terug om de keuken te laten herladen; de zaal is klaar zodra zijn
    // lijst met open rekeningen stil ligt
    await wachtOpRust(page, '#zLijst');
    await page.click('#tabKeuken');
    // en nu hoort de gang er WEL te staan: dat is het teken, niet een duur
    await wachtOpTekst(page, /Kaasplank/, { in: '#kBord' });
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
    /* "stap 2 van 3" bestaat alleen op een bord MET een station: zonder filter
       stuurt de server geen mijnStap mee (routes/supplier/horeca/keuken.js).
       Het is dus het eerste dat er nieuw staat zodra het grillbord er is. */
    await wachtOpTekst(page, /stap 2 van 3/, { in: '#kBord' });
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
    /* Het grillbord heeft GEEN statusknoppen (de assertie hierboven), het warme
       wel. Het verschijnen van zo'n knop is dus precies het moment waarop het
       nieuwe bord er staat. */
    await wachtOpZichtbaar(page, '.bon [data-stand]');
    assert.equal(await page.evaluate(() =>
      !!document.querySelector('.bon [data-stand]')), true,
      'het laatste station heeft ze wel');
    await page.fill('#kStation', '');
    await page.click('#kToon');
    /* Zonder filter komt de kaasplank (station koud) terug op het bord; op het
       warme bord stond hij niet. Dat is het teken dat het volle bord er weer
       is -- nodig voor de statusknop die hieronder wordt aangeklikt. */
    await wachtOpTekst(page, /Kaasplank/, { in: '#kBord' });
    assert.match(keuken, /Bij het raam/, 'en de stoel staat op de bon, zodat de runner weet waar het bord heen gaat');
    assert.match(keuken, /aanzetten \d\d:\d\d/, 'de cadans zegt wanneer het aan moet, niet alleen hoe lang het loopt');

    // een stand doorzetten werkt vanaf het keukenscherm
    await page.click('[data-stand="gestart"]');
    await wachtOpTekst(page, /Tafel 24/, { in: '#kRegie' });
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
    // de lijst met open rekeningen komt van de server; zonder Tafel 11 valt er
    // niets te openen
    await wachtOpTekst(page, /Tafel 11/, { in: '#zLijst' });
    await page.evaluate(() => {
      [...document.querySelectorAll('#zLijst [data-open]')]
        .find(b => b.closest('.item').textContent.includes('Tafel 11')).click();
    });
    // het openen haalt de rekening op; pas dan staan de regels er
    await wachtOpTekst(page, /Vergissing/, { in: '#zDetail' });

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
    /* De regel moet WEG zijn, en op iets dat verdwijnt kun je niet met
       wachtOpTekst wachten: hier wachten we tot het detail hem niet meer noemt.
       Pas daarna is de rekening hieronder een eerlijke meting. */
    await wachtTot(page, (s) => {
      const el = document.querySelector(s);
      return !!el && !/Vergissing/.test(el.innerText || el.textContent || '');
    }, '#zDetail', { wat: 'de regel Vergissing van de rekening verdwenen' });
    let stand = (await api('/rekening', { rekeningId: rek3.rekening.id })).rekening;
    assert.equal(stand.regels.length, 1, 'de regel is er echt af');
    assert.equal(stand.totalen.bruto, 2400);

    // korting vraagt een reden, en het SCHERM vraagt hem -- niet pas de server
    await page.fill('#zKortProcent', '10');
    await page.click('#zKorting');
    /* Hier gaat er BEWUST geen verzoek uit: het scherm weigert zelf, zonder de
       server. Er valt dus niets netstil af te wachten -- het enige dat gebeurt,
       is de melding. */
    await wachtOpTekst(page, /Waarom wordt er korting gegeven/, { in: '#melding' });
    let melding = await page.evaluate(() => document.getElementById('melding').innerText);
    assert.match(melding, /Waarom wordt er korting gegeven/, 'zonder reden gebeurt er niets');
    stand = (await api('/rekening', { rekeningId: rek3.rekening.id })).rekening;
    assert.equal(stand.totalen.korting, 0, 'en er staat ook geen korting op');

    await page.fill('#zKortReden', 'stamgast');
    await page.click('#zKorting');
    /* Nu gaat hij WEL naar de server, en de melding verandert pas als die heeft
       geantwoord. Wachten op een verandering ten opzichte van de weigering
       hierboven, zodat de assertie over het bedrag zelfstandig blijft. */
    await wachtOpVerandering(page, '#melding', melding);
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
      /* Kiezen en klikken in dezelfde browsertik. Een vertraagde hertekening
         kan de keuzelijst opnieuw vullen; tussen twee losse Playwright-calls
         kon die daardoor de waarde wissen voordat de klik aankwam. */
      document.getElementById('zVoegSamen').click();
      return o.value;
    });
    assert.equal(gekozen, rek4.rekening.id, 'Tafel 12 staat in de samenvoeglijst');
    /* Wacht op het UNIEKE eindbericht van deze handeling. Alleen "de melding
       veranderde" is te breed: onder runnerbelasting kan een vertraagde
       hertekening van de korting hierboven die voorwaarde al waar maken. */
    await wachtOpTekst(page, /Samengevoegd/, { in: '#melding' });
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
