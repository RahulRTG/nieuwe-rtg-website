/* PDA SERVICE in een echte browser: /apps/horeca-pda.html.

   De rekensom staat vast in test/horeca-werklijst.test.js. Wat hier bewezen
   wordt, is het deel dat een groene API-toets niet ziet: dat de bediening met
   deze lijst werkelijk kan werken.

   1. UITGELOGD STAAT ER EEN DEUR, geen leeg scherm (TAKEN 5.5).
   2. DE TWEE LIJSTEN STAAN ER ALLEBEI, en de scheiding is zichtbaar: een tafel
      die openstaat zonder bestelling staat NIET tussen de taken die over hun
      grens zijn -- ook niet als hij het langst wacht.
   3. EEN VERZOEK VAN EEN GAST KOMT HIER BINNEN EN GAAT ER WEER UIT. Oppakken en
      afronden zijn twee knoppen, en na "Ik ga" staat er wie het heeft.
   4. EEN COMPLETE GANG IS EEN DRAAGTAAK MET DE BORDEN EN DE ALLERGIE EROP. Een
      allergie die de drager niet ziet, is de fout die dit huis niet mag maken.
   5. DE MODUS IS EEN LENS: de runner ziet de gang wel en het verzoek niet, en
      de host ziet de aankomsten die de anderen niet zien.
   6. HET SCHERM VINKT NIETS ZELF AF: na "Ik draag hem" staat de bon nog steeds
      op klaar, en pas "Uitgegeven" haalt hem van de lijst.
   7. DE WIJK IS EEN TWEEDE LENS, NAAST DE MODUS, en hij zegt wat hij niet
      toont. Een filter dat zwijgt over wat het wegliet, is een filter waarin
      werk verdwijnt.
   8. DE HELE KETEN DRAAIT OP DIT SCHERM: een tafel openen, van de kaart
      bestellen, de gang naar de keuken sturen en afrekenen. En de PRIJS komt
      van de kaart en niet van de telefoon -- dat is de bewering die het meest
      kost als hij niet klopt.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpTekst, wachtOpZichtbaar, wachtOpVerandering, klikEnWacht, tekstVan } = require('./helper');
const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pda-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de PDA toont uitgelogd een deur en ingelogd een werkbare servicelijst',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- uitgelogd: een deur ---- */
    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
      localStorage.removeItem('rtg_pda_modus');
    });
    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    /* Uitgelogd tekent shared/deur.js de deur IN de pagina (geen omleiding), en
       pas in een setTimeout na het laden. Deze wacht is met opzet net zo ruim als
       de bewering eronder: de deur zelf, of de tekst die naar de personeelsinlog
       wijst -- anders zou de wacht strenger zijn dan wat de toets beweert. */
    await wachtTot(page, () => !!document.querySelector('.rtgdeur') ||
      /personeel|inlog|zaak/i.test(document.body.innerText), null,
      { wat: 'de deur voor wie uitgelogd komt' });
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      deur: !!document.querySelector('.rtgdeur'), tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/horeca-pda.html', 'de pagina stuurt niemand weg');
    assert.ok(uit.deur || /personeel|inlog|zaak/i.test(uit.tekst),
      'uitgelogd staat er een deur: ' + uit.tekst.slice(0, 140));

    /* ---- de zaak opstellen ---- */
    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const tok = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    assert.ok(tok, 'de zaak-inlog werkt');
    const H = (pad, body) => post(base, pad, body, tok);

    // een tafel met een complete gang met een allergie erop: een draagtaak
    const draag = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'PDA-DRAAG', gasten: 2 })).body.rekening;
    const regel = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: draag.id, naam: 'Tournedos', prijs: 34.5,
      aantal: 1, gang: 1, station: 'grill', allergie: 'noten' })).body.regel;
    await H('/api/supplier/horeca/gang/vrij', { rekeningId: draag.id, gang: 1 });
    await H('/api/supplier/horeca/keuken/stand', { rekeningId: draag.id, regelId: regel.id, stand: 'klaar' });

    // een tafel die openstaat zonder bestelling: geen grens, dus nooit in "nu"
    await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'PDA-LEEG', gasten: 4 });

    /* En een halve gang met een afgesproken serveertijd die AL VOORBIJ is: die
       is over zijn grens (het serveermoment zelf) en hoort dus in "nu". Twintig
       minuten terug, in de tijd van deze machine -- dezelfde tijd waarmee
       kern/horeca/cadans.js rekent.

       MAAR NOOIT OVER MIDDERNACHT HEEN, en dat is dezelfde valkuil als bij de
       aankomststroom verderop -- alleen andersom. Een serveertijd is een
       KLOKTIJD (HH:MM) zonder datum, en kern/horeca/cadans-doel.js hangt hem
       aan de dag van het anker en rolt hem vooruit als hij meer dan zes uur in
       het verleden zou liggen. Dat is bewust: een zaak die na middernacht
       doorloopt spreekt om 23:00 "00:30" af en bedoelt straks.

       Om 00:09 rekent deze toets 20 minuten terug, komt op "23:49", en de
       server leest dat als VANAVOND -- bijna 24 uur vooruit in plaats van
       twintig minuten terug. Dan staat er niets over zijn grens en zakt de
       bewering hieronder op de klok in plaats van op de code. Gemeten in CI-run
       33452968389, die om 00:09 UTC startte.

       Dus: nooit voorbij middernacht terug. En de gang moet minstens een hele
       minuut over zijn, want `doelOver` wordt op hele minuten AFGEROND en de
       werklijst neemt hem pas op bij `< 0` -- dertig seconden te laat is voor
       die lijst nul. Valt de start in de eerste twee minuten van een dag, dan
       bestaat de voorwaarde van deze toets domweg niet en wachten we hem uit;
       overslaan zou een bewering wegpoetsen die het hele scherm draagt. */
    const middernacht = new Date(); middernacht.setHours(0, 0, 0, 0);
    const RUIMTE = 2 * 60000;
    if (Date.now() - middernacht.getTime() < RUIMTE) {
      await new Promise((r) => setTimeout(r, RUIMTE - (Date.now() - middernacht.getTime()) + 1000));
    }
    const toen = new Date(Math.max(Date.now() - 20 * 60000, middernacht.getTime() + 60000));
    const serveerOm = String(toen.getHours()).padStart(2, '0') + ':' + String(toen.getMinutes()).padStart(2, '0');
    const laat = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'PDA-LAAT', gasten: 2 })).body.rekening;
    const l1 = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: laat.id, naam: 'Tartaar', prijs: 22, aantal: 1, gang: 1, station: 'koud' })).body.regel;
    await H('/api/supplier/horeca/rekening/regel', { rekeningId: laat.id, naam: 'Zeebaars', prijs: 29, aantal: 1, gang: 1, station: 'warm' });
    await H('/api/supplier/horeca/gang/vrij', { rekeningId: laat.id, gang: 1, serveerOm });
    await H('/api/supplier/horeca/keuken/stand', { rekeningId: laat.id, regelId: l1.id, stand: 'klaar' });

    // en een gast die om hulp vraagt: grens 3 minuten
    const qr = (await H('/api/supplier/horeca/gast/qr', { tafel: 'PDA-DRAAG' })).body;
    const aan = (await post(base, '/api/gast/aanschuiven', { token: qr.token, naam: 'Sam' })).body;
    assert.ok(aan.sleutel, 'de gast zit aan tafel');
    const vz = (await post(base, '/api/gast/verzoek', { sleutel: aan.sleutel, soort: 'hulp',
      tekst: 'Het glas is gebarsten' })).body;
    assert.ok(vz.verzoek, 'het verzoek staat: ' + JSON.stringify(vz).slice(0, 120));

    /* ---- ingelogd: de lijst ---- */
    await page.evaluate(t => { localStorage.setItem('rtg_sup_token', t); }, tok);
    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    /* De werklijst tekent zichzelf in EEN keer: de werkstanden, "nu", "ook open"
       en de wijken komen alle vier uit hetzelfde antwoord. De vier knoppen zijn
       dus het teken dat het hele beeld er staat -- en het is meteen de eerste
       bewering hieronder. */
    await wachtTot(page, () => document.querySelectorAll('#pModi button').length >= 4, null,
      { wat: 'de vier werkstandknoppen van de werklijst' });

    const lees = () => page.evaluate(() => ({
      nu: document.getElementById('pNu').innerText.replace(/\s+/g, ' '),
      open: document.getElementById('pOpen').innerText.replace(/\s+/g, ' '),
      modi: [...document.querySelectorAll('#pModi button')].map(b => b.textContent)
    }));

    /* DE LENS-KNOPPEN (modus en wijk) krijgen hun aria-pressed uit het ANTWOORD
       van de server (`d.modus` / `d.wijk`), in dezelfde hertekening als de twee
       lijsten. Wachten tot de aangetikte knop ingedrukt STAAT is dus wachten tot
       het nieuwe beeld er is, en niet tot de klik geregistreerd is. Dat is hier
       belangrijk omdat de beweringen na een lenswissel deels ONTKENNEND zijn: op
       het oude beeld gelezen zouden ze zakken zonder dat er iets stuk is. */
    const lensAan = (sel) => wachtTot(page, (s) => {
      const b = document.querySelector(s);
      return !!b && b.getAttribute('aria-pressed') === 'true';
    }, sel, { wat: sel + ' ingedrukt (dus opnieuw getekend)' });
    let beeld = await lees();
    assert.deepEqual(beeld.modi, ['Bediening', 'Runner', 'Host', 'Alles'], 'de vier werkstanden staan er');

    /* 2. de scheiding. Alleen wat over een vastgelegde grens is, staat in "nu";
       een tafel zonder bestelling heeft geen grens en komt er dus nooit in, hoe
       lang hij ook staat. */
    assert.match(beeld.nu, /PDA-LAAT/, 'de gang die zijn serveermoment voorbij is, staat in "nu"');
    assert.match(beeld.nu, /serveermoment|op tafel staan/i, 'met de reden erbij');
    assert.doesNotMatch(beeld.nu, /PDA-LEEG/, 'een tafel zonder grens staat niet in "nu"');
    assert.match(beeld.open, /PDA-LEEG/, 'maar wel in "ook open"');
    assert.match(beeld.open, /nergens vastgelegd/, 'met de reden erbij');

    /* 4. de draagtaak, met bord en allergie. Hij staat nog in "ook open": hij is
       net klaar gemeld en dus nog binnen de pasmarge -- precies zoals het hoort. */
    assert.match(beeld.open, /PDA-DRAAG/, 'de complete gang staat als taak');
    assert.match(beeld.open, /Tournedos/, 'met het bord erop');
    assert.match(beeld.open, /noten/i, 'en met de allergie in beeld');
    assert.match(beeld.open, /pas/i, 'en met de rekensom van de pasmarge');

    /* 3. het verzoek oppakken */
    assert.match(beeld.nu + beeld.open, /gebarsten/, 'het verzoek van de gast staat er');
    /* EEN VERWIJZING EN GEEN VASTE HANDLE, en dat is met schade geleerd bij de
       knop hieronder. `page.$()` levert een handle naar DIT element; pakt de
       PDA een taak op, dan hertekent hij de kaart en is dat element weg. De
       klik komt dan uit op iets wat niet meer in het document staat
       ("Element is not attached to the DOM"). Een locator zoekt op het moment
       van klikken opnieuw en wacht tot het element stabiel is -- dat is precies
       wat een scherm doet dat zichzelf hertekent. */
    const gaan = page.locator('[data-stand="opgepakt"]');
    assert.ok(await gaan.count(), 'er staat een knop "Ik ga"');
    await gaan.first().click();
    // oppakken hertekent de kaart met de naam van wie het heeft: dat is het teken
    await wachtOpTekst(page, /U heeft dit opgepakt/);
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /U heeft dit opgepakt/, 'na oppakken staat er wie het heeft');

    /* 6. oppakken van een gang vinkt niets af */
    const pak = page.locator('[data-pak]');
    assert.ok(await pak.count(), 'er staat een knop om de gang te dragen');
    await pak.first().click();
    /* Opgepakt betekent dat "Ik draag hem" plaatsmaakt voor "Loslaten" (pda-taak.js).
       Staat [data-pak] er nog, dan is de claim niet verwerkt -- en dan zou de vraag
       aan de server hieronder een oude stand lezen. Op de tekst "U heeft dit
       opgepakt" kan hier niet gewacht worden: die staat al bij het verzoek. */
    await wachtTot(page, () => !document.querySelector('[data-pak]'), null,
      { wat: 'de gang opgepakt (de knop "Ik draag hem" is weg)' });
    const naPak = (await H('/api/supplier/horeca/rekening', { rekeningId: draag.id })).body.rekening;
    assert.equal(naPak.regels[0].stand, 'klaar', 'het bord staat nog op klaar, niet op uitgegeven');
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /PDA-DRAAG/, 'en de taak staat er nog, want hij is niet uitgegeven');

    /* 5. de modus is een lens */
    await page.click('[data-modus="runner"]');
    await lensAan('[data-modus="runner"]');
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /PDA-DRAAG/, 'de runner ziet de gang');
    assert.doesNotMatch(beeld.nu + beeld.open, /gebarsten/, 'en niet het verzoek van de gast');
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-LEEG/, 'en niet de lege tafel');
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-LAAT/, 'en niet de halve gang van de keuken');

    /* en uitgeven haalt hem er wel af */
    await page.click('[data-uit]');
    /* Uitgeven haalt de draagtaak van de lijst, en in de runner-lens staan alleen
       pas-taken -- dus verdwijnt met die ene taak ook zijn knop. Dat is het teken
       dat de server klaar is met /pas/uit; de vraag eronder gaat rechtstreeks
       naar hem toe en zou anders te vroeg komen. */
    await wachtTot(page, () => !document.querySelector('[data-uit]'), null,
      { wat: 'de draagtaak weg (geen knop "Uitgegeven" meer)' });
    const naUit = (await H('/api/supplier/horeca/rekening', { rekeningId: draag.id })).body.rekening;
    assert.equal(naUit.regels[0].stand, 'uitgegeven', 'nu pas is hij uitgegeven');
    beeld = await lees();
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-DRAAG/, 'en dan is de taak weg');

    /* ---- 5b. de host ziet de aankomststroom ----
       Een belofte die op een persoonlijke controle wacht, staat met naam en al
       op de kaart -- een host die eerst een ander scherm moet openen om te zien
       WELKE belofte wacht, heeft geen werklijst maar een verwijzing. */
    /* Datum EN tijd komen uit hetzelfde moment. Nemen we de tijd van de klok
       (die over middernacht rolt) en de datum van vandaag (die dat niet doet),
       dan wijst dat paar tussen 22:00 en 24:00 uur 22 uur TERUG -- de route
       laat dat door (alleen `datum < vandaag()` wordt gekeurd), zet vervaltAt
       op aankomst + 12 uur, en dan gooit de werklijst de aankomst weg omdat
       hij verlopen is. Deze toets zakte daardoor elke avond na tienen. */
    const tijd = new Date(Date.now() + 2 * 3600000);
    const hh = String(tijd.getHours()).padStart(2, '0') + ':' + String(tijd.getMinutes()).padStart(2, '0');
    const dag = tijd.getFullYear() + '-' + String(tijd.getMonth() + 1).padStart(2, '0') +
      '-' + String(tijd.getDate()).padStart(2, '0');
    const pass = (await post(base, '/api/arrival/request', {
      requestToken: 'pdahostaanvraagcode1234.geheimgeheimgeheim1234ab',
      supplierCode: 'KIKUNOI', naam: 'Aankomst', datum: dag,
      tijd: hh, personen: 2, allergie: true })).body.pass;
    assert.ok(pass, 'de aankomst is aangevraagd');

    await page.click('[data-modus="host"]');
    await lensAan('[data-modus="host"]');
    let host = await lees();
    assert.match(host.nu + host.open, /Aankomst /, 'de aankomst staat op de lijst van de host');
    /* De beloften als LIJST, niet alleen als knoplabel: de statustekst
       ("wacht-op-mens") staat alleen in de lijst, dus die onderscheidt de twee.
       Zonder dat onderscheid blijft deze toets groen als de lijst verdwijnt en
       er alleen knoppen overblijven -- en dan ziet een host niet wat er wacht
       maar alleen wat hij kan indrukken. */
    assert.match(host.nu + host.open, /Allergiebriefing keuken/, 'met de belofte die wacht');
    assert.match(host.nu + host.open, /wacht-op-mens/, 'met de stand van die belofte erbij');
    assert.doesNotMatch(host.nu + host.open, /Operationele capaciteit/,
      'en niet met wat al berekend is: dat wacht op niemand');

    /* EEN KNOP PER BELOFTE, en niet een voor alle. "Persoonlijk gecontroleerd"
       betekent dat iemand het werkelijk heeft gedaan; een knop die er drie
       tegelijk afvinkt maakt van die zin een formaliteit. Dus tikken we ze hier
       ook stuk voor stuk aan. */
    const knoppen = await page.$$('[data-belofte]');
    assert.ok(knoppen.length >= 2, 'elke wachtende belofte heeft een eigen knop: ' + knoppen.length);
    for (let i = 0; i < knoppen.length + 2; i++) {
      const hoeveel = (await page.$$('[data-belofte]')).length;
      if (!hoeveel) break;
      /* KLIKKEN OP DE SELECTOR EN NIET OP EEN VASTGEHOUDEN HANDVAT. Tussen het
         opvragen van het element en de klik tekent de lijst zichzelf opnieuw --
         elke aftekening haalt er een belofte uit -- en dan klikt playwright op
         een knoop die niet meer in de DOM hangt: "Element is not attached to
         the DOM". Gemeten in een volle schermronde op 1 september 2026, op
         regel 280. page.click() zoekt de knop opnieuw op en wacht tot hij
         stabiel is; een elementHandle doet dat allebei niet. */
      await page.click('[data-belofte]');
      /* Elke aftekening haalt EEN belofte weg (hij wacht niet meer op een mens),
         en met de laatste verdwijnt de hele aankomsttaak. Het aantal knoppen is
         dus de teller die verandert; wachten op een tekst kan hier niet, want wat
         er komt te staan verschilt per ronde. */
      await wachtTot(page, (n) => document.querySelectorAll('[data-belofte]').length < n, hoeveel,
        { wat: 'een belofte minder die op een mens wacht' });
    }
    host = await lees();
    assert.doesNotMatch(host.nu + host.open, /Aankomst /,
      'na het aftekenen wacht er niets meer, dus is het geen taak meer');

    /* EN DE BELOFTE IS BEVESTIGD, NIET AFGEWEZEN. Die twee halen allebei de
       taak van de lijst, maar voor de gast is het verschil enorm: bevestigd
       betekent "wij regelen het", afgewezen betekent "dit gaat niet lukken".
       Een knop die "gecontroleerd" heet en het tweede doet, is een leugen. */
    const arrivals = (await H('/api/supplier/horeca/arrivals', {})).body;
    const naAf = arrivals.arrivals.find(x => x.id === pass.id);
    assert.ok(naAf, 'de pass bestaat nog');
    assert.equal(arrivals.openBeloften, 0, 'en er wacht niets meer op een mens');
    const volle = (await H('/api/supplier/horeca/arrivals', {})).body.arrivals.find(x => x.id === pass.id);
    const standen = (volle.beloften || []).map(b => b.status);
    assert.ok(standen.length, 'de beloften staan er nog: ' + JSON.stringify(standen));
    assert.ok(!standen.includes('niet-mogelijk'),
      'geen enkele belofte is afgewezen: ' + standen.join(', '));
    assert.ok(standen.some(x => x === 'persoonlijk-bevestigd'),
      'ze zijn persoonlijk bevestigd: ' + standen.join(', '));

    await page.click('[data-modus="alles"]');
    await lensAan('[data-modus="alles"]');

    /* ---- 7. de wijklens ----
       De modus filtert op SOORT werk, de wijk op WIENS tafel het is. Twee
       lenzen, twee rijen knoppen: samengevoegd zou "runner in mijn wijk"
       onmogelijk zijn. */
    /* Nog een keer "Alles": die lens stond er al op, dus er verandert niets aan
       het scherm en lensAan() zou meteen doorvallen. Het enige eerlijke teken is
       hier het ANTWOORD van /werklijst op deze klik. */
    await klikEnWacht(page, '[data-modus="alles"]', '/horeca/werklijst');

    const wijk = (await H('/api/supplier/horeca/wijk/zet', { naam: 'Terras', tafels: ['PDA-DRAAG'] })).body.wijk;
    await H('/api/supplier/horeca/wijk/neem', { wijkId: wijk.id });
    await page.click('#pVerversNu');
    /* De wijk is zojuist via de API gezet en genomen; hij bestond nog niet op het
       scherm ("Er zijn nog geen wijken"). Zijn naam in het wijkbeeld is dus het
       teken dat deze ververs binnen is. */
    await wachtOpTekst(page, /Terras/, { in: '#pWijken' });

    const wijkbeeld = await page.evaluate(() => document.getElementById('pWijken').innerText.replace(/\s+/g, ' '));
    assert.match(wijkbeeld, /Terras/, 'de wijk staat in het wijkbeeld');
    assert.match(wijkbeeld, /draagt deze wijk/, 'met wie hem draagt');
    assert.match(wijkbeeld, /Zonder wijk/, 'en de tafels die in geen wijk zitten staan er apart');

    await page.click('[data-wijklens="mijn"]');
    await lensAan('[data-wijklens="mijn"]');
    let beeldW = await lees();
    assert.match(beeldW.nu + beeldW.open, /PDA-DRAAG/, 'mijn eigen wijk staat er');
    assert.match(beeldW.nu + beeldW.open, /PDA-LEEG/, 'een tafel zonder wijk is van iedereen');
    const uitleg = await page.evaluate(() => document.getElementById('pWijkUit').textContent);
    assert.match(uitleg, /Terras/, 'het scherm zegt welke wijk u draagt: ' + uitleg);
    assert.match(uitleg, /niets buiten|niet getoond/, 'en of er iets buiten valt');

    /* Nu de wijk loslaten: dan is hij van niemand, dus van iedereen -- en de
       tafel hoort NIET te verdwijnen. */
    await page.click('[data-wijklaat]');
    /* Losgelaten = het wijkbeeld zegt dat niemand hem meer draagt (pda-wijk.js).
       Die zin komt uit dezelfde hertekening als de twee lijsten hieronder, dus is
       hij het teken dat het scherm de nieuwe verdeling toont. */
    await wachtOpTekst(page, /Niemand draagt deze wijk/, { in: '#pWijken' });
    beeldW = await lees();
    assert.match(beeldW.nu + beeldW.open, /PDA-DRAAG/,
      'een wijk die niemand draagt is van iedereen; de tafel verdwijnt niet');

    /* ---- 7b. een aanbod komt aan bij wie LOOPT ----
       Overdragen zelf gebeurt op de vloer, waar de hele verdeling erbij staat.
       Maar wie een wijk aangeboden krijgt, staat op dat moment met dit toestel
       in zijn hand -- en zolang hij niet antwoordt, draagt zijn collega het nog.
       Dus hoort het AANTAL hier te staan, met de weg ernaartoe. */
    const bram = (await post(base, '/api/supplier/staff/add', { name: 'Bram' }, tok)).body;
    const tokB = (await post(base, '/api/supplier/login',
      { code: 'KIKUNOI', staffId: bram.staff.id, pin: bram.pin })).body.token;
    const eigen = (await post(base, '/api/supplier/horeca/wijk/zet',
      { naam: 'Serre', tafels: ['PDA-BOD'] }, tok)).body.wijk;
    await post(base, '/api/supplier/horeca/wijk/neem', { wijkId: eigen.id }, tokB);
    const bod = await post(base, '/api/supplier/horeca/wijk/bied',
      { wijkId: eigen.id, naarId: String(mgr.id), naarNaam: mgr.name }, tokB);
    assert.equal(bod.status, 200, JSON.stringify(bod.body));

    await page.click('#pVerversNu').catch(() => {});
    /* Het aanbod komt uit hetzelfde werklijst-antwoord als het wijkbeeld
       (`voorMij`), dus deze zin is het teken dat het blok opnieuw getekend is met
       de overdracht erin. */
    await wachtOpTekst(page, /Er ligt een aanbod voor u/, { in: '#pWijken' });
    const metBod = await page.evaluate(() => document.getElementById('pWijken').innerText.replace(/\s+/g, ' '));
    assert.match(metBod, /Er ligt een aanbod voor u/, 'het aanbod staat op de PDA: ' + metBod);
    assert.match(metBod, /draagt uw collega het nog/, 'met wat er tot dan geldt');
    assert.ok(await page.$('a[href="/apps/horeca-vloer.html"]'), 'met de weg naar de vloer erbij');

    await post(base, '/api/supplier/horeca/wijk/trek-in',
      { overdrachtId: bod.body.overdracht.id }, tokB);

    await page.click('[data-wijklens="alles"]');
    await lensAan('[data-wijklens="alles"]');

    /* ---- 8. de hele keten op dit scherm ---- */
    await page.click('#tTerug').catch(() => {});
    /* Het tafelvenster stond hier nog niet open, dus die klik doet meestal niets.
       Wat de regels hieronder nodig hebben is dat de WERKLIJST in beeld is: daar
       staan #pNieuwTafel en #pNieuw op. */
    await wachtOpZichtbaar(page, '#pLijst');

    // ONTVANGEN
    await page.fill('#pNieuwTafel', 'PDA-KETEN');
    await page.fill('#pNieuwGasten', '3');
    await page.click('#pNieuw');
    /* Openen wisselt van venster EN haalt daarna de rekening op; de kop draagt de
       tafelnaam pas als dat allebei gebeurd is -- en dat is precies wat de twee
       beweringen hieronder lezen. */
    await wachtOpTekst(page, /PDA-KETEN/, { in: '#tKop' });
    assert.equal(await page.evaluate(() => document.getElementById('pTafel').hidden), false,
      'na het openen staat de tafel in beeld');
    assert.match(await page.evaluate(() => document.getElementById('tKop').textContent),
      /PDA-KETEN/, 'en het is de juiste tafel');

    // een stoel erbij, zodat een bord straks een naam draagt
    await page.fill('#tStoelNaam', 'bij het raam');
    await page.click('#tStoelBij');
    /* De stoel verschijnt in dezelfde hertekening die ook de keuzelijst "Voor
       wie" vult -- en die wordt drie regels lager gebruikt. */
    await wachtOpTekst(page, /bij het raam/, { in: '#tStoelen' });
    assert.match(await page.evaluate(() => document.getElementById('tStoelen').innerText),
      /bij het raam/, 'de stoel zit aan tafel');

    // OPNEMEN: van de kaart, met een allergie en voor die stoel
    await page.selectOption('#tVoor', { label: 'bij het raam' });
    await page.fill('#tAllergie', 'schaaldieren');
    const kaartKnop = await page.$('#tKaart [data-item]');
    assert.ok(kaartKnop, 'de kaart van de zaak staat op de PDA');
    const wat = await kaartKnop.evaluate(el => el.textContent);
    /* WAT ER OP DE REKENING KOMT IS DE BEWERING HIERONDER, dus daar mag deze wacht
       niet op vooruitlopen. De rekening zei "Nog niets besteld"; zodra hij iets
       anders zegt, is de regel binnen en mogen de beweringen hun werk doen. */
    const voorBestellen = await tekstVan(page, '#tRegels');
    await kaartKnop.click();
    await wachtOpVerandering(page, '#tRegels', voorBestellen);
    const opRekening = await page.evaluate(() => document.getElementById('tRegels').innerText);
    assert.match(opRekening, /schaaldieren/, 'de allergie staat op de regel');
    assert.match(opRekening, /nog niet naar de keuken/, 'en de keuken ziet hem nog niet');

    /* DE PRIJS KOMT VAN DE KAART. Wat het scherm toont moet gelijk zijn aan wat
       de server op de rekening zette -- en die haalt hem uit kern/horeca/kaart.js. */
    const alle = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen;
    const keten = alle.find(x => x.tafel === 'PDA-KETEN');
    const vol = (await H('/api/supplier/horeca/rekening', { rekeningId: keten.id })).body.rekening;
    const kaart = (await H('/api/supplier/horeca/kaart', {})).body.groepen[0].items[0];
    assert.equal(vol.regels[0].naam, kaart.naam, 'de naam komt van de kaart');
    assert.equal(vol.regels[0].centen, kaart.centen, 'en de prijs ook');
    assert.match(wat.replace(/\s+/g, ' '), new RegExp(kaart.naam), 'zoals hij op de knop stond');
    assert.ok(vol.regels[0].gastNr, 'de regel hangt aan de stoel');

    // GANGEN STUREN
    const naarKeuken = await page.$('#tRegels [data-vrij]');
    assert.ok(naarKeuken, 'er staat een knop om de gang naar de keuken te sturen');
    await naarKeuken.click();
    /* Vrijgeven laat de knop verdwijnen: er staat in die gang niets meer open. Dat
       is meteen het teken dat de server klaar is -- de vraag ertussen gaat
       rechtstreeks naar hem toe. */
    await wachtTot(page, () => !document.querySelector('#tRegels [data-vrij]'), null,
      { wat: 'de gang vrijgegeven (geen knop "Naar de keuken" meer)' });
    const naVrij = (await H('/api/supplier/horeca/rekening', { rekeningId: keten.id })).body.rekening;
    assert.ok(naVrij.regels[0].vrijAt, 'nu pas ziet de keuken hem');
    assert.equal(await page.evaluate(() => !!document.querySelector('#tRegels [data-vrij]')), false,
      'en de knop is weg, want er staat niets meer open');

    // AFREKENEN
    const betaal = await page.$('#tBetaal [data-betaal="pin"]');
    assert.ok(betaal, 'er staat een pinknop met het openstaande bedrag');
    assert.match(await betaal.evaluate(el => el.textContent), /\d/, 'met een bedrag erin');
    await betaal.click();
    /* Een gesloten rekening klapt het tafelvenster dicht en zet de werklijst terug
       in beeld (KLAAR -> terug). Zolang #pLijst verborgen is, is de betaling nog
       niet rond en zou de vraag aan de server hieronder te vroeg komen. */
    await wachtOpZichtbaar(page, '#pLijst');
    const naBetaal = (await H('/api/supplier/horeca/rekening', { rekeningId: keten.id })).body.rekening;
    assert.equal(naBetaal.status, 'betaald', 'de rekening is betaald');
    assert.equal(naBetaal.openstaand, 0);
    assert.equal(await page.evaluate(() => document.getElementById('pLijst').hidden), false,
      'en het scherm staat weer op de werklijst');

    assert.deepEqual(fouten, [], 'geen scriptfouten op de PDA');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
