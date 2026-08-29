/* ============================================================================
   DE ZEVEN WERKSCHERMEN VAN HET HORECA OS, IN EEN ECHTE BROWSER.

   /apps/horeca.html (zaal en keuken) heeft zijn eigen toets. Dit bestand dekt
   de zeven schermen eromheen: expeditie, bezorging, hotel, events, club, HACCP
   en beheer. Ze draaiden tot nu toe alleen op de API, en dat is precies het
   gat waar deze suite eerder in is gelopen -- een kloppende API met een scherm
   dat iets anders laat zien.

   WAT HIER WORDT BEWEZEN, EN WAAROM JUIST DAT

   Elke bewering hieronder is er een die van buiten NIET te zien is aan een
   groene API-toets, en die pijn doet als hij niet klopt:

   1. DE PAS. Een bord dat klaar is, krijgt een uitgeefknop; uitgeven haalt hem
      van het regiescherm af. Een pas die na het uitgeven blijft staan, laat
      een tafel twee keer serveren.
   2. EEN NEE DRAAGT ZIJN REDEN. Een adres buiten de zone en een vol tijdslot
      noemen allebei hun getal op het scherm. Een rem die alleen "nee" zegt,
      stuurt de klant naar een ander.
   3. GELD KRUIST DE GRENS. Roomservice op de kamer boeken zet het bedrag op de
      gastrekening van diezelfde kamer; het scherm laat de regel en het nieuwe
      totaal zien. Dat is de duurste fout die een hotelsysteem kan maken.
   4. DE NACHTRUN IS IDEMPOTENT, EN ZEGT DAT. Twee keer drukken boekt geen twee
      nachten en het scherm meldt hoeveel er zijn overgeslagen.
   5. EEN NACALCULATIE ZONDER KOSTEN BLIJFT LEEG. Geen prachtige 100% marge.
   6. EEN POLSBAND KAN NIET ONDER NUL, en de capaciteitsteller weigert MET het
      getal erbij.
   7. EEN HACCP-AFWIJKING ZONDER ACTIE WORDT GEWEIGERD, en het scherm toont die
      weigering in plaats van hem in te slikken.
   8. EEN DELING DOOR NUL IS GEEN 0%. Zonder omzet staat er geen loonpercentage.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtTot, wachtOpTekst, wachtOpVerandering, klikEnWacht, tekstVan } = require('./helper');

const pw = laadPlaywright();
const TMPS = [];
const versDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-horecaschermen-')); TMPS.push(d); return d; };

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

// de API rechtstreeks, om een uitgangspositie te zetten die het SCHERM daarna moet tonen
const horeca = (base, token) => (pad, body) => fetch(base + '/api/supplier/horeca' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(r => r.json());

async function open(page, base, token, pad) {
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_sup_token', t);
  }, token);
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  /* Wachten tot het scherm ECHT iets heeft neergezet. Een kale goto is klaar
     zodra de HTML er is; deze schermen halen hun inhoud daarna pas op. */
  await wachtTot(page, () => (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim().length > 80,
    null, { wat: 'een scherm met inhoud' });
}
const lees = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

test('de pas geeft uit, en de bezorgdispatch noemt bij elk nee zijn getal',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = versDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const token = await zaakToken(base);
    const api = horeca(base, token);

    /* ---- uitgangspositie: een tafel met twee borden in gang 1, vrijgegeven,
       waarvan er een klaar staat ---- */
    const rek = await api('/rekening/open', { kanaal: 'tafel', tafel: 'Tafel 7', gasten: 2 });
    const a = await api('/rekening/regel', { rekeningId: rek.rekening.id, naam: 'Tarbot', prijs: 42, station: 'warm', gang: 1 });
    await api('/rekening/regel', { rekeningId: rek.rekening.id, naam: 'Zeekraal', prijs: 8, station: 'koud', gang: 1 });
    await api('/gang/vrij', { rekeningId: rek.rekening.id, gang: 1, serveerOm: '20:15' });
    const regelId = a.rekening.regels[a.rekening.regels.length - 1].id;
    await api('/keuken/stand', { rekeningId: rek.rekening.id, regelId, stand: 'klaar' });

    /* ---- de pas ---- */
    await open(page, base, token, '/apps/horeca-expeditie.html');
    let tekst = await lees(page);
    assert.match(tekst, /Tafel 7/, 'de tafel staat aan de pas');
    assert.match(tekst, /Tarbot/, 'met het gerecht dat klaar staat');
    assert.match(tekst, /1 van 2 klaar|min koud/, 'en met de stand van de tafel, niet alleen een kleur');
    assert.match(tekst, /serveren 20:15/i, 'de gewenste serveertijd staat erbij');
    assert.match(tekst, /bereidingsminuten open, gedeeld door \d+ kok/i,
      'de drukterem toont zijn rekensom en niet alleen een uitkomst');

    /* ---- de claim op de pas ----
       Een tweede tafel, want de eerste bewijst hierboven al iets anders. Wat
       hier bewezen wordt is dat een HALVE gang geen draagtaak is, en dat een
       complete gang een mens krijgt voordat er iemand mee loopt. */
    assert.match(tekst, /klaar om te dragen \(0/i, 'een halve gang staat niet op de draaglijst');

    const rek2 = await api('/rekening/open', { kanaal: 'tafel', tafel: 'Tafel 9', gasten: 2 });
    await api('/gezelschap/stoel', { rekeningId: rek2.rekening.id, handle: 'Bij het raam' });
    const gez = await api('/gezelschap', { rekeningId: rek2.rekening.id });
    const stoelNr = gez.gezelschap.stoelen[0].nr;
    for (const naam of ['Coquille', 'Bisque']) {
      const g = await api('/rekening/regel', { rekeningId: rek2.rekening.id, naam, prijs: 20, station: 'warm', gang: 1 });
      const id = g.rekening.regels[g.rekening.regels.length - 1].id;
      if (naam === 'Coquille') await api('/rekening/regel/stoel', { rekeningId: rek2.rekening.id, regelId: id, nr: stoelNr });
    }
    await api('/gang/vrij', { rekeningId: rek2.rekening.id, gang: 1 });
    const verse = (await api('/rekening', { rekeningId: rek2.rekening.id })).rekening.regels;
    for (const r of verse) await api('/keuken/stand', { rekeningId: rek2.rekening.id, regelId: r.id, stand: 'klaar' });

    await open(page, base, token, '/apps/horeca-expeditie.html');
    tekst = await lees(page);
    assert.match(tekst, /klaar om te dragen \(1/i, 'de complete gang staat er wel');
    assert.match(tekst, /nog van niemand/, 'en heeft nog geen mens');
    assert.match(tekst, /Bij het raam/, 'met per bord waar het heen moet');

    const pakknop = await page.$('#ePas [data-pak]');
    assert.ok(pakknop, 'een complete gang krijgt een oppakknop');
    await pakknop.click();
    /* Oppakken zet een CLAIM en het scherm haalt de paslijst daarna opnieuw op.
       Wachten op "jij hebt hem" in #ePas is wachten op precies de bewering
       hieronder: vlak na de klik staat de kaart er nog met "nog van niemand". */
    await wachtOpTekst(page, /jij hebt hem/, { in: '#ePas' });
    tekst = await lees(page);
    assert.match(tekst, /jij hebt hem/, 'na oppakken staat er wie hem heeft');

    // en oppakken vinkt niets af: de borden staan nog op klaar
    const nogKlaar = (await api('/rekening', { rekeningId: rek2.rekening.id })).rekening.regels;
    assert.ok(nogKlaar.every(r => r.stand === 'klaar'), 'oppakken is geen uitgeven');

    const gangUit = await page.$('#ePas [data-gangUit], #ePas [data-ganguit]');
    assert.ok(gangUit, 'en de hele gang kan in een tik de deur uit');
    const voorGangUit = await tekstVan(page, '#eRegie');
    await gangUit.click();
    /* Twee panelen moeten hertekend zijn, en ze komen uit twee LOSSE verzoeken.
       De teller boven de paslijst gaat van 1 naar 0 -- dat is de bewering
       hieronder. En #eRegie verliest tafel 9 (uitgegeven regels vallen uit
       /keuken/regie), en pas daarna is de uitgeefknop die de toets hierna
       oppakt werkelijk die van tafel 7 en geen losgeraakt handvat uit de
       vorige hertekening. */
    await wachtOpTekst(page, /klaar om te dragen \(0/i);
    await wachtOpVerandering(page, '#eRegie', voorGangUit);
    tekst = await lees(page);
    assert.match(tekst, /klaar om te dragen \(0/i, 'daarna staat de gang niet meer op de draaglijst');
    const naGang = (await api('/rekening', { rekeningId: rek2.rekening.id })).rekening.regels;
    assert.ok(naGang.every(r => r.stand === 'uitgegeven'), 'alle borden van de gang zijn uitgegeven');

    const uitgeef = await page.$('[data-uit]');
    assert.ok(uitgeef, 'een bord dat klaar is, krijgt een uitgeefknop');
    const voorUit = await tekstVan(page, '#eRegie');
    await uitgeef.click();
    await wachtOpVerandering(page, '#eRegie', voorUit);
    const naUit = await page.evaluate(() => document.getElementById('eRegie').innerText.replace(/\s+/g, ' '));
    assert.ok(!/Tarbot/.test(naUit), 'wat is uitgegeven, staat niet meer aan de pas: ' + naUit.slice(0, 160));

    /* ---- de bezorgdispatch ---- */
    await open(page, base, token, '/apps/horeca-bezorg.html');
    await page.fill('#bZoneNaam', 'Centrum');
    await page.fill('#bZonePost', '1011, 1012');
    await page.fill('#bZoneKosten', '2.50');
    await page.fill('#bZoneMin', '15');
    await page.click('#bZoneZet');
    await wachtOpTekst(page, /Centrum/);
    tekst = await lees(page);
    assert.match(tekst, /Centrum/, 'de zone staat in de lijst');

    await page.fill('#bCheckPost', '1011 AB');
    await page.fill('#bCheckBedrag', '9');
    await page.click('#bCheck');
    await wachtOpTekst(page, /Ja: zone Centrum/, { in: '#bCheckUit' });
    let uit = await page.evaluate(() => document.getElementById('bCheckUit').textContent);
    assert.match(uit, /Ja: zone Centrum/, 'binnen de zone kan het: ' + uit);
    assert.match(uit, /minimum wordt niet gehaald.*6[.,]00/,
      'en het tekort tot het minimum staat er met het bedrag bij: ' + uit);

    await page.fill('#bCheckPost', '9999 ZZ');
    await page.click('#bCheck');
    await wachtOpTekst(page, /9999/, { in: '#bCheckUit' });
    uit = await page.evaluate(() => document.getElementById('bCheckUit').textContent);
    assert.match(uit, /9999/, 'een nee noemt de postcode die buiten het gebied valt: ' + uit);

    await page.fill('#bSlotTijd', '18:30');
    await page.fill('#bSlotCap', '30');
    await klikEnWacht(page, '#bSlotZet', '/bezorg/slot');
    await page.fill('#bSlotMin', '20');
    await page.click('#bSlotNeem');
    await wachtOpTekst(page, /Gereserveerd: 20/, { in: '#melding' });
    await page.click('#bSlotNeem');
    await wachtOpTekst(page, /vol \(20 van 30 minuten bezet\)/, { in: '#melding' });
    const melding = await page.evaluate(() => document.getElementById('melding').textContent);
    assert.match(melding, /vol \(20 van 30 minuten bezet\)/,
      'een vol tijdslot noemt hoeveel er bezet is, niet alleen "vol": ' + melding);
    tekst = await lees(page);
    assert.match(tekst, /keukenminuten/, 'het scherm zegt dat de capaciteit in keukenminuten telt');

    /* ---- de ritvolgorde noemt zichzelf een heuristiek ---- */
    for (const s of [['Prinsengracht 12', '52.3676', '4.8850'], ['Javastraat 4', '52.3630', '4.9400']]) {
      await page.fill('#bStopAdres', s[0]);
      await page.fill('#bStopLat', s[1]);
      await page.fill('#bStopLng', s[2]);
      await page.click('#bStopVoeg');
      /* Stops erbij zetten gaat zonder server: het scherm leegt de velden en
         hertekent de lijst. Daar is dus niets te wachten -- alleen te zien dat
         het gebeurd is. */
      await wachtTot(page, () => document.getElementById('bStopAdres').value === '',
        null, { wat: 'het adresveld leeg na "Stop erbij"' });
    }
    await page.click('#bRoute');
    await wachtOpTekst(page, /stops/, { in: '#bRouteUit' });
    const route = await page.evaluate(() => document.getElementById('bRouteUit').textContent);
    assert.match(route, /2 stops, [\d.,]+ km/, 'de volgorde noemt de afstand: ' + route);
    assert.match(route, /geen optimale route/i,
      'en verkoopt zichzelf niet als routeoptimalisatie: ' + route);

    /* ---- het afleverbewijs weigert wat het hoort te weigeren ---- */
    await page.fill('#rBewijsRef', 'RTG-B-TEST01');
    await page.check('#rLeeftijdNodig');
    await page.click('#rBewijs');
    await wachtOpTekst(page, /leeftijdscontrole/i, { in: '#melding' });
    let mld = await page.evaluate(() => document.getElementById('melding').textContent);
    assert.match(mld, /leeftijdscontrole/i, 'zonder leeftijdscontrole kan er niet worden afgetekend: ' + mld);
    await page.check('#rLeeftijdOk');
    await page.click('#rBewijs');
    await wachtOpTekst(page, /overhandigd/i, { in: '#melding' });
    mld = await page.evaluate(() => document.getElementById('melding').textContent);
    assert.match(mld, /overhandigd/i, 'en overhandigen vraagt aan wie: ' + mld);
    await page.fill('#rOntvanger', 'buurvrouw 12B');
    await page.click('#rBewijs');
    await wachtOpTekst(page, /Afgetekend om/, { in: '#rBewijsUit' });
    const bewijs = await page.evaluate(() => document.getElementById('rBewijsUit').textContent);
    assert.match(bewijs, /Afgetekend om \d\d:\d\d/, 'daarna wordt er wel afgetekend: ' + bewijs);
    assert.match(bewijs, /geen foto van een mens of een deur/i, 'met wat er NIET wordt bewaard erbij');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
  }
});

test('roomservice komt op de gastrekening, de nachtrun boekt geen twee nachten, en een nacalculatie zonder kosten blijft leeg',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = versDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const token = await zaakToken(base);

    /* ---- het hotel ---- */
    await open(page, base, token, '/apps/horeca-hotel.html');
    await page.fill('#hKamer', '210');
    await page.fill('#hGast', 'De heer Bakker');
    await page.fill('#hGasten', '2');
    await page.fill('#hNachtprijs', '180');
    await page.fill('#hBelasting', '3');
    await klikEnWacht(page, '#hOpen', '/horeca/');
    await page.click('#hNacht');
    await wachtOpTekst(page, /kamer\(s\) geboekt/, { in: '#hNachtUit' });
    let nacht = await page.evaluate(() => document.getElementById('hNachtUit').textContent);
    assert.match(nacht, /1 kamer\(s\) geboekt/, 'de nachtrun boekt de kamer: ' + nacht);
    /* Het nachtrunbericht en het rekeningpaneel komen uit twee losse verzoeken.
       Het bericht staat eerst; wacht daarom op de afzonderlijke hertekening van
       het folio voordat we de geboekte regels lezen. */
    await wachtOpTekst(page, /Overnachting/, { in: '#hDetail' });
    let tekst = await lees(page);
    assert.match(tekst, /Overnachting/, 'de kamernacht staat als eigen regel');
    assert.match(tekst, /Toeristenbelasting/, 'en de toeristenbelasting apart, niet verstopt in de kamerprijs');
    assert.match(tekst, /186[.,]00/, 'samen 180 + 2 x 3 = 186,00');

    const voorNacht = await tekstVan(page, '#hNachtUit');
    await page.click('#hNacht');
    await wachtOpVerandering(page, '#hNachtUit', voorNacht);
    nacht = await page.evaluate(() => document.getElementById('hNachtUit').textContent);
    assert.match(nacht, /0 kamer\(s\) geboekt, 1 overgeslagen/,
      'twee keer draaien boekt geen twee nachten, en het scherm zegt dat: ' + nacht);

    /* ---- roomservice kruist naar de gastrekening ---- */
    await page.fill('#sKamer', '210');
    await klikEnWacht(page, '#sOpen', '/horeca/');
    await page.fill('#sNaam', 'Clubsandwich');
    await page.fill('#sPrijs', '18.50');
    await page.fill('#sAllergie', 'noten');
    await page.click('#sRegel');
    await wachtOpTekst(page, /Clubsandwich/);
    tekst = await lees(page);
    assert.match(tekst, /Clubsandwich/, 'de roomservicebestelling staat op het scherm');
    assert.match(tekst, /noten/, 'met de allergie erbij');
    await page.click('#sOpKamer');
    /* NIET op /roomservice/ wachten: dat woord staat al als categorie op dit
       scherm, dus die wacht was meteen klaar en de toets las de rekening voordat
       de boeking er stond. Wachten op het BEDRAG is wachten op de uitkomst. */
    await wachtOpTekst(page, /204[,.]50/);
    tekst = await lees(page);
    assert.match(tekst, /roomservice/i, 'de boeking staat als soort roomservice op de gastrekening');
    assert.match(tekst, /204[,.]50/, 'en het folio-totaal is 186,00 + 18,50 = 204,50');

    /* ---- op een kamer zonder gastrekening kan het niet ---- */
    await page.fill('#sKamer', '999');
    await klikEnWacht(page, '#sOpen', '/horeca/');
    await page.fill('#sNaam', 'Fles water');
    await page.fill('#sPrijs', '4');
    await klikEnWacht(page, '#sRegel', '/horeca/');
    await page.click('#sOpKamer');
    await wachtOpTekst(page, /geen open gastrekening op kamer 999/i, { in: '#melding' });
    const mld = await page.evaluate(() => document.getElementById('melding').textContent);
    assert.match(mld, /geen open gastrekening op kamer 999/i,
      'een rekening verdwijnt niet in een kamer die leegstaat: ' + mld);

    /* ---- events ---- */
    await open(page, base, token, '/apps/horeca-events.html');
    await page.fill('#vNaam', 'Bruiloft Van Dijk');
    await page.fill('#vGasten', '50');
    await page.fill('#vPost1', 'Diner per couvert');
    await page.fill('#vAantal1', '50');
    await page.fill('#vPrijs1', '45');
    await page.click('#vOfferte');
    await wachtOpTekst(page, /Bruiloft Van Dijk/);
    tekst = await lees(page);
    assert.match(tekst, /Bruiloft Van Dijk/, 'het event staat in de lijst');
    assert.match(tekst, /2[.,]?250[,.]00/, 'de offerte telt op tot 50 x 45,00');
    assert.match(tekst, /Een nacalculatie zonder kosten is geen nacalculatie/i,
      'zonder kosten blijft de marge leeg in plaats van 100%');

    await page.fill('#vDoor', 'mevrouw Van Dijk');
    await page.click('#vAkkoord');
    await wachtOpTekst(page, /bevestigd/);
    tekst = await lees(page);
    assert.match(tekst, /bevestigd/, 'na het akkoord staat het event op bevestigd');

    await page.fill('#vKostWat', 'Inkoop vis en vlees');
    await page.fill('#vKostBedrag', '900');
    await page.click('#vKosten');
    /* Wachten op de MARGE en niet op een procentteken: in dit paneel staat al
       "in plaats van 100%" zolang er geen kosten zijn, dus die wacht was meteen
       klaar en las de nacalculatie van voor de kostenpost. */
    await wachtOpTekst(page, /1[.,]?350/, { in: '#vNaUit' });
    const na = await page.evaluate(() => document.getElementById('vNaUit').innerText.replace(/\s+/g, ' '));
    assert.match(na, /1[.,]?350[,.]00/, 'de marge is 2250 - 900 = 1350,00: ' + na);
    assert.match(na, /60%/, 'en dat is 60% van de opbrengst: ' + na);

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
  }
});

test('een polsband kan niet onder nul, de deur weigert met het getal erbij, en een afwijking vraagt een actie',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = versDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const token = await zaakToken(base);

    /* ---- de club ---- */
    await open(page, base, token, '/apps/horeca-club.html');
    await page.fill('#cNummer', '4471');
    await page.fill('#cBedrag', '50');
    await page.click('#cBandOp');
    await wachtOpTekst(page, /saldo/, { in: '#cBandUit' });
    let uit = await page.evaluate(() => document.getElementById('cBandUit').textContent);
    assert.match(uit, /50[,.]00 saldo/, 'de band staat op 50,00: ' + uit);
    assert.ok(!/4471.*naam|naam.*4471/i.test(uit), 'er staat geen naam bij het bandnummer');

    await page.fill('#cBedrag', '80');
    const voorBand = await tekstVan(page, '#cBandUit');
    await page.click('#cBandBetaal');
    await wachtOpVerandering(page, '#cBandUit', voorBand);
    uit = await page.evaluate(() => document.getElementById('cBandUit').textContent);
    assert.match(uit, /saldo (€ )?0[,.]00/, 'een band kan niet onder nul: ' + uit);
    assert.match(uit, /30[,.]00 te weinig saldo/, 'en het tekort wordt genoemd zodat de rest apart afgerekend wordt: ' + uit);

    await page.fill('#dCapaciteit', '2');
    await page.fill('#dPersonen', '1');
    await page.click('#dIn');
    await wachtOpTekst(page, /^1$/, { in: '#dBinnen' });
    let binnen = await page.evaluate(() => document.getElementById('dBinnen').textContent);
    assert.equal(binnen, '1', 'er staat er een binnen');
    await page.fill('#dPersonen', '2');
    await page.click('#dIn');
    await wachtOpTekst(page, /capaciteit is bereikt/i, { in: '#melding' });
    let mld = await page.evaluate(() => document.getElementById('melding').textContent);
    assert.match(mld, /capaciteit is bereikt \(1 van 2 binnen\)/i,
      'de teller weigert met zijn getal erbij: ' + mld);
    let tekst = await lees(page);
    assert.match(tekst, /telt hoeveel mensen er binnen zijn, niet wie/i,
      'en het scherm zegt dat er geen aanwezigheidslijst wordt bijgehouden');

    await page.fill('#dNamen', 'Ilse, Bram');
    await page.fill('#dPromoter', 'Nova');
    await page.click('#dGastZet');
    await wachtOpTekst(page, /Nova 0 van 2 binnen/);
    tekst = await lees(page);
    assert.match(tekst, /Nova 0 van 2 binnen/,
      'per promoter staat aangemeld EN binnen; alleen dat eerste zegt niets');

    /* ---- HACCP ---- */
    await open(page, base, token, '/apps/horeca-haccp.html');
    await page.fill('#aPuntNaam', 'Koeling 1');
    await page.fill('#aMin', '0');
    await page.fill('#aMax', '7');
    await klikEnWacht(page, '#aPuntZet', '/haccp/');
    await page.fill('#aPuntNaam', 'Vriezer');
    await page.fill('#aMin', '-25');
    await page.fill('#aMax', '-16');
    await klikEnWacht(page, '#aPuntZet', '/haccp/');
    await wachtTot(page, () => [...document.querySelectorAll('#aPunt option')].some(o => /Vriezer/.test(o.textContent)),
      null, { wat: 'het tweede meetpunt in de keuzelijst' });

    await page.selectOption('#aPunt', { label: 'Koeling 1 (0 tot 7 C)' });
    await page.fill('#aWaarde', '9');
    await page.click('#aMeting');
    await wachtOpTekst(page, /buiten de grens/i, { in: '#melding' });
    mld = await page.evaluate(() => document.getElementById('melding').textContent);
    assert.match(mld, /buiten de grens \(0 tot 7 C\)/i,
      'een afwijking wordt geweigerd met de grens erbij: ' + mld);
    assert.match(mld, /een afwijking zonder actie is geen registratie/i, 'en met de reden waarom');

    await page.fill('#aActie', 'teruggekoeld, monteur gebeld');
    await page.click('#aMeting');
    await wachtOpTekst(page, /teruggekoeld, monteur gebeld/);
    tekst = await lees(page);
    assert.match(tekst, /afwijking/i, 'met de actie erbij wordt hij wel vastgelegd, als afwijking');
    assert.match(tekst, /teruggekoeld, monteur gebeld/, 'met de genomen actie in het logboek');
    const gemist = await page.evaluate(() => document.getElementById('aGemist').textContent);
    assert.match(gemist, /Vriezer/,
      'wat vandaag niet is gemeten, staat er als gemist bij: ' + gemist);

    await page.fill('#bNaam', 'Kalfsfond');
    await page.fill('#bTht', '2020-01-01');
    await page.click('#bBatchZet');
    await wachtOpTekst(page, /dagen over de datum/);
    tekst = await lees(page);
    assert.match(tekst, /dagen over de datum/, 'een batch over de datum zegt hoeveel dagen');
    assert.match(tekst, /niet automatisch afgeboekt/i,
      'en wordt niet vanzelf afgeboekt: weggooien is een handeling van een mens');

    /* ---- het beheer ---- */
    await open(page, base, token, '/apps/horeca-beheer.html');
    await page.fill('#lNaam1', 'Sanne');
    await page.fill('#lUren1', '8');
    await page.fill('#lUurloon1', '16.50');
    await page.click('#pLoon');
    await wachtOpTekst(page, /132[,.]00/, { in: '#lUit' });
    const loon = await page.evaluate(() => document.getElementById('lUit').innerText.replace(/\s+/g, ' '));
    assert.match(loon, /132[,.]00/, 'het loon is 8 x 16,50 = 132,00: ' + loon);
    assert.match(loon, /geen omzet, dus geen percentage/i,
      'zonder omzet staat er geen loonpercentage: een deling door nul is geen 0%');
    const let2 = await page.evaluate(() => document.getElementById('lLet').textContent);
    assert.match(let2, /deling door nul is geen 0%/i, 'en het scherm legt dat uit: ' + let2);

    tekst = await lees(page);
    assert.match(tekst, /meetpunt\(en\) zijn vandaag nog niet gemeten/i,
      'het signalenpaneel ziet het niet-gemeten meetpunt van dit scherm');
    assert.ok(!/prognose|voorspel/i.test(tekst),
      'er staat geen omzetprognose op het managementscherm');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    for (const d of TMPS) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
  }
});
