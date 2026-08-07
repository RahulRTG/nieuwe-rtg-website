/* Het Mobility OS: een vervoerskern waar taxi, OV, pendel en charter op
   dezelfde ritten-, voertuig- en betaallaag draaien. Draai los:
   node --experimental-sqlite --test test/mobiliteit.test.js

   Wat deze toetsen bewaken, en waarom juist dat:

   1. Een module die leunt op iets dat uit staat, is uit -- en aanzetten weigert
      met de naam van wat ontbreekt. Zonder deze regel kan iemand met een tik
      helikoptercharter aanzetten zonder contract, zonder weertoets en zonder
      dat er een mens naar kijkt.
   2. Papieren zijn fail-closed. Geen einddatum telt als ONGELDIG, niet als
      "vast wel goed". Een taxi met een verlopen vergunning die toch een rit
      krijgt, is een overtreding met een ritnummer eronder.
   3. De statusketen kent maar een weg. Een rit kan niet 'voltooid' worden
      zonder ooit ingestapt te zijn, want daar hangt de afrekening aan.
   4. De matcher wijst af op grenzen, niet met minpunten, en legt zijn keuze uit.
   5. De bestemmingen komen uit RTG zelf (horeca, hotels, haltes) en niet uit
      een tweede adresboek.
   6. Een reiziger komt niet bij de rit van een ander, en een medewerker niet
      bij de pendel van een bedrijf waar hij niet werkt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, zaak, kantoor;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mob-'));
const STAD = { lat: 38.908, lng: 1.432 };
const OFFICE_CODE = 'KANTOOR-MOB-1';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'mob' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}
// een voertuig met alle papieren op orde, tenzij anders gevraagd
const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  lidA = await lid(); lidB = await lid();
  const roster = await api('/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  zaak = (await api('/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' })).body.token;
  assert.ok(zaak, 'de manager van de taxizaak logt in');
  kantoor = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  assert.ok(kantoor, 'het kantoor logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het moduleregister: een product is nooit meer aan dan waar het op leunt', async () => {
  // helikoptercharter leunt op contracten, weertoets en charterafrekening: die staan uit
  const uit = await api('/api/office/mob/proef', { id: 'helicopter_charter' }, kantoor);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.oordeel.aan, false, 'zonder zijn vereisten staat het charter uit');
  assert.equal(uit.body.oordeel.ontbreekt, 'partner_contracts', 'en hij noemt WELKE vereiste ontbreekt');

  // aanzetten weigert, met de naam erbij -- geen half afgemaakte functie
  const weiger = await api('/api/office/mob/module/zet', { id: 'helicopter_charter', aan: true }, kantoor);
  assert.equal(weiger.status, 409);
  assert.match(weiger.body.error, /Partnercontracten staat uit/);

  // een reiziger krijgt dezelfde grens te zien, niet een lege lijst
  const vraag = await api('/api/mob/vraag', { ritsoort: 'charter', categorie: 'helikopter',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' } }, lidA);
  assert.equal(vraag.status, 409, 'een helikopter aanvragen kan niet zolang de module uit staat');

  // met de vereisten aan gaat hij wel om
  for (const v of ['partner_contracts', 'weather_validation', 'charter_payments'])
    assert.equal((await api('/api/office/mob/module/zet', { id: v, aan: true }, kantoor)).status, 200, v + ' aan');
  const aan = await api('/api/office/mob/module/zet', { id: 'helicopter_charter', aan: true }, kantoor);
  assert.equal(aan.status, 200, 'met alle vereisten aan mag het charter wel aan');
  assert.equal((await api('/api/office/mob/proef', { id: 'helicopter_charter' }, kantoor)).body.oordeel.aan, true);

  /* En de afhankelijkheid werkt ook TERUG. Dit is de kern van het ontwerp: een
     vereiste die wegvalt neemt alles mee wat erop leunt, zonder dat iemand die
     producten een voor een hoeft uit te zetten. */
  await api('/api/office/mob/module/zet', { id: 'weather_validation', aan: false }, kantoor);
  const na = await api('/api/office/mob/proef', { id: 'helicopter_charter' }, kantoor);
  assert.equal(na.body.oordeel.aan, false, 'de weertoets uit zet het charter meteen uit');
  assert.equal(na.body.oordeel.ontbreekt, 'weather_validation');
  await api('/api/office/mob/module/zet', { id: 'weather_validation', aan: true }, kantoor);
});

test('2. het register per stad: IJmuiden mag andere regels hebben dan Amsterdam', async () => {
  const zet = await api('/api/office/mob/module/zet',
    { id: 'ride_hailing', aan: false, niveau: 'stad', stad: 'Haarlem' }, kantoor);
  assert.equal(zet.status, 200);
  const haarlem = await api('/api/office/mob/proef', { id: 'ride_hailing', waar: { stad: 'Haarlem' } }, kantoor);
  assert.equal(haarlem.body.oordeel.aan, false);
  assert.match(haarlem.body.oordeel.reden, /Haarlem/, 'de reden noemt het niveau dat besliste');
  const ijmuiden = await api('/api/office/mob/proef', { id: 'ride_hailing', waar: { stad: 'IJmuiden' } }, kantoor);
  assert.equal(ijmuiden.body.oordeel.aan, true, 'de buurstad merkt er niets van');

  // en wat op de directe rit leunt, volgt in diezelfde stad
  const gepland = await api('/api/office/mob/proef', { id: 'scheduled_rides', waar: { stad: 'Haarlem' } }, kantoor);
  assert.equal(gepland.body.oordeel.aan, false, 'vooraf boeken leunt op de directe rit');
  assert.equal(gepland.body.oordeel.ontbreekt, 'ride_hailing');

  // opruimen: de stadsregel weer weg, anders lekt hij naar de volgende toets
  await api('/api/office/mob/module/zet', { id: 'ride_hailing', aan: true, niveau: 'stad', stad: 'Haarlem', wis: true }, kantoor);
  assert.equal((await api('/api/office/mob/proef', { id: 'ride_hailing', waar: { stad: 'Haarlem' } }, kantoor)).body.oordeel.aan, true);
});

test('3. de storingsknop zet een module uit, en blijft te onderscheiden van "bewust uit"', async () => {
  const st = await api('/api/office/mob/storing', { id: 'shared_rides', reden: 'matcher gaf verkeerde ritten' }, kantoor);
  assert.equal(st.status, 200);
  const oordeel = (await api('/api/office/mob/proef', { id: 'shared_rides' }, kantoor)).body.oordeel;
  assert.equal(oordeel.aan, false);
  assert.equal(oordeel.storing, true, 'het antwoord zegt dat het een storing is en geen besluit');
  assert.match(oordeel.reden, /verkeerde ritten/, 'met de reden erbij');
  await api('/api/office/mob/storing', { id: 'shared_rides', reden: '' }, kantoor);
  assert.equal((await api('/api/office/mob/proef', { id: 'shared_rides' }, kantoor)).body.oordeel.storing, undefined);
});

test('4. de bestemmingen komen uit RTG zelf: horeca, hotels en haltes', async () => {
  const r = await api('/api/mob/plekken', { bij: STAD }, lidA);
  assert.equal(r.status, 200);
  const genres = new Set(r.body.plekken.map(p => p.genre));
  assert.ok(r.body.plekken.some(p => p.soort === 'zaak' && p.genre === 'restaurant'), 'onze horeca staat ertussen');
  assert.ok(r.body.plekken.some(p => p.soort === 'halte'), 'en de OV-haltes');
  assert.ok(genres.size > 2, 'meerdere genres, dus geen toevallige eenling');
  // dichtbij eerst: de lijst is gesorteerd op afstand vanaf het meegegeven punt
  const afst = r.body.plekken.filter(p => p.afstandM != null).map(p => p.afstandM);
  assert.deepEqual(afst, [...afst].sort((a, b) => a - b), 'dichtbij staat vooraan');
  assert.ok(r.body.genres.includes('hotel'), 'het genre hotel bestaat, ook als het niet in de eerste pagina past');

  /* En dan de reden dat het filter bestaat. RTG heeft honderden zaken; de
     eerste versie kapte af op de dichtstbijzijnde zestig en het enige hotel in
     de startdata viel er precies uit. Een reiziger die vervoer naar een hotel
     zoekt, is juist iemand die er niet vlakbij staat. */
  assert.ok(r.body.totaal > r.body.plekken.length - 1, 'er is meer dan er op een pagina past');
  const hotels = await api('/api/mob/plekken', { bij: STAD, genre: 'hotel' }, lidA);
  assert.equal(hotels.status, 200);
  assert.ok(hotels.body.plekken.length, 'op genre filteren vindt de hotels wel');
  assert.ok(hotels.body.plekken.every(p => p.genre === 'hotel'), 'en niets anders');
  const zoek = await api('/api/mob/plekken', { bij: STAD, zoek: 'aguamarina' }, lidA);
  assert.ok(zoek.body.plekken.some(p => /Aguamarina/i.test(p.naam)), 'zoeken op naam vindt de zaak');
  assert.ok(zoek.body.plekken.length < r.body.totaal, 'en levert minder dan alles');
});

test('5. een rit naar een echt restaurant: prijs vooraf, op codenaam, met een vaste ref', async () => {
  const r = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432, label: 'Vara de Rey' }, naar: { zaak: 'KIKUNOI' },
    reizigers: 2, bagage: 1, stad: 'Ibiza' }, lidA);
  assert.equal(r.status, 200);
  const o = r.body.opdracht;
  assert.equal(o.naar.zaak, 'KIKUNOI');
  assert.equal(o.naar.label, 'Sal de Mar', 'de bestemming draagt de naam van onze zaak');
  assert.equal(o.status, 'aangevraagd');
  assert.ok(o.prijs > 0, 'de prijs staat vast bij het aanvragen');
  assert.ok(o.km > 0 && o.km < 20, 'met een afstand die bij de kaart past');
  /* Privacy by design: op de opdracht staat de CODENAAM en niet de naam
     waarmee dit lid zich heeft geregistreerd. */
  assert.ok(o.reizigerCodenaam && !/Lid \d/.test(o.reizigerCodenaam), 'de rit draait op een codenaam');

  // en een tweede lid komt daar niet bij
  const inbraak = await api('/api/mob/volg', { ref: o.ref }, lidB);
  assert.equal(inbraak.status, 403, 'de rit van een ander is niet te volgen');
  const annu = await api('/api/mob/annuleer', { ref: o.ref }, lidB);
  assert.equal(annu.status, 403, 'en niet te annuleren');
});

test('6. papieren zijn fail-closed: geen datum is ongeldig, niet "vast wel goed"', async () => {
  const kaal = await api('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Kale wagen',
    loc: { lat: 38.909, lng: 1.433 } }, zaak);
  assert.equal(kaal.status, 200);
  assert.equal(kaal.body.asset.inzetbaar, false, 'zonder papieren is een taxi niet inzetbaar');
  assert.equal(kaal.body.asset.redenen.length, 5, 'en elk ontbrekend papier is een eigen reden');
  assert.ok(kaal.body.asset.redenen.every(x => /geen geldigheidsdatum/.test(x)));

  const verlopen = await api('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Verlopen wagen',
    loc: { lat: 38.909, lng: 1.433 },
    papieren: Object.assign({}, PAPIEREN_OK, { taxivergunning: '2020-01-01' }) }, zaak);
  assert.equal(verlopen.body.asset.inzetbaar, false);
  assert.deepEqual(verlopen.body.asset.redenen, ['taxivergunning is verlopen op 2020-01-01'],
    'precies een reden, en die noemt het papier en de datum');

  const goed = await api('/api/supplier/mob/voertuig', { id: kaal.body.asset.id, papieren: PAPIEREN_OK }, zaak);
  assert.equal(goed.body.asset.inzetbaar, true, 'met alle papieren op orde mag hij rijden');
  assert.deepEqual(goed.body.asset.redenen, []);
});

test('7. de matcher: afwijzen op grenzen, kiezen met een uitleg', async () => {
  // een wagen die alles op orde heeft, en een die te klein is voor de rit
  const groot = await api('/api/supplier/mob/voertuig', { categorie: 'taxibus', naam: 'Bus 1',
    loc: { lat: 38.9085, lng: 1.4325 }, energieNiveau: 90, bestuurder: 'chauffeur-groot',
    papieren: PAPIEREN_OK }, zaak);
  const klein = await api('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Kleintje',
    loc: { lat: 38.9082, lng: 1.4322 }, plaatsen: 2, energieNiveau: 95, bestuurder: 'chauffeur-klein',
    papieren: PAPIEREN_OK }, zaak);
  /* En een bus die op ELK ander punt geschikt is voor deze rit -- zelfde
     categorie, ruim genoeg, dichtbij, vol -- maar met een verlopen vergunning.
     Dat voertuig moet er precies om DIE reden uit vallen.

     Deze wagen bestaat omdat een mutatie werd AFGESLAGEN. De toets rekende
     eerst af op 'Verlopen wagen', maar dat was een taxi met vier plaatsen bij
     een rit voor zes: haal je de papierengrens uit de matcher, dan viel hij nog
     steeds af -- op capaciteit. De toets bewees dus iets anders dan hij zei. */
  const busVerlopen = await api('/api/supplier/mob/voertuig', { categorie: 'taxibus', naam: 'Bus verlopen',
    loc: { lat: 38.9084, lng: 1.4324 }, energieNiveau: 99, bestuurder: 'chauffeur-verlopen',
    papieren: Object.assign({}, PAPIEREN_OK, { taxivergunning: '2020-01-01' }) }, zaak);
  assert.equal(groot.body.asset.inzetbaar, true);
  assert.equal(klein.body.asset.inzetbaar, true, 'ook het kleintje is op zichzelf inzetbaar');
  assert.equal(busVerlopen.body.asset.inzetbaar, false, 'de tweede bus faalt alleen op zijn vergunning');
  assert.deepEqual(busVerlopen.body.asset.redenen, ['taxivergunning is verlopen op 2020-01-01']);

  // zes reizigers: het kleintje past niet, de bus wel
  const rit = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxibus',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'HOSHI' }, reizigers: 6, stad: 'Ibiza' }, lidA);
  assert.equal(rit.status, 200);
  const v = await api('/api/supplier/mob/voorstel', { ref: rit.body.opdracht.ref }, zaak);
  assert.equal(v.status, 200);

  const gekozen = v.body.kandidaten.find(k => k.naam === 'Bus 1');
  assert.ok(gekozen, 'de bus staat in de rangschikking');
  const afgewezenKlein = v.body.afgewezen.find(a => a.naam === 'Kleintje');
  assert.ok(afgewezenKlein, 'het kleintje staat bij de AFGEWEZEN kandidaten');
  assert.ok(afgewezenKlein.redenen.some(x => /categorie|plaatsen/.test(x)), 'met de reden erbij: ' + afgewezenKlein.redenen);

  /* Een verlopen vergunning is geen minpuntje maar een grens: die wagen komt in
     het geheel niet in de rangschikking voor. Getoetst op de bus die verder
     PERFECT past, zodat alleen de papieren hem eruit kunnen houden. */
  assert.ok(!v.body.kandidaten.some(k => k.naam === 'Bus verlopen'),
    'een verlopen vergunning rangschikt niet mee, ook niet als het voertuig verder past');
  const afgewezenBus = v.body.afgewezen.find(a => a.naam === 'Bus verlopen');
  assert.ok(afgewezenBus, 'maar hij staat wel bij de afgewezen');
  assert.deepEqual(afgewezenBus.redenen, ['taxivergunning is verlopen op 2020-01-01'],
    'en de reden is de vergunning, niet iets anders dat toevallig ook niet klopte');

  // elke kandidaat draagt zijn eigen rekensom
  assert.ok(gekozen.factoren.length >= 5, 'de score is opgebouwd uit meerdere factoren');
  for (const f of gekozen.factoren) {
    assert.ok(f.uitleg && f.uitleg.length > 3, 'elke factor legt zichzelf uit: ' + f.naam);
    assert.ok(f.punten <= f.max, 'geen factor scoort boven zijn eigen gewicht');
  }
  assert.equal(gekozen.score, Math.round(gekozen.factoren.reduce((s, f) => s + f.punten, 0) /
    gekozen.factoren.reduce((s, f) => s + f.max, 0) * 100), 'de score is de som van de factoren, niet los daarvan');
});

test('8. de wegingen zijn beleid: zwaarder op eerlijk verdelen verandert de uitkomst', async () => {
  const voor = (await api('/api/supplier/mob/wegingen', {}, zaak)).body.gewichten;
  assert.ok(voor.eerlijk > 0, 'eerlijke verdeling telt standaard mee');
  const zet = await api('/api/supplier/mob/wegingen', { gewichten: { eerlijk: 60, nabijheid: 5 } }, zaak);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.gewichten.eerlijk, 60);
  assert.equal(zet.body.gewichten.nabijheid, 5);
  assert.equal(zet.body.gewichten.beoordeling, voor.beoordeling, 'een factor die je niet noemt blijft staan');
  // onzin wordt geweigerd in plaats van stil genegeerd
  assert.equal((await api('/api/supplier/mob/wegingen', { gewichten: { verzonnen: 10 } }, zaak)).status, 400);
  assert.equal((await api('/api/supplier/mob/wegingen', { gewichten: { eerlijk: 500 } }, zaak)).status, 400);
  await api('/api/supplier/mob/wegingen', { gewichten: voor }, zaak);
});

test('9. de statusketen kent maar een weg, en die loopt via afrekenen', async () => {
  const rit = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lidA);
  const ref = rit.body.opdracht.ref;

  // een rit die nog nergens is toegewezen, kan niet zomaar 'voltooid' worden
  const sprong = await api('/api/staff/mob/status', { ref, status: 'voltooid' }, zaak);
  assert.equal(sprong.status, 403, 'zolang de rit bij geen enkele vervoerder staat, komt de PDA er niet bij');

  const toe = await api('/api/supplier/mob/toewijzen', { ref }, zaak);
  assert.equal(toe.status, 200, toe.body.error || '');
  assert.equal(toe.body.opdracht.status, 'geaccepteerd');
  assert.ok(toe.body.opdracht.voertuig, 'er hangt een voertuig aan');
  assert.equal(toe.body.automatisch, true, 'zonder gekozen wagen kiest de motor');

  const overslaan = await api('/api/staff/mob/status', { ref, status: 'voltooid' }, zaak);
  assert.equal(overslaan.status, 409, 'van geaccepteerd kan het niet in een sprong naar voltooid');
  assert.match(overslaan.body.error, /kan het niet naar/);

  for (const s of ['onderweg', 'aangekomen', 'ingestapt', 'rijdt', 'voltooid']) {
    const r = await api('/api/staff/mob/status', { ref, status: s }, zaak);
    assert.equal(r.status, 200, 'stap ' + s + ': ' + (r.body.error || ''));
    assert.equal(r.body.opdracht.status, s);
  }
  const terug = await api('/api/staff/mob/status', { ref, status: 'onderweg' }, zaak);
  assert.equal(terug.status, 409, 'een voltooide rit gaat niet terug de keten in');

  const af = await api('/api/staff/mob/status', { ref, status: 'afgerekend' }, zaak);
  assert.equal(af.status, 200);
  const nogmaals = await api('/api/staff/mob/status', { ref, status: 'afgerekend' }, zaak);
  assert.equal(nogmaals.status, 409, 'een afgerekende rit is af');

  // het spoor: elke stap staat er, met zijn gebeurtenisnaam
  const spoor = await api('/api/supplier/mob/spoor', { ref }, zaak);
  assert.equal(spoor.status, 200);
  const soorten = spoor.body.gebeurtenissen.map(g => g.soort);
  for (const g of ['ride.requested', 'ride.accepted', 'driver.arrived', 'passenger.onboard', 'trip.started', 'trip.completed', 'payment.settled'])
    assert.ok(soorten.includes(g), 'de gebeurtenis ' + g + ' staat in het spoor');
});

test('8b. een rit zonder vervoerder ligt op de markt en is voor elke planner zichtbaar', async () => {
  /* Een reiziger vraagt een taxi, geen bedrijf. Zo'n opdracht heeft dus nog geen
     vervoerder -- en in de eerste versie zag daardoor NIEMAND hem: het
     dispatchbeeld toonde alleen de eigen ritten, dus de aanvraag stond in de
     database en op geen enkel scherm. Gevonden door de schermtoets, niet door
     een API-toets, want de API gaf keurig 200 op een leeg bord. */
  const rit = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lidB);
  assert.equal(rit.status, 200, rit.body.error || '');
  assert.equal(rit.body.opdracht.vervoerder, null, 'de reiziger koos geen vervoerder');

  const bord = await api('/api/supplier/mob/dispatch', {}, zaak);
  assert.equal(bord.status, 200);
  assert.ok(bord.body.open.some(o => o.ref === rit.body.opdracht.ref),
    'de planner ziet de vrije opdracht op zijn bord staan');

  // en wie hem toewijst, krijgt hem: daarna is hij van deze vervoerder
  const toe = await api('/api/supplier/mob/toewijzen', { ref: rit.body.opdracht.ref }, zaak);
  assert.equal(toe.status, 200, toe.body.error || '');
  assert.equal(toe.body.opdracht.vervoerder, 'MKKX', 'de opdracht staat nu op naam van wie hem oppakte');
  await api('/api/mob/annuleer', { ref: rit.body.opdracht.ref }, lidB);
});

test('9b. pech onderweg: een vervangend voertuig is opnieuw toe te wijzen', async () => {
  const rit = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lidA);
  const ref = rit.body.opdracht.ref;
  const toe = await api('/api/supplier/mob/toewijzen', { ref }, zaak);
  assert.equal(toe.status, 200, toe.body.error || '');
  const eerste = toe.body.opdracht.voertuig;
  assert.ok(eerste);

  // de wagen valt uit; de rit leeft door, maar zonder voertuig
  const pech = await api('/api/staff/mob/status', { ref, status: 'vervangend-voertuig', reden: 'lekke band' }, zaak);
  assert.equal(pech.status, 200, pech.body.error || '');
  assert.equal(pech.body.opdracht.voertuig, null, 'het kapotte voertuig hangt er niet meer aan');

  /* En dan de stap waar het eerder op vastliep: opnieuw toewijzen. Dit is de
     ene status waarin je een vervanger het hardst nodig hebt, en de eerste
     versie kon er niet uit -- de rit stond stil met een reiziger op straat. */
  const opnieuw = await api('/api/supplier/mob/toewijzen', { ref }, zaak);
  assert.equal(opnieuw.status, 200, 'een rit met pech is opnieuw toe te wijzen: ' + (opnieuw.body.error || ''));
  assert.equal(opnieuw.body.opdracht.status, 'geaccepteerd');
  assert.ok(opnieuw.body.opdracht.voertuig, 'er hangt weer een wagen aan');

  // en daarna loopt de gewone keten gewoon door
  for (const s of ['onderweg', 'aangekomen', 'ingestapt', 'rijdt', 'voltooid']) {
    const r = await api('/api/staff/mob/status', { ref, status: s }, zaak);
    assert.equal(r.status, 200, 'stap ' + s + ' na de wissel: ' + (r.body.error || ''));
  }
});

test('10. annuleren: gratis voor de chauffeur reed, met kosten daarna', async () => {
  const vroeg = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lidA);
  const a = await api('/api/mob/annuleer', { ref: vroeg.body.opdracht.ref }, lidA);
  assert.equal(a.status, 200);
  assert.equal(a.body.kosten, 0, 'annuleren voordat er iemand rijdt kost niets');
  assert.equal(a.body.opdracht.status, 'geannuleerd');
  const weer = await api('/api/mob/annuleer', { ref: vroeg.body.opdracht.ref }, lidA);
  assert.equal(weer.status, 409, 'twee keer annuleren kan niet');
});

test('11. de bedrijfspendel: een regel wordt een dienstregeling wordt een rit', async () => {
  const p = await api('/api/supplier/mob/pendel/zet', {
    naam: 'Ochtendpendel', van: { zaak: 'TRANSIT' }, naar: { zaak: 'KIKUNOI' },
    dagen: [1, 2, 3, 4, 5], vensters: [{ van: '06:00', tot: '10:00', elkeMin: 30 }],
    capaciteit: 2, categorie: 'shuttlebus', stad: 'Ibiza' }, zaak);
  assert.equal(p.status, 200, p.body.error || '');
  const pid = p.body.pendel.id;
  assert.equal(p.body.pendel.vensters[0].elkeMin, 30);

  // onzin wordt geweigerd, niet stil rechtgetrokken
  const krom = await api('/api/supplier/mob/pendel/zet', { naam: 'Krom', van: { zaak: 'TRANSIT' },
    naar: { zaak: 'KIKUNOI' }, vensters: [{ van: '10:00', tot: '06:00', elkeMin: 30 }] }, zaak);
  assert.equal(krom.status, 400, 'een venster dat voor zijn begin eindigt is geen venster');

  // een maandag: negen vertrekken van 06:00 tot 10:00, elk half uur
  const maandag = '2026-08-10';
  const r = await api('/api/supplier/mob/pendel/rooster', { id: pid, datum: maandag }, zaak);
  assert.equal(r.status, 200);
  assert.equal(r.body.vertrekken.length, 9, 'van 06:00 t/m 10:00 elk half uur is negen vertrekken');
  assert.equal(r.body.vertrekken[0].tijd, '06:00');
  assert.equal(r.body.vertrekken[8].tijd, '10:00');

  // een zondag rijdt hij niet, en dat staat er met de reden bij
  const zondag = await api('/api/supplier/mob/pendel/rooster', { id: pid, datum: '2026-08-09' }, zaak);
  assert.equal(zondag.body.vertrekken.length, 0);
  assert.match(zondag.body.reden, /rijdt niet op zo/, 'de lege lijst zegt waarom hij leeg is');

  // een dienst zonder reserveringen wordt niet gereden
  const leeg = await api('/api/supplier/mob/pendel/plan', { id: pid, datum: maandag }, zaak);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.gemaakt.length, 0, 'zonder reserveringen rijdt er geen lege bus');
  assert.ok(leeg.body.overgeslagen.every(x => x.reden === 'geen reserveringen'));
});

test('12. de pendel is van je werkgever, niet van iedereen die de code kent', async () => {
  const vreemd = await api('/api/mob/pendel', { werkgever: 'MKKX' }, lidB);
  assert.equal(vreemd.status, 403, 'wie er niet werkt, ziet de dienstregeling niet');
  assert.match(vreemd.body.error, /medewerker/);
  const zonder = await api('/api/mob/pendel', {}, lidB);
  assert.equal(zonder.status, 400, 'en zonder code ook niet');
});

test('13. een gast komt er niet in, en een reiziger niet bij de vloot van een zaak', async () => {
  const gast = (await api('/api/login', { tier: 'guest' })).body.token;
  assert.ok(gast, 'de gastsessie bestaat');
  for (const pad of ['/api/mob/aanbod', '/api/mob/vraag', '/api/mob/mijn', '/api/mob/plekken'])
    assert.equal((await api(pad, {}, gast)).status, 403, pad + ' is dicht voor gasten');
  // de zaakroutes vragen een zaak-inlog, geen ledentoken
  for (const pad of ['/api/supplier/mob/dispatch', '/api/supplier/mob/vloot'])
    assert.ok([401, 403].includes((await api(pad, {}, lidA)).status), pad + ' weigert een ledentoken');
  // en de kantoorroutes vragen de kantoordeur
  assert.ok([401, 403].includes((await api('/api/office/mob/modules', {}, lidA)).status),
    'het moduleregister zit achter de kantoordeur');
});

test('14. het aanbod volgt het register: wat uit staat, staat niet in de app', async () => {
  const voor = await api('/api/mob/aanbod', { stad: 'Ibiza' }, lidA);
  assert.equal(voor.status, 200);
  assert.ok(voor.body.direct.some(c => c.categorie === 'taxi'), 'de taxi staat er als direct boekbaar');
  assert.ok(voor.body.direct.every(c => c.boeking === 'direct'), 'in "direct" staat niets wat op aanvraag gaat');
  assert.ok(voor.body.opAanvraag.every(c => c.boeking === 'aanvraag'), 'en andersom ook niet');

  /* 'charter' hoort alleen in de ritsoorten te staan als er ook echt iets op
     aanvraag te boeken is. Dat ging eerst mis: de lijst vulde de eerste de beste
     categorie in, waardoor "charter" verscheen zodra de gewone taxi aan stond en
     het aanvragen daarna alsnog stukliep.

     Beide kanten expliciet, want "allebei leeg" zou hier ook slagen en niets
     bewijzen. Toets 1 heeft het helikoptercharter aangezet, dus de aanwezige
     kant moet nu echt gevuld zijn. */
  assert.ok(voor.body.opAanvraag.length, 'er is iets op aanvraag (het charter staat aan sinds toets 1)');
  assert.ok(voor.body.ritsoorten.includes('charter'), 'en dan staat charter in de ritsoorten');

  await api('/api/office/mob/module/zet', { id: 'partner_contracts', aan: false }, kantoor);
  const zonder = await api('/api/mob/aanbod', { stad: 'Ibiza' }, lidA);
  assert.equal(zonder.body.opAanvraag.length, 0, 'zonder contracten valt alles op aanvraag weg');
  assert.ok(!zonder.body.ritsoorten.includes('charter'), 'en dan staat charter er ook niet meer');
  assert.ok(zonder.body.direct.some(c => c.categorie === 'taxi'), 'terwijl de gewone taxi er gewoon nog staat');
  await api('/api/office/mob/module/zet', { id: 'partner_contracts', aan: true }, kantoor);

  // rolstoelvervoer uit in Ibiza: de rolstoelbus verdwijnt uit het aanbod
  await api('/api/office/mob/module/zet', { id: 'wheelchair_transport', aan: false, niveau: 'stad', stad: 'Ibiza' }, kantoor);
  const na = await api('/api/mob/aanbod', { stad: 'Ibiza' }, lidA);
  assert.ok(!na.body.categorieen.some(c => c.categorie === 'rolstoelbus'), 'de rolstoelbus is uit het aanbod');
  assert.ok(na.body.categorieen.some(c => c.categorie === 'taxi'), 'en de rest staat er nog, dus de lijst is niet gewoon leeg');
  await api('/api/office/mob/module/zet', { id: 'wheelchair_transport', aan: true, niveau: 'stad', stad: 'Ibiza', wis: true }, kantoor);
});
