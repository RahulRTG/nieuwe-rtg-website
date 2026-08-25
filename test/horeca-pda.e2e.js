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
const { startServer, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pda-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de PDA toont uitgelogd een deur en ingelogd een werkbare servicelijst',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
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
    await page.waitForTimeout(900);
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
       kern/horeca/cadans.js rekent. */
    const toen = new Date(Date.now() - 20 * 60000);
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
    await page.waitForTimeout(900);

    const lees = () => page.evaluate(() => ({
      nu: document.getElementById('pNu').innerText.replace(/\s+/g, ' '),
      open: document.getElementById('pOpen').innerText.replace(/\s+/g, ' '),
      modi: [...document.querySelectorAll('#pModi button')].map(b => b.textContent)
    }));
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
    const gaan = await page.$('[data-stand="opgepakt"]');
    assert.ok(gaan, 'er staat een knop "Ik ga"');
    await gaan.click();
    await page.waitForTimeout(700);
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /U heeft dit opgepakt/, 'na oppakken staat er wie het heeft');

    /* 6. oppakken van een gang vinkt niets af */
    const pak = await page.$('[data-pak]');
    assert.ok(pak, 'er staat een knop om de gang te dragen');
    await pak.click();
    await page.waitForTimeout(700);
    const naPak = (await H('/api/supplier/horeca/rekening', { rekeningId: draag.id })).body.rekening;
    assert.equal(naPak.regels[0].stand, 'klaar', 'het bord staat nog op klaar, niet op uitgegeven');
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /PDA-DRAAG/, 'en de taak staat er nog, want hij is niet uitgegeven');

    /* 5. de modus is een lens */
    await page.click('[data-modus="runner"]');
    await page.waitForTimeout(700);
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /PDA-DRAAG/, 'de runner ziet de gang');
    assert.doesNotMatch(beeld.nu + beeld.open, /gebarsten/, 'en niet het verzoek van de gast');
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-LEEG/, 'en niet de lege tafel');
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-LAAT/, 'en niet de halve gang van de keuken');

    /* en uitgeven haalt hem er wel af */
    await page.click('[data-uit]');
    await page.waitForTimeout(700);
    const naUit = (await H('/api/supplier/horeca/rekening', { rekeningId: draag.id })).body.rekening;
    assert.equal(naUit.regels[0].stand, 'uitgegeven', 'nu pas is hij uitgegeven');
    beeld = await lees();
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-DRAAG/, 'en dan is de taak weg');

    /* ---- 5b. de host ziet de aankomststroom ----
       Een belofte die op een persoonlijke controle wacht, staat met naam en al
       op de kaart -- een host die eerst een ander scherm moet openen om te zien
       WELKE belofte wacht, heeft geen werklijst maar een verwijzing. */
    /* DE DATUM KOMT UIT DEZELFDE KLOK ALS DE TIJD, en dat is geen netheid.

       Hier stond `datum: new Date().toISOString().slice(0, 10)` -- de datum van
       NU -- naast een tijd van twee uur later. Draait deze toets na tienen 's
       avonds, dan wijst die tijd naar de volgende dag terwijl de datum op
       vandaag blijft staan: de aankomst wordt tweeentwintig uur in het VERLEDEN
       geboekt en staat dus terecht niet op de lijst van de host. De toets zakte
       dan met "de aankomst staat op de lijst van de host", een melding die naar
       de hostkaart wijst terwijl er niets mis is met de hostkaart.

       Zo is hij op 24 augustus 2026 om 23:1x op CI gezakt; de runs van 19:00 en
       20:00 diezelfde avond waren groen. Een toets die tussen tien uur en
       middernacht altijd zakt en de rest van de dag nooit, is geen flake maar
       een klok (LAT.md regel 1: repareer de oorzaak).

       Beide waarden komen nu uit `tijd`, en allebei uit de LOKALE tijd -- niet
       toISOString(), want die is UTC en zou in een tijdzone met een offset
       precies dezelfde scheefheid terugbrengen die we hier weghalen. */
    const tijd = new Date(Date.now() + 2 * 3600000);
    const tweeCijfers = (n) => String(n).padStart(2, '0');
    const hh = tweeCijfers(tijd.getHours()) + ':' + tweeCijfers(tijd.getMinutes());
    const datum = tijd.getFullYear() + '-' + tweeCijfers(tijd.getMonth() + 1) + '-' + tweeCijfers(tijd.getDate());
    const pass = (await post(base, '/api/arrival/request', {
      requestToken: 'pdahostaanvraagcode1234.geheimgeheimgeheim1234ab',
      supplierCode: 'KIKUNOI', naam: 'Aankomst', datum,
      tijd: hh, personen: 2, allergie: true })).body.pass;
    assert.ok(pass, 'de aankomst is aangevraagd');

    await page.click('[data-modus="host"]');
    await page.waitForTimeout(800);
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
      const knop = await page.$('[data-belofte]');
      if (!knop) break;
      await knop.click();
      await page.waitForTimeout(700);
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
    await page.waitForTimeout(600);

    /* ---- 7. de wijklens ----
       De modus filtert op SOORT werk, de wijk op WIENS tafel het is. Twee
       lenzen, twee rijen knoppen: samengevoegd zou "runner in mijn wijk"
       onmogelijk zijn. */
    await page.click('[data-modus="alles"]');
    await page.waitForTimeout(600);

    const wijk = (await H('/api/supplier/horeca/wijk/zet', { naam: 'Terras', tafels: ['PDA-DRAAG'] })).body.wijk;
    await H('/api/supplier/horeca/wijk/neem', { wijkId: wijk.id });
    await page.click('#pVerversNu');
    await page.waitForTimeout(800);

    const wijkbeeld = await page.evaluate(() => document.getElementById('pWijken').innerText.replace(/\s+/g, ' '));
    assert.match(wijkbeeld, /Terras/, 'de wijk staat in het wijkbeeld');
    assert.match(wijkbeeld, /draagt deze wijk/, 'met wie hem draagt');
    assert.match(wijkbeeld, /Zonder wijk/, 'en de tafels die in geen wijk zitten staan er apart');

    await page.click('[data-wijklens="mijn"]');
    await page.waitForTimeout(800);
    let beeldW = await lees();
    assert.match(beeldW.nu + beeldW.open, /PDA-DRAAG/, 'mijn eigen wijk staat er');
    assert.match(beeldW.nu + beeldW.open, /PDA-LEEG/, 'een tafel zonder wijk is van iedereen');
    const uitleg = await page.evaluate(() => document.getElementById('pWijkUit').textContent);
    assert.match(uitleg, /Terras/, 'het scherm zegt welke wijk u draagt: ' + uitleg);
    assert.match(uitleg, /niets buiten|niet getoond/, 'en of er iets buiten valt');

    /* Nu de wijk loslaten: dan is hij van niemand, dus van iedereen -- en de
       tafel hoort NIET te verdwijnen. */
    await page.click('[data-wijklaat]');
    await page.waitForTimeout(800);
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
    await page.waitForTimeout(900);
    const metBod = await page.evaluate(() => document.getElementById('pWijken').innerText.replace(/\s+/g, ' '));
    assert.match(metBod, /Er ligt een aanbod voor u/, 'het aanbod staat op de PDA: ' + metBod);
    assert.match(metBod, /draagt uw collega het nog/, 'met wat er tot dan geldt');
    assert.ok(await page.$('a[href="/apps/horeca-vloer.html"]'), 'met de weg naar de vloer erbij');

    await post(base, '/api/supplier/horeca/wijk/trek-in',
      { overdrachtId: bod.body.overdracht.id }, tokB);

    await page.click('[data-wijklens="alles"]');
    await page.waitForTimeout(600);

    /* ---- 8. de hele keten op dit scherm ---- */
    await page.click('#tTerug').catch(() => {});
    await page.waitForTimeout(300);

    // ONTVANGEN
    await page.fill('#pNieuwTafel', 'PDA-KETEN');
    await page.fill('#pNieuwGasten', '3');
    await page.click('#pNieuw');
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => document.getElementById('pTafel').hidden), false,
      'na het openen staat de tafel in beeld');
    assert.match(await page.evaluate(() => document.getElementById('tKop').textContent),
      /PDA-KETEN/, 'en het is de juiste tafel');

    // een stoel erbij, zodat een bord straks een naam draagt
    await page.fill('#tStoelNaam', 'bij het raam');
    await page.click('#tStoelBij');
    await page.waitForTimeout(600);
    assert.match(await page.evaluate(() => document.getElementById('tStoelen').innerText),
      /bij het raam/, 'de stoel zit aan tafel');

    // OPNEMEN: van de kaart, met een allergie en voor die stoel
    await page.selectOption('#tVoor', { label: 'bij het raam' });
    await page.fill('#tAllergie', 'schaaldieren');
    const kaartKnop = await page.$('#tKaart [data-item]');
    assert.ok(kaartKnop, 'de kaart van de zaak staat op de PDA');
    const wat = await kaartKnop.evaluate(el => el.textContent);
    await kaartKnop.click();
    await page.waitForTimeout(800);
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
    await page.waitForTimeout(800);
    const naVrij = (await H('/api/supplier/horeca/rekening', { rekeningId: keten.id })).body.rekening;
    assert.ok(naVrij.regels[0].vrijAt, 'nu pas ziet de keuken hem');
    assert.equal(await page.evaluate(() => !!document.querySelector('#tRegels [data-vrij]')), false,
      'en de knop is weg, want er staat niets meer open');

    // AFREKENEN
    const betaal = await page.$('#tBetaal [data-betaal="pin"]');
    assert.ok(betaal, 'er staat een pinknop met het openstaande bedrag');
    assert.match(await betaal.evaluate(el => el.textContent), /\d/, 'met een bedrag erin');
    await betaal.click();
    await page.waitForTimeout(900);
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
