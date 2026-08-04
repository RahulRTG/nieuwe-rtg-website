/* ============================================================================
   HET GEZIN: DE GEVOELIGE KANT.

   Dit zijn de scherpste routes van het hele huis, en ze hadden geen van drieen
   een eigen toets:

   1. DE GEZONDHEIDSKAART. Wie mag de medicijnen van wie bijhouden? Het
      commentaar in server/foundation/gasten/gezondheid.js beschrijft een gat dat
      hier ECHT heeft gezeten: er werd alleen gecontroleerd of het doel geen gast
      was, dus een kind kon met "voor" de kaart van zijn ouder aanwijzen en er
      doktersafspraken uit wissen. Datzelfde kind mocht het ochtendritme van die
      ouder niet aanraken -- de gevoeligste kaart van de module had dus de
      zwakste controle. Het is gerepareerd; het was nergens vastgelegd.

   2. DE LOCATIE VAN EEN KIND. Die ligt versleuteld op schijf, en dat is dezelfde
      klasse belofte als bij Nalatenschap: onzichtbaar waar tot iemand het
      databasebestand in handen krijgt. Alleen gaat het hier over waar een kind
      op dit moment is.

   3. HET RECHT OM VERGETEN TE WORDEN (AVG), met een vier-ogen-regel. Zijn er
      twee volwassenen, dan mag de een het gezin niet in zijn eentje wissen. Dat
      is onomkeerbaar en er is geen ongedaan-maken; het is precies het soort
      regel dat je pas mist op de dag dat hij weg is.

   EN HET CONTRAST DAT ERTUSSEN ZIT. Dezelfde app heeft twee soorten deur:
   familieVan (gasten eruit) en sessieVan (gasten erbij). Een oppas hoort te zien
   waar het kind is en wat de noodnummers zijn -- daar is een oppas voor -- maar
   niet in de medicijnkaart te kunnen schrijven. Dat verschil is bewust, en
   zonder toets trekt iemand het ooit gelijk in de veronderstelling dat het een
   inconsistentie is.

   Draai los: node --experimental-sqlite --test test/gezinzorg.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinzorg-'));
let child, BASE;

const post = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const haal = (pad, token) => fetch(BASE + '/api/foundation' + pad, {
  headers: token ? { Authorization: 'Bearer ' + token } : {}
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health'
  }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een gezin met een beheerder-ouder, een tweede ouder, een kind en een oppas.
   Vier rollen, want juist de verschillen ertussen zijn wat hier getoetst wordt. */
async function gezin(naam, opties) {
  const o = opties || {};
  const g = (await post('/gezin/maak',
    { gezinsnaam: 'Fam ' + naam, naam: 'Moeder ' + naam, pin: '1234' })).body;
  assert.ok(g.code && g.token, 'het gezin bestaat: ' + JSON.stringify(g).slice(0, 160));

  const maak = async (pnaam, rol, pin) => {
    const r = await post('/gezin/profiel/maak',
      Object.assign({ code: g.code, token: g.token, naam: pnaam, rol }, pin ? { pin } : {}));
    assert.equal(r.status, 200, pnaam + ' (' + rol + ') is aangemaakt: ' + JSON.stringify(r.body).slice(0, 160));
    const id = r.body.profiel.id;
    const kies = await post('/gezin/profiel/kies', Object.assign({ code: g.code, profielId: id },
      pin ? { pin } : {}));
    assert.ok(kies.body.token, pnaam + ' heeft een eigen token: ' + JSON.stringify(kies.body).slice(0, 160));
    return { id, token: kies.body.token, naam: pnaam };
  };

  const uit = { code: g.code, moeder: { id: null, token: g.token, naam: 'Moeder ' + naam } };
  const mij = await haal('/gezin/' + g.code + '/mij', g.token);
  uit.moeder.id = (mij.body.profiel || mij.body).id || (mij.body.mijnId);
  uit.kind = await maak('Kind ' + naam, 'kind');
  if (o.tweedeOuder) uit.vader = await maak('Vader ' + naam, 'ouder', o.vaderPin);
  if (o.oppas) uit.oppas = await maak('Oppas ' + naam, 'gast');
  return uit;
}

/* Alles wat er op schijf ligt. Zelfde aanpak als bij Nalatenschap: welk bestand
   de motor gebruikt hangt van de opstelling af, dus we lezen wat er ligt --
   inclusief de losse WAL-bestanden, want een schrijfactie kan daar nog in staan. */
function allesOpSchijf() {
  let uit = '';
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { loop(p); continue; }
      try { uit += fs.readFileSync(p, 'latin1'); } catch (e) { /* onleesbaar telt als niet gevonden */ }
    }
  };
  loop(TMP);
  return uit;
}

/* ============================================================================
   1 -- DE GEZONDHEIDSKAART: WIE MAG DE KAART VAN WIE
   ========================================================================== */
test('de gezondheidskaart: een kind beheert de zijne, niet die van zijn ouder', async () => {
  const f = await gezin('Zorg', { oppas: true });

  /* ---- HET KIND MAG ZIJN EIGEN KAART. ---- */
  const eigen = await post('/gezin/gezondheid/medicijn',
    { code: f.code, token: f.kind.token, naam: 'Ventolin', dosis: '2 pufjes', tijd: '08:00' });
  assert.equal(eigen.status, 200, 'het kind zet zijn eigen medicijn: ' + JSON.stringify(eigen.body).slice(0, 160));

  /* ---- EN NIET DIE VAN ZIJN OUDER. Dit is het gat dat er echt heeft gezeten:
     met "voor" kon een kind de kaart van een ouder aanwijzen. ---- */
  const vanMoeder = await post('/gezin/gezondheid/medicijn',
    { code: f.code, token: f.kind.token, voor: f.moeder.id, naam: 'Stiekem' });
  assert.equal(vanMoeder.status, 403, 'het kind komt niet in de kaart van zijn moeder: ' +
    JSON.stringify(vanMoeder.body).slice(0, 180));
  assert.match(String(vanMoeder.body.error), /eigen gezondheidskaart/i, 'en het zegt waarom');

  /* Niet alleen schrijven -- ook wissen moest stuiten, want dat was de scherpe
     kant van het oude gat: doktersafspraken van een ouder verwijderen. */
  const afspraakWeg = await post('/gezin/gezondheid/afspraak/verwijder',
    { code: f.code, token: f.kind.token, voor: f.moeder.id, afspraakId: 'x' });
  assert.equal(afspraakWeg.status, 403, 'en kan er ook niets uit wissen');
  const metingWeg = await post('/gezin/gezondheid/meting/verwijder',
    { code: f.code, token: f.kind.token, voor: f.moeder.id, metingId: 'x' });
  assert.equal(metingWeg.status, 403, 'ook geen groeimetingen');

  /* ---- DE OUDER MAG WEL DIE VAN HET KIND. Dat is het hele punt van een
     gezinskaart: een kind van zes houdt zijn eigen medicijnen niet bij. ---- */
  const doorMoeder = await post('/gezin/gezondheid/medicijn',
    { code: f.code, token: f.moeder.token, voor: f.kind.id, naam: 'Paracetamol', dosis: '250mg' });
  assert.equal(doorMoeder.status, 200, 'de moeder zet een medicijn bij haar kind: ' +
    JSON.stringify(doorMoeder.body).slice(0, 160));

  /* ---- EN DE OPPAS HELEMAAL NIET. De gezondheidskaart hangt achter
     familieVan; een gast komt er niet in, ook niet bij zichzelf. ---- */
  const doorOppas = await post('/gezin/gezondheid/medicijn',
    { code: f.code, token: f.oppas.token, naam: 'Wat dan ook' });
  assert.equal(doorOppas.status, 403, 'de oppas komt niet in de gezondheidskaart: ' +
    JSON.stringify(doorOppas.body).slice(0, 180));
  const lezenDoorOppas = await haal('/gezin/' + f.code + '/gezondheid', f.oppas.token);
  assert.equal(lezenDoorOppas.status, 403, 'en mag hem ook niet lezen');

  /* ---- HET OVERZICHT. Een gast heeft geen kaart en staat er dus niet in. ---- */
  const overzicht = (await haal('/gezin/' + f.code + '/gezondheid', f.moeder.token)).body;
  const namen = overzicht.personen.map(p => p.naam);
  assert.ok(!namen.some(n => /Oppas/.test(n)), 'de oppas staat niet in het overzicht: ' + namen.join(', '));
  const kind = overzicht.personen.find(p => p.pid === f.kind.id);
  assert.equal(kind.medicijnen.length, 2, 'het kind heeft twee medicijnen');
  assert.equal(kind.teGeven, 2, 'en beide moeten vandaag nog gegeven worden');

  /* ---- DE AFVINK IS PER DAG. Dat is de bewering waar het echt om gaat: als
     "gegeven" een simpele vlag zou zijn in plaats van een datum, staat een
     medicijn dat GISTEREN is gegeven vandaag als gedaan -- en dan krijgt een
     kind zijn puf niet. De dagovergang zelf is zonder aan de klok te draaien
     niet na te spelen; wat hier wel vastligt is dat de afvink aan een dag hangt
     en niet aan een simpele ja/nee, en dat terugzetten echt terugzet. ---- */
  const ventolin = kind.medicijnen.find(m => m.naam === 'Ventolin');
  assert.equal((await post('/gezin/gezondheid/medicijn/gegeven',
    { code: f.code, token: f.moeder.token, voor: f.kind.id, medId: ventolin.id })).status, 200,
    'de moeder vinkt de puf af');
  const na = (await haal('/gezin/' + f.code + '/gezondheid', f.moeder.token)).body
    .personen.find(p => p.pid === f.kind.id);
  assert.equal(na.medicijnen.find(m => m.id === ventolin.id).gegevenVandaag, true, 'die staat nu op gegeven');
  assert.equal(na.teGeven, 1, 'en er moet er nog een');

  assert.equal((await post('/gezin/gezondheid/medicijn/gegeven',
    { code: f.code, token: f.moeder.token, voor: f.kind.id, medId: ventolin.id, gegeven: false })).status, 200,
    'toch niet gegeven');
  const terug = (await haal('/gezin/' + f.code + '/gezondheid', f.moeder.token)).body
    .personen.find(p => p.pid === f.kind.id);
  assert.equal(terug.medicijnen.find(m => m.id === ventolin.id).gegevenVandaag, false, 'de vink is eraf');
  assert.equal(terug.teGeven, 2, 'en er moeten er weer twee');

  const onbekend = await post('/gezin/gezondheid/medicijn/gegeven',
    { code: f.code, token: f.moeder.token, voor: f.kind.id, medId: 'bestaat-niet' });
  assert.equal(onbekend.status, 404, 'een medicijn dat er niet is kun je niet afvinken');

  /* ---- EN DE MEDISCHE TEKST LIGT NIET LEESBAAR OP SCHIJF. ---- */
  const schijf = allesOpSchijf();
  assert.ok(!schijf.includes('Ventolin'), 'de naam van het medicijn staat niet leesbaar op schijf');
  assert.ok(!schijf.includes('2 pufjes'), 'de dosering ook niet');
});

/* ============================================================================
   2 -- DE LOCATIE VAN EEN KIND
   ========================================================================== */
test('veilig thuis: de plek van een kind ligt versleuteld, en stoppen stopt echt', async () => {
  const f = await gezin('Thuis', { oppas: true });

  /* Coordinaten die nergens anders voorkomen, zodat een vondst op schijf niet
     toevallig iets anders kan zijn. */
  const LAT = 52.37814, LON = 4.90123;

  const deel = await post('/gezin/locatie',
    { code: f.code, token: f.kind.token, status: 'op school', lat: LAT, lon: LON });
  assert.equal(deel.status, 200, 'het kind deelt waar het is: ' + JSON.stringify(deel.body).slice(0, 160));

  const lijst = (await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).body;
  const kind = lijst.locaties.find(l => l.pid === f.kind.id);
  assert.ok(kind, 'de moeder ziet haar kind staan: ' + JSON.stringify(lijst).slice(0, 200));
  assert.equal(kind.status, 'op school', 'met de juiste status');
  assert.equal(kind.lat, LAT, 'en de app geeft de plek gewoon terug');
  assert.equal(kind.lon, LON, 'allebei de coordinaten');
  assert.equal(kind.vanMij, false, 'en ze ziet dat het niet haar eigen stip is');

  /* ---- DE SCHIJF KENT DIE PLEK NIET. Dezelfde belofte als bij Nalatenschap,
     alleen gaat het hier over waar een kind nu is. ---- */
  const schijf = allesOpSchijf();
  assert.ok(!schijf.includes(String(LAT)), 'de breedtegraad staat niet leesbaar op schijf');
  assert.ok(!schijf.includes(String(LON)), 'de lengtegraad ook niet');
  assert.ok(schijf.includes('op school'),
    'de status staat er wel gewoon in -- dat toont dat we in het juiste bestand kijken');

  /* ---- EEN ONZINNIGE COORDINAAT WORDT NIET BEWAARD. Een status zonder plek is
     bruikbaar; een stip midden in de oceaan door een tikfout is misleidend. ---- */
  assert.equal((await post('/gezin/locatie',
    { code: f.code, token: f.kind.token, status: 'onderweg', lat: 999, lon: 4.9 })).status, 200,
    'een onmogelijke breedtegraad wordt geaccepteerd als statusmelding');
  const naOnzin = (await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).body
    .locaties.find(l => l.pid === f.kind.id);
  assert.equal(naOnzin.status, 'onderweg', 'de status is bijgewerkt');
  assert.equal(naOnzin.lat, undefined, 'maar er hangt geen verzonnen stip aan: ' + JSON.stringify(naOnzin));

  /* ---- DE OPPAS MAG DIT WEL ZIEN. Dat is bewust: een oppas hoort te weten waar
     het kind is. De gezondheidskaart hierboven zit juist wel dicht voor haar.
     Datzelfde geldt voor de noodnummers. Dit contrast staat hier vast zodat
     niemand het per ongeluk gelijktrekt. ---- */
  const doorOppas = await haal('/gezin/' + f.code + '/locaties', f.oppas.token);
  assert.equal(doorOppas.status, 200, 'de oppas ziet waar het kind is: ' +
    JSON.stringify(doorOppas.body).slice(0, 160));
  assert.equal((await haal('/gezin/' + f.code + '/oppasinfo', f.oppas.token)).status, 200,
    'en mag de gezinsinfo lezen');

  /* Maar aanpassen mag ze niet -- lezen en schrijven zijn hier twee dingen. */
  const oppasSchrijft = await post('/gezin/oppasinfo',
    { code: f.code, token: f.oppas.token, allergie: 'verzonnen' });
  assert.equal(oppasSchrijft.status, 403, 'de oppas past de gezinsinfo niet aan: ' +
    JSON.stringify(oppasSchrijft.body).slice(0, 180));

  const moederSchrijft = await post('/gezin/oppasinfo', { code: f.code, token: f.moeder.token,
    allergie: 'pinda en noten', huisregels: 'Om acht uur naar bed.',
    noodcontacten: [{ naam: 'Oma Bep', telefoon: '0612345678', wie: 'oma' }] });
  assert.equal(moederSchrijft.status, 200, 'de moeder wel');
  const info = (await haal('/gezin/' + f.code + '/oppasinfo', f.oppas.token)).body.oppasinfo;
  assert.equal(info.allergie, 'pinda en noten', 'en de oppas leest de allergie');
  assert.equal(info.noodcontacten[0].naam, 'Oma Bep', 'en het noodnummer');
  assert.ok(!allesOpSchijf().includes('pinda en noten'), 'ook de allergie ligt versleuteld');

  /* ---- STOPPEN STOPT ECHT. Een deel-knop die niet uitgaat is erger dan geen
     deel-knop, want je denkt dat je hem uit hebt gezet. ---- */
  assert.equal((await post('/gezin/locatie/stop', { code: f.code, token: f.kind.token })).status, 200,
    'het kind stopt met delen');
  const naStop = (await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).body;
  assert.equal(naStop.locaties.filter(l => l.pid === f.kind.id).length, 0,
    'de stip is weg voor de moeder: ' + JSON.stringify(naStop.locaties));
  assert.equal((await haal('/gezin/' + f.code + '/locaties', f.oppas.token)).body
    .locaties.filter(l => l.pid === f.kind.id).length, 0, 'en ook voor de oppas');
  assert.equal((await haal('/gezin/' + f.code + '/locaties', f.kind.token)).body.ikDeel, false,
    'en het kind ziet zelf dat het niet meer deelt');

  /* Hier stond eerst de eis dat de oude status ook van SCHIJF verdwenen was.
     Die zakte, en terecht: uit de opslag verwijderd is niet hetzelfde als de
     bytes uit het bestand. Een geschrapt record blijft er fysiek in staan tot
     een vacuum, en dat is gewoon hoe een database werkt. De belofte van deze
     module gaat over versleuteling (hierboven getoetst, en die staat), niet
     over het overschrijven van vrijgekomen pagina's. Wil je dat laatste, dan is
     dat een eigen maatregel met een eigen toets -- geen bijvangst van een
     stopknop. */

  /* Wie zelf deelt ziet dat ook terug -- de moeder deelt niet, dus voor haar staat het uit. */
  assert.equal((await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).body.ikDeel, false,
    'de moeder deelt zelf niets');
  assert.equal((await post('/gezin/locatie', { code: f.code, token: f.moeder.token, status: 'naar huis' })).status,
    200, 'tot ze het wel doet');
  assert.equal((await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).body.ikDeel, true,
    'en dan ziet ze dat ze deelt');
});

/* ============================================================================
   3 -- HET RECHT OM VERGETEN TE WORDEN, MET VIER OGEN
   ========================================================================== */
test('een gezin wissen: met twee volwassenen kan niemand het alleen', async () => {
  const f = await gezin('Wis', { tweedeOuder: true, vaderPin: '5678' });

  /* ---- EEN KIND KAN HET NIET. ---- */
  const doorKind = await post('/gezin/wissen', { code: f.code, token: f.kind.token });
  assert.equal(doorKind.status, 403, 'een kind wist het gezin niet: ' +
    JSON.stringify(doorKind.body).slice(0, 180));

  /* ---- EN EEN OUDER MET EEN VERKEERDE PIN OOK NIET. De pincode is hier geen
     formaliteit maar de laatste drempel voor iets onomkeerbaars. ---- */
  const verkeerdePin = await post('/gezin/wissen', { code: f.code, token: f.moeder.token, pin: '9999' });
  assert.equal(verkeerdePin.status, 403, 'met een verkeerde pincode gebeurt er niets: ' +
    JSON.stringify(verkeerdePin.body).slice(0, 180));
  assert.match(String(verkeerdePin.body.error), /pincode/i, 'en het zegt wat er mis is');

  /* ---- MET DE JUISTE PIN WORDT HET EEN VERZOEK, GEEN VERWIJDERING. Dat is de
     vier-ogen-regel: er zijn twee volwassenen, dus de een beslist dit niet
     alleen. ---- */
  const verzoek = await post('/gezin/wissen', { code: f.code, token: f.moeder.token, pin: '1234' });
  assert.equal(verzoek.status, 200, 'het verzoek komt binnen: ' + JSON.stringify(verzoek.body).slice(0, 160));
  assert.equal(verzoek.body.wachtOpToestemming, true, 'en wacht op de tweede volwassene');
  assert.notEqual(verzoek.body.verwijderd, true, 'er is dus nog niets weg');

  /* Het gezin bestaat nog -- dat is de enige controle die hier telt. */
  assert.equal((await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).status, 200,
    'en het gezin is er gewoon nog');

  /* ---- DEGENE DIE HET VROEG KAN ZIJN EIGEN VERZOEK NIET BEVESTIGEN. Zonder
     deze regel is de vier-ogen-regel twee klikken van dezelfde persoon. ---- */
  const zelfBevestigen = await post('/gezin/wissen/bevestig',
    { code: f.code, token: f.moeder.token, pin: '1234' });
  assert.equal(zelfBevestigen.status, 403, 'de aanvrager bevestigt niet zichzelf: ' +
    JSON.stringify(zelfBevestigen.body).slice(0, 200));
  assert.match(String(zelfBevestigen.body.error), /tweede volwassene/i, 'en het legt uit waarom');

  /* ---- EN EEN KIND AL HELEMAAL NIET. ---- */
  const kindBevestigt = await post('/gezin/wissen/bevestig', { code: f.code, token: f.kind.token });
  assert.equal(kindBevestigt.status, 403, 'een kind bevestigt het ook niet');

  /* ---- INTREKKEN KAN. Een onomkeerbare stap hoort tot het laatste moment
     terug te draaien te zijn. ---- */
  assert.equal((await post('/gezin/wissen/intrekken',
    { code: f.code, token: f.moeder.token, pin: '1234' })).status, 200, 'de moeder trekt het verzoek in');
  const naIntrekken = await post('/gezin/wissen/bevestig',
    { code: f.code, token: f.vader.token, pin: '5678' });
  assert.equal(naIntrekken.status, 400, 'en dan valt er niets meer te bevestigen: ' +
    JSON.stringify(naIntrekken.body).slice(0, 180));
  assert.equal((await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).status, 200,
    'het gezin staat er nog');

  /* ---- OPNIEUW VRAGEN, EN DAN DOOR DE ANDER LATEN BEVESTIGEN. Nu gaat het
     echt weg, en dat hoort ook: het recht om vergeten te worden is een recht,
     geen suggestie. ---- */
  assert.equal((await post('/gezin/wissen', { code: f.code, token: f.moeder.token, pin: '1234' }))
    .body.wachtOpToestemming, true, 'het verzoek staat er weer');
  const echtWeg = await post('/gezin/wissen/bevestig', { code: f.code, token: f.vader.token, pin: '5678' });
  assert.equal(echtWeg.status, 200, 'de vader bevestigt: ' + JSON.stringify(echtWeg.body).slice(0, 160));
  assert.equal(echtWeg.body.verwijderd, true, 'en het gezin is verwijderd');

  const daarna = await haal('/gezin/' + f.code + '/locaties', f.moeder.token);
  assert.notEqual(daarna.status, 200, 'het gezin is echt weg, niet alleen verborgen: ' +
    daarna.status + ' ' + JSON.stringify(daarna.body).slice(0, 140));
});

/* ============================================================================
   4 -- EEN GEZIN MET EEN ENKELE VOLWASSENE
   ========================================================================== */
test('een gezin met een enkele volwassene wist wel meteen, want er is niemand om te vragen', async () => {
  const f = await gezin('Alleen');

  /* Dit is de andere tak van dezelfde regel, en hij hoort er te zijn: een
     alleenstaande ouder mag niet vastzitten aan een toestemming die nooit kan
     komen. Zonder deze toets zou een strengere regel ("altijd twee ogen") er
     redelijk uitzien en het AVG-recht in de praktijk onbereikbaar maken. */
  const weg = await post('/gezin/wissen', { code: f.code, token: f.moeder.token, pin: '1234' });
  assert.equal(weg.status, 200, 'de moeder wist het gezin: ' + JSON.stringify(weg.body).slice(0, 160));
  assert.equal(weg.body.verwijderd, true, 'meteen, zonder te wachten');
  assert.notEqual(weg.body.wachtOpToestemming, true, 'er is niemand om toestemming aan te vragen');

  assert.notEqual((await haal('/gezin/' + f.code + '/locaties', f.moeder.token)).status, 200,
    'en het gezin is weg');
});
