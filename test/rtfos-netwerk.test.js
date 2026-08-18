/* ============================================================================
   HET FOUNDATION OS, FASE VIER: HET NETWERKEFFECT

   Delen, samen kopen, mensen uitwisselen, landelijk werven. Dit is de laag waar
   een federatie iets waard wordt -- en tegelijk de laag waar een federatie zijn
   eigen governance omzeilt met het argument "we doen het samen". Deze toetsen
   gaan daarom vooral over wat er NIET mag versloffen zodra steden samenwerken:

     1. een blauwdruk komt uit een project dat echt gedraaid heeft, en wie hem
        overneemt begint bij "idee" -- niet bij "goedgekeurd";
     2. een gezamenlijke inkoop laat elke stad uit EIGEN bronnen betalen, en
        sluiten maakt per stad een gewone uitgave-aanvraag die daar nog door de
        vier ogen moet;
     3. de verdeling van een inkoop en van een campagneronde klopt tot de cent;
     4. een verdeelsleutel die niet op 100% uitkomt, wordt geweigerd;
     5. een vrijwilliger wordt niet verplaatst maar gevraagd: zonder vastgelegde
        toestemming loopt de uitleen niet, en zonder lopende uitleen komt hij in
        de andere stad niet op een project;
     6. het koppelbord met RTG zegt eerlijk wat NIET werkt, met de reden.

   MUTATIES (LAT.md regel 2), zes stuks, elk op hun eigen bewering en met de
   rest groen:
     - de eis "ten minste een indicator met resultaat" uit netwerk.js halen;
     - de overgenomen blauwdruk als 'actief' laten binnenkomen;
     - de bron-stad-controle in inkoop.js weghalen;
     - de grootste-rest-lus in inkoop-sluiten.js vervangen door kale afronding
       (die lus was eerst dode code -- zie hieronder);
     - de eis dat de campagnesleutel op 1000 promille sluit weghalen;
     - de magInStad-controle bij het koppelen weghalen.

   Draai los: node --test test/rtfos-netwerk.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfos4-'));
const OFFICE_CODE = 'RTFOS4-KEURING';

let srv, BASE, LAND, A, B, PROJ_A, PROJ_B, BRON_A, BRON_B, BESTUUR_A, BESTUUR_B;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const os_ = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || LAND);

async function kantoorLid(naam, mail, tel) {
  const reg = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'registreren mislukte: ' + JSON.stringify(reg.body).slice(0, 150));
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  const start = await post('/api/account/start', { rol: 'kantoor' }, reg.body.token);
  const ik = await os_('ik', {}, start.body.token);
  return { office: start.body.token, key: ik.body.key };
}

/* Een stad opzetten. De volgorde is niet vrij: eerst de stad en de zetel, dan
   pas het project. Het stadsbestuur dient het project in en het LANDELIJKE
   bestuur keurt goed -- met een identiteit voor beide stappen loopt het decor
   vast op de vierogen-grendel, en dan toetst dit bestand het decor in plaats
   van het netwerk. */
async function stadMet(naam, projectNaam, bestuurKey) {
  const stad = (await os_('stad/maak', { naam })).body.stad.id;
  await os_('stad/status', { id: stad, status: 'actief' });
  for (const vlag of ['youth_programs', 'donations', 'volunteer_management', 'events']) {
    await os_('stad/module', { id: stad, vlag, aan: true });
  }
  const z = await os_('zetel', { stad, key: bestuurKey.key, naam: 'Bestuur ' + naam, rol: 'stadsbestuur' });
  assert.equal(z.status, 200, 'zetel mislukte: ' + JSON.stringify(z.body).slice(0, 150));
  const tok = bestuurKey.office;
  const p = await os_('project/maak', { stad, naam: projectNaam, soort: 'jongeren',
    budget: 2000, doelgroep: 'jongeren 12-18' }, tok);
  const projectId = p.body.project.id;
  await os_('project/status', { id: projectId, status: 'aanvraag' }, tok);
  await os_('project/status', { id: projectId, status: 'beoordeling' }, tok);
  const goed = await os_('project/status', { id: projectId, status: 'goedgekeurd' });
  assert.equal(goed.status, 200, 'goedkeuren mislukte: ' + JSON.stringify(goed.body).slice(0, 150));
  const act = await os_('project/status', { id: projectId, status: 'actief' });
  assert.equal(act.status, 200, 'activeren mislukte: ' + JSON.stringify(act.body).slice(0, 150));
  const bron = await os_('bron/maak', { stad, soort: 'donatie', gever: 'Lokale gever',
    bedrag: 5000, herbestemming: 'vrij' }, tok);
  return { stad, projectId, bronId: bron.body.bron.id };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');

  const bA = await kantoorLid('Bestuur Haarlem', 'bh@rtfos4.test', '0612345680');
  const bB = await kantoorLid('Bestuur Leiden', 'bl@rtfos4.test', '0612345681');
  BESTUUR_A = bA.office; BESTUUR_B = bB.office;

  const a = await stadMet('Haarlem', 'Huiswerkklas Schalkwijk', bA);
  A = a.stad; PROJ_A = a.projectId; BRON_A = a.bronId;
  const b = await stadMet('Leiden', 'Huiswerkklas Noord', bB);
  B = b.stad; PROJ_B = b.projectId; BRON_B = b.bronId;
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------------------------------------------------------
   1. BLAUWDRUKKEN: DELEN WAT ECHT GEDRAAID HEEFT
   ------------------------------------------------------------------------- */
test('een blauwdruk komt uit een project met resultaat, en landt elders als idee', async () => {
  const zonderCijfers = await os_('blauwdruk/deel', { projectId: PROJ_A,
    aanpak: 'twee avonden per week een huiswerkklas in het buurthuis, met vaste begeleiders',
    geleerd: 'de donderdag liep leeg' });
  assert.equal(zonderCijfers.status, 400, 'een project zonder resultaat werd een blauwdruk');
  assert.match(zonderCijfers.body.error, /indicator/);

  await os_('project/indicator', { id: PROJ_A, naam: 'jongeren begeleid', doel: 40, bereikt: 31,
    doorgestroomd: 12, uitgevallen: 5 });

  const kort = await os_('blauwdruk/deel', { projectId: PROJ_A, aanpak: 'gewoon doen', geleerd: 'niets' });
  assert.equal(kort.status, 400, 'een blauwdruk zonder aanpak kwam erdoor');

  const gedeeld = await os_('blauwdruk/deel', { projectId: PROJ_A,
    aanpak: 'twee avonden per week een huiswerkklas in het buurthuis, met twee vaste begeleiders en een vrijwilliger per vier jongeren',
    geleerd: 'de donderdagavond liep leeg tot we hem naar de woensdag verplaatsten',
    doorlooptijd: 'een schooljaar' });
  assert.equal(gedeeld.status, 200, JSON.stringify(gedeeld.body).slice(0, 200));
  const bdId = gedeeld.body.blauwdruk.id;
  assert.equal(gedeeld.body.blauwdruk.indicatoren.length, 1, 'de indicator reisde niet mee als sjabloon');

  const cat = await os_('blauwdrukken', {});
  assert.equal(cat.body.blauwdrukken.length, 1);
  // de RESULTATEN van die stad reizen niet mee, alleen het doel
  assert.equal(JSON.stringify(cat.body).includes('"bereikt"'), false, 'de resultaten van de andere stad reisden mee');

  const eigen = await os_('blauwdruk/overnemen', { id: bdId, stad: A });
  assert.equal(eigen.status, 400, 'een stad nam zijn eigen blauwdruk over');

  const over = await os_('blauwdruk/overnemen', { id: bdId, stad: B });
  assert.equal(over.status, 200, JSON.stringify(over.body).slice(0, 200));
  const projecten = await os_('projecten', { stad: B });
  const nieuw = projecten.body.projecten.find(p => p.id === over.body.projectId);
  assert.ok(nieuw, 'het overgenomen project staat niet in Leiden');
  assert.equal(nieuw.status, 'idee', 'een overgenomen blauwdruk kwam binnen als iets anders dan een idee');
  assert.equal(nieuw.budget, 0, 'het budget van de andere stad reisde mee als toezegging');
  assert.equal(nieuw.indicatoren.length, 1);
  assert.equal(nieuw.indicatoren[0].bereikt, 0, 'de resultaten van de andere stad stonden er al in');
});

/* ---------------------------------------------------------------------------
   2 EN 3. GEZAMENLIJKE INKOOP: EIGEN GELD, EIGEN GOEDKEURING, KLOPPENDE SOM
   ------------------------------------------------------------------------- */
test('een gezamenlijke inkoop betaalt uit eigen bronnen en sluit tot de cent', async () => {
  const i = await os_('inkoop/maak', { stad: A, wat: 'schoolspullenpakketten', eenheid: 'pakketten',
    indicatie: 12.5, leverancier: 'Groothandel Noord', sluitDatum: '2026-10-01' }, BESTUUR_A);
  assert.equal(i.status, 200, JSON.stringify(i.body).slice(0, 200));
  const id = i.body.inkoop.id;

  // een stad kan niet met de bron van een ANDERE stad meedoen
  const vreemd = await os_('inkoop/inschrijven', { id, projectId: PROJ_A, aantal: 100, bronId: BRON_B }, BESTUUR_A);
  assert.equal(vreemd.status, 400, 'een stad schreef in met het geld van een andere stad');
  assert.match(vreemd.body.error, /eigen middelen/);

  // een order met een stad is geen gezamenlijke inkoop
  await os_('inkoop/inschrijven', { id, projectId: PROJ_A, aantal: 100, bronId: BRON_A }, BESTUUR_A);
  const alleen = await os_('inkoop/sluit', { id, perStuk: 10 }, BESTUUR_A);
  assert.equal(alleen.status, 400, 'een order met een stad werd als gezamenlijke inkoop gesloten');
  assert.match(alleen.body.error, /maar een stad/);

  await os_('inkoop/inschrijven', { id, projectId: PROJ_B, aantal: 200, bronId: BRON_B }, BESTUUR_B);

  /* 300 stuks van 10,01 = 3003,00 euro. Dat deel is exact: 100 x 10,01 en
     200 x 10,01 zijn allebei ronde bedragen. De REST komt van de bijkomende
     kosten: 10,01 euro transport over 100/200 stuks geeft 333,67 en 667,33
     cent, en die moeten samen exact 1001 cent zijn. Precies daar zat eerder
     dode code -- zie de kop van kern/rtfos/inkoop-sluiten.js. */
  const dicht = await os_('inkoop/sluit', { id, perStuk: 10.01, extra: 10.01 }, BESTUUR_A);
  assert.equal(dicht.status, 200, JSON.stringify(dicht.body).slice(0, 200));
  const inkoop = dicht.body.inkoop;
  const som = inkoop.deelnames.reduce((s, d) => s + Math.round(d.deel * 100), 0);
  assert.equal(som, 301301, 'de verdeling verloor of verzon een cent (' + som + ' cent)');
  assert.equal(Math.round(inkoop.totaal * 100), 301301);
  // en de resten zijn ECHT verdeeld: geen van beide delen is een rond veelvoud
  // van de stukprijs, want er zit een stuk transport in
  const delen = inkoop.deelnames.map(d => Math.round(d.deel * 100)).sort((a, b2) => a - b2);
  assert.deepEqual(delen, [100434, 200867], 'de bijkomende kosten zijn niet naar rato verdeeld');
  assert.deepEqual(dicht.body.mislukt, [], 'niet elke stad kreeg een aanvraag: ' + dicht.body.mislukt.join(' | '));

  /* EN HET BELANGRIJKSTE: elke stad heeft nu een eigen uitgave-aanvraag die
     daar nog goedgekeurd moet worden. Een gezamenlijke inkoop is een
     bestelling, geen betaling. */
  for (const [stad, token] of [[A, BESTUUR_A], [B, BESTUUR_B]]) {
    const geld = await os_('geld', { stad }, token);
    const u = geld.body.uitgaven.find(x => (x.omschrijving || '').includes('gezamenlijke inkoop'));
    assert.ok(u, 'stad ' + stad + ' kreeg geen uitgave-aanvraag');
    assert.equal(u.status, 'aangevraagd', 'de inkoop boekte langs de goedkeuring heen');
  }
  // de aanvrager (Haarlem) kan zijn eigen aanvraag niet goedkeuren
  const geldA = await os_('geld', { stad: A }, BESTUUR_A);
  const uA = geldA.body.uitgaven.find(x => (x.omschrijving || '').includes('gezamenlijke inkoop'));
  const zelf = await os_('uitgave/besluit', { id: uA.id, akkoord: true }, BESTUUR_A);
  assert.equal(zelf.status, 403, 'de sluiter van de inkoop keurde zijn eigen aanvraag goed');
  assert.match(zelf.body.error, /vierogen|zelf aangevraagd/i);
});

/* ---------------------------------------------------------------------------
   4. DE CAMPAGNESLEUTEL SLUIT, EN DE VERDELING VERLIEST GEEN CENT
   ------------------------------------------------------------------------- */
test('een campagnesleutel telt op tot honderd, en de ronde verdeelt centnauwkeurig', async () => {
  const c = await os_('campagne/maak', { naam: 'Winterjas voor ieder kind',
    doel: 'jassen voor kinderen die er geen hebben', tot: '2026-12-31' });
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200));
  const id = c.body.campagne.id;

  const stad = await os_('campagne/maak', { naam: 'Lokale actie' }, BESTUUR_A);
  assert.equal(stad.status, 403, 'een stad opende een landelijke campagne');

  const scheef = await os_('campagne/sleutel', { id, delen: [{ stad: A, procent: 60 }, { stad: B, procent: 30 }] });
  assert.equal(scheef.status, 400, 'een sleutel van 90% werd geaccepteerd');
  assert.match(scheef.body.error, /90% en moet exact 100% zijn/);

  const zonderSleutel = await os_('campagne/status', { id, status: 'live' });
  assert.equal(zonderSleutel.status, 400, 'een campagne ging live zonder sluitende sleutel');

  // een derde-derde-derde-achtige sleutel die exact sluit
  const goed = await os_('campagne/sleutel', { id, delen: [
    { stad: A, procent: 33.3, reden: 'meer kinderen in beeld' },
    { stad: B, procent: 66.7, reden: 'groter werkgebied' }] });
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));
  assert.equal(goed.body.campagne.sluitend, true);

  await os_('campagne/status', { id, status: 'live' });
  const ronde = await os_('campagne/ronde', { id, bedrag: 1000.01, gever: 'Nationale actiedag' });
  assert.equal(ronde.status, 200, JSON.stringify(ronde.body).slice(0, 200));
  const som = ronde.body.delen.reduce((s, d) => s + Math.round(d.bedrag * 100), 0);
  assert.equal(som, 100001, 'de campagneverdeling verloor of verzon een cent (' + som + ' cent)');
  assert.equal(ronde.body.delen.length, 2);

  // en het geld staat als bron in de steden zelf
  for (const [stad, token] of [[A, BESTUUR_A], [B, BESTUUR_B]]) {
    const geld = await os_('geld', { stad }, token);
    const bron = geld.body.bronnen.find(b => (b.kenmerk || '').includes('campagne'));
    assert.ok(bron, 'de campagnebron staat niet in stad ' + stad);
    assert.equal(bron.geoormerkt, false, 'campagnegeld kwam vastgeklonken aan een project binnen');
  }
});

/* ---------------------------------------------------------------------------
   5. EEN VRIJWILLIGER WORDT GEVRAAGD, NIET VERPLAATST
   ------------------------------------------------------------------------- */
test('uitlenen vraagt toestemming, heeft een einddatum, en opent geen dossier', async () => {
  const jaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const v = await os_('vrijwilliger/maak', { stad: A, naam: 'Fatima B.', contact: 'fatima@example.org' });
  const vid = v.body.vrijwilliger.id;
  await os_('vrijwilliger/zet', { id: vid, status: 'actief', gedragscode: true, vogGeldigTot: jaar,
    talen: ['Nederlands', 'Arabisch'] });
  await os_('vrijwilliger/koppel', { id: vid, projectId: PROJ_A });
  await os_('vrijwilliger/uren', { id: vid, uren: 4, projectId: PROJ_A });
  await os_('vrijwilliger/evaluatie', { id: vid, tekst: 'sterk met de jongste groep' });

  // zonder lopende uitleen komt zij in Leiden niet op een project
  const zomaar = await os_('vrijwilliger/koppel', { id: vid, projectId: PROJ_B }, BESTUUR_B);
  assert.equal(zomaar.status, 400, 'een vrijwilliger uit een andere stad kwam zomaar op een project');
  assert.match(zomaar.body.error, /uitgeleend/);

  const zonderEind = await os_('uitleen/vraag', { vrijwilligerId: vid, naarStad: B, reden: 'Arabisch nodig op donderdag' });
  assert.equal(zonderEind.status, 400, 'een uitleen zonder einddatum kwam erdoor');
  assert.match(zonderEind.body.error, /einddatum/);

  const maand = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const gevraagd = await os_('uitleen/vraag', { vrijwilligerId: vid, naarStad: B, tot: maand,
    reden: 'Arabisch nodig bij de huiswerkklas op donderdag' });
  assert.equal(gevraagd.status, 200, JSON.stringify(gevraagd.body).slice(0, 200));
  const uid = gevraagd.body.uitleen.id;
  assert.equal(gevraagd.body.uitleen.status, 'gevraagd');

  // zolang zij geen ja heeft gezegd, gebeurt er niets
  const teVroeg = await os_('vrijwilliger/koppel', { id: vid, projectId: PROJ_B }, BESTUUR_B);
  assert.equal(teVroeg.status, 400, 'de uitleen liep al voor de vrijwilliger ja zei');

  const leeg = await os_('uitleen/toestemming', { id: uid, akkoord: true, tekst: 'ja' });
  assert.equal(leeg.status, 400, 'een loze toestemming werd geaccepteerd');

  const akkoord = await os_('uitleen/toestemming', { id: uid, akkoord: true,
    tekst: 'akkoord met donderdagavond in Leiden tot eind van de maand' });
  assert.equal(akkoord.status, 200, JSON.stringify(akkoord.body).slice(0, 200));
  assert.equal(akkoord.body.uitleen.loopt, true);

  const nu = await os_('vrijwilliger/koppel', { id: vid, projectId: PROJ_B }, BESTUUR_B);
  assert.equal(nu.status, 200, 'met een lopende uitleen lukte de koppeling niet: ' + JSON.stringify(nu.body).slice(0, 200));

  /* DE ONTVANGENDE STAD ZIET MINDER. Het gastbeeld draagt vaardigheden en
     beschikbaarheid, geen evaluaties en geen urenhistorie: dat is het dossier
     van de eigen stad. */
  const bij = await os_('uitleen', { stad: B }, BESTUUR_B);
  assert.equal(bij.body.gasten.length, 1, 'de gast staat niet in het lijstje van Leiden');
  const gast = bij.body.gasten[0];
  assert.equal(gast.naam, 'Fatima B.');
  assert.deepEqual(gast.talen, ['Nederlands', 'Arabisch']);
  assert.equal('evaluaties' in gast, false, 'de evaluaties reisden mee naar de andere stad');
  assert.equal('urenTotaal' in gast, false, 'de urenhistorie reisde mee naar de andere stad');
  assert.equal(JSON.stringify(bij.body).includes('sterk met de jongste groep'), false,
    'een evaluatie uit de eigen stad stond in het beeld van de ontvangende stad');

  // beeindigen kan van beide kanten, en daarna is het over
  const eind = await os_('uitleen/beeindig', { id: uid }, BESTUUR_B);
  assert.equal(eind.status, 200, JSON.stringify(eind.body).slice(0, 200));
  const daarna = await os_('vrijwilliger/koppel', { id: vid, projectId: PROJ_B, los: true }, BESTUUR_B);
  assert.equal(daarna.status, 200, 'loskoppelen na het einde van de uitleen lukte niet');
  const opnieuw = await os_('vrijwilliger/koppel', { id: vid, projectId: PROJ_B }, BESTUUR_B);
  assert.equal(opnieuw.status, 400, 'na het beeindigen kon de andere stad haar nog inplannen');
});

/* ---------------------------------------------------------------------------
   5b. DE OVERZICHTEN, EN DE STATUS NA HET SLUITEN
   Kort maar met een bewering: een order die nog open staat, is niet geleverd.
   ------------------------------------------------------------------------- */
test('de overzichten van inkoop en campagnes antwoorden, en geleverd kan pas na sluiten', async () => {
  const lijst = await os_('inkoop', {});
  assert.equal(lijst.status, 200, JSON.stringify(lijst.body).slice(0, 200));
  const gesloten = lijst.body.inkoop.find(i => i.status === 'gesloten');
  assert.ok(gesloten, 'de gesloten order van de vorige toets staat niet in het overzicht');

  const open = await os_('inkoop/maak', { stad: A, wat: 'dekens', indicatie: 8 }, BESTUUR_A);
  const teVroeg = await os_('inkoop/status', { id: open.body.inkoop.id, status: 'geleverd' }, BESTUUR_A);
  assert.equal(teVroeg.status, 400, 'een order die nog open staat, werd geleverd gemeld');
  assert.match(teVroeg.body.error, /nog niets besteld/);

  const geleverd = await os_('inkoop/status', { id: gesloten.id, status: 'geleverd' }, BESTUUR_A);
  assert.equal(geleverd.status, 200, JSON.stringify(geleverd.body).slice(0, 200));
  assert.equal(geleverd.body.inkoop.status, 'geleverd');

  const camp = await os_('campagnes', {});
  assert.equal(camp.status, 200, JSON.stringify(camp.body).slice(0, 200));
  assert.ok(camp.body.campagnes.length >= 1, 'de campagne uit de vorige toets staat niet in het overzicht');
  // de rondes-details zijn landelijk; een stad krijgt ze niet
  const stadsblik = await os_('campagnes', {}, BESTUUR_A);
  assert.equal(stadsblik.body.campagnes[0].rondesDetail, undefined,
    'een stad kreeg de rondedetails van een landelijke campagne te zien');
});

/* ---------------------------------------------------------------------------
   6. HET KOPPELBORD ZEGT WAT NIET WERKT
   ------------------------------------------------------------------------- */
test('het koppelbord is eerlijk over wat er niet gekoppeld is', async () => {
  const bord = await os_('koppelbord', {});
  assert.equal(bord.status, 200, JSON.stringify(bord.body).slice(0, 200));
  const per = Object.fromEntries(bord.body.koppelingen.map(k => [k.id, k]));
  assert.equal(per.agenda.werkt, true, 'de agenda-koppeling meldt zich als kapot terwijl de motor er is');
  for (const id of ['vervoer', 'betalingen', 'chat']) {
    assert.equal(per[id].werkt, false, id + ' beweert te werken');
    assert.ok(per[id].nodig && per[id].nodig.length > 20, id + ' zegt niet WAAROM hij niet werkt');
  }

  const stil = await os_('koppel/nog-niet', { welke: 'vervoer' });
  assert.equal(stil.status, 409, 'een niet-bestaande koppeling deed alsof er iets gebeurde');
  assert.match(stil.body.error, /niet gekoppeld/);

  /* En de agenda doet wel echt iets: de activiteit komt in de EIGEN RTG-agenda
     van degene die erom vraagt. */
  const a = await os_('activiteit/maak', { stad: A, naam: 'Buurtmaaltijd', soort: 'buurtmaaltijd',
    capaciteit: 40, wanneer: '2026-11-20', tijd: '18:00', locatie: 'buurthuis Schalkwijk' });
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
  const gezet = await os_('koppel/agenda', { id: a.body.activiteit.id });
  assert.equal(gezet.status, 200, JSON.stringify(gezet.body).slice(0, 200));
  assert.match(gezet.body.item.titel, /Buurtmaaltijd/);
  assert.equal(gezet.body.item.datum, '2026-11-20');

  // een activiteit zonder datum kan de agenda niet aannemen, en dat zegt hij
  const zonderDatum = await os_('activiteit/maak', { stad: A, naam: 'Nog te plannen',
    soort: 'workshop', capaciteit: 10 });
  const kan = await os_('koppel/agenda', { id: zonderDatum.body.activiteit.id });
  assert.equal(kan.status, 400, 'een activiteit zonder datum kwam toch in de agenda');
  assert.match(kan.body.error, /geen datum/);
});

/* ---------------------------------------------------------------------------
   7. BENCHMARKEN: NAAST ELKAAR, NIET OP VOLGORDE
   ------------------------------------------------------------------------- */
test('de benchmark toont noemers en rangschikt niet op doelmatigheid', async () => {
  await os_('project/deelnemers', { id: PROJ_A, uniek: 120, herhaald: 40 });
  await os_('project/deelnemers', { id: PROJ_B, uniek: 18, herhaald: 12 });

  const land = await os_('benchmark', {});
  assert.equal(land.status, 200, JSON.stringify(land.body).slice(0, 200));
  assert.equal(land.body.landelijk, true);
  const namen = land.body.steden.map(s => s.naam);
  assert.ok(namen.includes('Haarlem') && namen.includes('Leiden'));
  for (const s of land.body.steden.filter(x => x.gemeten)) {
    assert.ok('geholpenPerProject' in s, 'een kental staat er zonder zijn noemer');
    assert.ok('urenPerVrijwilliger' in s, 'een kental staat er zonder zijn noemer');
  }
  assert.ok(land.body.spreiding.geholpenPerProject.mediaan !== null, 'er is geen mediaan om aan te spiegelen');
  assert.ok(Array.isArray(land.body.signalen), 'er zijn geen signalen berekend');

  /* EEN STAD ZIET ZICHZELF NAAST DE MEDIAAN EN NIET NAAST DE BUREN BIJ NAAM.
     Zonder de context van die stad zegt zo'n getal niets, en met de context is
     het een gesprek en geen lijstje. */
  const eigen = await os_('benchmark', {}, BESTUUR_B);
  assert.equal(eigen.status, 200, JSON.stringify(eigen.body).slice(0, 200));
  assert.equal(eigen.body.landelijk, false);
  assert.equal(eigen.body.eigen.naam, 'Leiden');
  assert.equal('steden' in eigen.body, false, 'een stad kreeg de cijfers van andere steden te zien');
  assert.equal(JSON.stringify(eigen.body).includes('Haarlem'), false, 'de naam van een andere stad stond in het stadsbeeld');
  assert.ok(eigen.body.mediaan.geholpenPerProject !== null);
});
