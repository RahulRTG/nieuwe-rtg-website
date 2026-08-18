/* DE REIS (kern/reizen.js): de losse regels van de reiswereld gegroepeerd tot
   reizen -- fase 1 van REIZEN.md.

   WAT HIER BEWEZEN MOET WORDEN, en het is niet "er komt een groepering uit".
   Een groepering die te gretig is, is gevaarlijker dan geen groepering: wie
   twee reizen als één ziet, mist het vertrek van de tweede. Deze toetsen
   stellen daarom vooral de vraag WANNEER ER NIET WORDT SAMENGEVOEGD --

   1. dezelfde bestemming ver buiten het venster: twee reizen, geen een;
   2. een andere bestemming in hetzelfde venster: twee reizen;
   3. plaatsnamen die alleen op hun letters lijken (Rome / Romeinse Riviera):
      twee reizen;
   4. een onderdeel dat bij twee reizen past: bij geen van beide, en het wordt
      losgelegd met de reden erbij;
   5. de boekhouding: elk komend onderdeel zit precies één keer in een reis OF
      in los. Stil verdwijnen mag hier niet -- een reis die compleet oogt
      terwijl er een stuk mist, is precies de fout die deze laag moet uitsluiten.

   De eerste helft draait op de ECHTE reiswereld met nagebootste domeinen, zodat
   ook bewezen wordt dat de twee lagen op elkaar passen (de herkomst komt uit de
   bron en wordt hier niet geraden). Twee toetsen gebruiken een nagebootste
   reiswereld, omdat een regel zonder geldige herkomst of zonder datum uit de
   echte laag niet te krijgen is -- en juist die weigering hoort te werken.

   Draai los: node --experimental-sqlite --test test/reizen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakReiswereld } = require('../server/kern/reiswereld');
const { maakReizen } = require('../server/kern/reizen');
const { startServer, stop } = require('./helper');

const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

/* De echte reiswereld op nagebootste domeinen, met De Reis eroverheen. */
function reizenMet(over) {
  const kern = Object.assign({
    mijnVerblijven: () => [],
    reisbureau: { mijn: () => [] },
    lucht: { mijn: () => ({ boekingen: [], charters: [] }) },
    invoer: { mijnRegels: () => [] },
    db: { boekingenVanKlant: () => [], data: { boekingen: [] } },
    findSupplier: () => null
  }, over || {});
  Object.assign(kern, maakReiswereld({ kern }));
  return maakReizen({ kern }).reizen;
}
const verblijf = (o) => ({ id: o.id, roomName: o.titel, plaats: o.plaats, aankomst: o.van, vertrek: o.tot, status: o.status || 'bevestigd' });
const aanvraag = (o) => ({ ref: o.ref, titel: o.titel, bestemming: o.plaats, vertrek: o.van, personen: o.personen, status: o.status || 'aangevraagd' });
const vlucht = (o) => ({ code: o.code, status: o.status || 'geboekt', vlucht: { nummer: o.nummer, bestemming: o.plaats, datum: o.van, tijd: o.tijd } });

/* De boekhouding van elke uitkomst: geen onderdeel verdwijnt, en geen enkel
   onderdeel staat op twee plekken. Elke toets hieronder laat hem meelopen. */
function klopt(r, verwacht) {
  const inReizen = r.reizen.reduce((n, x) => n + x.onderdelen.length, 0);
  assert.equal(inReizen + r.los.length, verwacht,
    'elk onderdeel hoort precies één keer voor te komen: ' + inReizen + ' in reizen + ' + r.los.length + ' los');
}

test('1. wat bij elkaar hoort wordt één reis, met een venster dat beide omvat', () => {
  const r = reizenMet({
    mijnVerblijven: () => [verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(37) })],
    reisbureau: { mijn: () => [aanvraag({ ref: 'R1', titel: 'Woestijn & strand', plaats: 'Dubai', van: dag(30), personen: 2 })] },
    lucht: { mijn: () => ({ boekingen: [vlucht({ code: 'B1', nummer: 'RT101', plaats: 'Dubai', van: dag(30), tijd: '14:20' })], charters: [] }) }
  }).mijn('k');
  klopt(r, 3);
  assert.equal(r.reizen.length, 1, 'drie onderdelen naar Dubai zijn één reis');
  const reis = r.reizen[0];
  assert.equal(reis.bestemming, 'Dubai');
  assert.deepEqual(reis.venster, { van: dag(30), tot: dag(37) }, 'het venster loopt tot het einde van het verblijf');
  assert.equal(reis.telling.onderdelen, 3);
  assert.equal(reis.personen, 2, 'het aantal reizigers komt uit het domein dat het echt weet');
  assert.deepEqual(reis.apps.sort(), ['Reisbureau', 'Verblijven', 'Vluchten']);
  assert.ok(reis.grond.includes('Dubai') && reis.grond.includes('3 onderdelen'), 'de reis legt uit waarom: ' + reis.grond);
});

test('2. de herkomst komt uit de bron en wordt niet geraden', () => {
  const r = reizenMet({
    mijnVerblijven: () => [verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(37) })],
    reisbureau: { mijn: () => [aanvraag({ ref: 'R1', titel: 'Woestijn', plaats: 'Dubai', van: dag(30) })] }
  }).mijn('k');
  klopt(r, 2);
  const per = Object.fromEntries(r.reizen[0].onderdelen.map(o => [o.soort, o.herkomst]));
  assert.equal(per.verblijf, 'partner', 'een verblijf staat bij een partner');
  assert.equal(per.reis, 'rtg', 'een samengestelde reis is van RTG zelf');
  assert.deepEqual(r.reizen[0].herkomsten.sort(), ['partner', 'rtg'], 'de reis draagt beide herkomsten');
});

test('3. dezelfde bestemming ver uit elkaar blijft twee reizen', () => {
  const r = reizenMet({
    mijnVerblijven: () => [
      verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(34) }),
      verblijf({ id: 'v2', titel: 'Suite', plaats: 'Dubai', van: dag(90), tot: dag(94) })
    ]
  }).mijn('k');
  klopt(r, 2);
  assert.equal(r.reizen.length, 2, 'twee keer Dubai met twee maanden ertussen is twee reizen');
  assert.notEqual(r.reizen[0].id, r.reizen[1].id, 'en ze hebben elk een eigen naam');
});

test('4. de speling is een dag, en geen deur', () => {
  // een vlucht de dag VOOR het verblijf hoort er nog bij ...
  const wel = reizenMet({
    mijnVerblijven: () => [verblijf({ id: 'v1', titel: 'Suite', plaats: 'Nice', van: dag(31), tot: dag(35) })],
    lucht: { mijn: () => ({ boekingen: [vlucht({ code: 'B1', nummer: 'RT2', plaats: 'Nice', van: dag(30) })], charters: [] }) }
  }).mijn('k');
  klopt(wel, 2);
  assert.equal(wel.reizen.length, 1, 'een dag ervoor hoort er nog bij');
  // ... drie dagen ervoor niet meer
  const niet = reizenMet({
    mijnVerblijven: () => [verblijf({ id: 'v1', titel: 'Suite', plaats: 'Nice', van: dag(33), tot: dag(37) })],
    lucht: { mijn: () => ({ boekingen: [vlucht({ code: 'B1', nummer: 'RT2', plaats: 'Nice', van: dag(30) })], charters: [] }) }
  }).mijn('k');
  klopt(niet, 2);
  assert.equal(niet.reizen.length, 2, 'drie dagen ervoor is een andere reis');
});

test('5. een andere bestemming in hetzelfde venster wordt niet samengevoegd', () => {
  const r = reizenMet({
    mijnVerblijven: () => [
      verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(34) }),
      verblijf({ id: 'v2', titel: 'Kamer', plaats: 'Nice', van: dag(31), tot: dag(33) })
    ]
  }).mijn('k');
  klopt(r, 2);
  assert.equal(r.reizen.length, 2, 'twee bestemmingen tegelijk zijn twee reizen');
});

test('6. plaatsnamen: hele woorden tellen, losse letters niet', () => {
  // "Ibiza (uit Geneve)" is Ibiza -- de haakjes van het vluchtdomein tellen niet mee
  const zelfde = reizenMet({
    mijnVerblijven: () => [verblijf({ id: 'v1', titel: 'Villa', plaats: 'Ibiza', van: dag(30), tot: dag(34) })],
    lucht: { mijn: () => ({ boekingen: [], charters: [{ code: 'C1', soort: 'jet', bestemming: 'Ibiza (uit Geneve)', datum: dag(30), status: 'bevestigd' }] }) }
  }).mijn('k');
  klopt(zelfde, 2);
  assert.equal(zelfde.reizen.length, 1, 'Ibiza (uit Geneve) is Ibiza');
  // "Rome" en "Romeinse Riviera" lijken alleen op elkaar
  const anders = reizenMet({
    mijnVerblijven: () => [
      verblijf({ id: 'v1', titel: 'Suite', plaats: 'Rome', van: dag(30), tot: dag(33) }),
      verblijf({ id: 'v2', titel: 'Villa', plaats: 'Romeinse Riviera', van: dag(31), tot: dag(34) })
    ]
  }).mijn('k');
  klopt(anders, 2);
  assert.equal(anders.reizen.length, 2, 'Rome en de Romeinse Riviera zijn niet dezelfde plaats');
});

test('7. wie bij twee reizen past, wordt bij geen van beide gestopt', () => {
  /* Twee reizen naar Dubai met een gat ertussen, en een vlucht die met zijn
     speling aan allebei raakt. Hem in de eerste duwen zou een keuze zijn die
     niemand heeft gemaakt. */
  const r = reizenMet({
    mijnVerblijven: () => [
      verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(33) }),
      verblijf({ id: 'v2', titel: 'Villa', plaats: 'Dubai', van: dag(35), tot: dag(38) })
    ],
    lucht: { mijn: () => ({ boekingen: [vlucht({ code: 'B1', nummer: 'RT9', plaats: 'Dubai', van: dag(34) })], charters: [] }) }
  }).mijn('k');
  klopt(r, 3);
  assert.equal(r.reizen.length, 2, 'de twee verblijven blijven twee reizen');
  assert.equal(r.los.length, 1, 'de vlucht ertussen wordt losgelegd');
  assert.equal(r.los[0].onderdeel.kenmerk, 'B1');
  assert.match(r.los[0].reden, /meer dan één reis/);
});

test('8. zonder datum, zonder bestemming of zonder geldige herkomst: los, met de reden', () => {
  /* Hier een nagebootste reiswereld: de echte laag geeft altijd een geldige
     herkomst mee, en juist de weigering moet bewezen worden. */
  const stub = { reiswereld: { komend: () => ({ ok: true, stil: [], bronnen: ['x'], komend: [
    { soort: 'vlucht', titel: 'zonder datum', bestemming: 'Dubai', van: null, herkomst: 'rtg', kenmerk: 'A' },
    { soort: 'verblijf', titel: 'zonder plaats', bestemming: '', van: dag(3), herkomst: 'partner', kenmerk: 'B' },
    { soort: 'reis', titel: 'vreemde herkomst', bestemming: 'Dubai', van: dag(3), herkomst: 'gevonden-op-straat', kenmerk: 'C' },
    { soort: 'reis', titel: 'herkomst ontbreekt', bestemming: 'Dubai', van: dag(3), herkomst: '', kenmerk: 'D' }
  ] }) } };
  const r = maakReizen({ kern: stub }).reizen.mijn('k');
  klopt(r, 4);
  assert.equal(r.reizen.length, 0, 'niets hiervan hoort in een reis terecht te komen');
  const reden = Object.fromEntries(r.los.map(x => [x.onderdeel.kenmerk, x.reden]));
  assert.match(reden.A, /datum/);
  assert.match(reden.B, /bestemming/);
  assert.match(reden.C, /herkomst/, 'een verzonnen herkomst wordt niet stil als eigen aanbod behandeld');
  assert.match(reden.D, /herkomst/);
});

test('9. een stilgevallen bron reist mee tot in de reis', () => {
  const stuk = reizenMet({
    mijnVerblijven: () => { throw new Error('database weg'); },
    reisbureau: { mijn: () => [aanvraag({ ref: 'R1', titel: 'Toscane', plaats: 'Florence', van: dag(20) })] }
  }).mijn('k');
  assert.deepEqual(stuk.stil, ['verblijven'], 'wie stilviel staat er nog steeds bij');
  assert.equal(stuk.reizen.length, 1, 'en de rest gaat gewoon door');
});

test('10. het zwaarste signaal van de onderdelen wordt het signaal van de reis', () => {
  const r = reizenMet({
    mijnVerblijven: () => [verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(34), status: 'bevestigd' })],
    reisbureau: { mijn: () => [aanvraag({ ref: 'R1', titel: 'Woestijn', plaats: 'Dubai', van: dag(30), status: 'aangevraagd' })] }
  }).mijn('k');
  const reis = r.reizen[0];
  assert.equal(reis.sig, 'actief', 'bevestigd (gezond) naast aangevraagd (actief) geeft actief');
  assert.equal(reis.telling.wachtend, 1, 'en er wordt op één ding gewacht');
  // dezelfde reis, twee keer opgevraagd: dezelfde naam
  const opnieuw = reizenMet({
    mijnVerblijven: () => [verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(34) })]
  });
  assert.equal(opnieuw.mijn('k').reizen[0].id, opnieuw.mijn('k').reizen[0].id, 'de naam van een reis is stabiel');
});

test('12. de volgorde van de punten bepaalt de uitkomst niet', () => {
  /* DEZE TOETS BESTAAT OMDAT EEN MUTATIE AFSLOEG. De module bevriest de
     vensters voordat de losse punten worden verdeeld, met in het commentaar de
     belofte dat het eerste punt de reis erachter niet aan zich vast kan lijmen.
     Het weghalen van die bevriezing liet alle elf toetsen groen -- ze hadden
     allemaal hoogstens EEN punt te verdelen, en dan maakt bevriezen niets uit.
     Een belofte die geen toets kan breken, is een voornemen (LAT-regel 6).

     Twee verblijven in Dubai met drie dagen ertussen, en twee vluchten in dat
     gat. Zonder bevriezing rekt de eerste vlucht de eerste reis op tot de 34e,
     waarna de tweede vlucht ineens bij allebei past en wordt losgelegd -- terwijl
     hij gewoon bij de tweede reis hoort. */
  const r = reizenMet({
    mijnVerblijven: () => [
      verblijf({ id: 'v1', titel: 'Suite', plaats: 'Dubai', van: dag(30), tot: dag(33) }),
      verblijf({ id: 'v2', titel: 'Villa', plaats: 'Dubai', van: dag(36), tot: dag(39) })
    ],
    lucht: { mijn: () => ({ boekingen: [
      vlucht({ code: 'B1', nummer: 'RT1', plaats: 'Dubai', van: dag(34) }),
      vlucht({ code: 'B2', nummer: 'RT2', plaats: 'Dubai', van: dag(35) })
    ], charters: [] }) }
  }).mijn('k');
  klopt(r, 4);
  assert.equal(r.reizen.length, 2, 'twee verblijven, twee reizen');
  assert.deepEqual(r.los, [], 'en beide vluchten vinden hun eigen reis');
  const eerste = r.reizen.find(x => x.venster.van <= dag(30));
  const tweede = r.reizen.find(x => x !== eerste);
  assert.ok(eerste.onderdelen.some(o => o.kenmerk === 'B1'), 'de vlucht op de 34e hoort bij de eerste reis');
  assert.ok(tweede.onderdelen.some(o => o.kenmerk === 'B2'), 'en die op de 35e bij de tweede');
});

/* En de deur: de route bestaat, zit achter de leden-inlog, en levert wat een
   echt geboekte reis oplevert. Een pure toets kan dat niet zien -- die zou
   groen blijven terwijl de route helemaal niet is aangesloten. */
test('11. /api/reis/reizen: dicht zonder inlog, en een echte aanvraag komt eruit als reis', async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reizen-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    assert.equal((await post('/api/reis/reizen', {}, null)).status, 401);
    const u = Date.now().toString().slice(-8);
    const reg = await post('/api/auth/register', { name: 'Reiziger', email: 'j' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    const lid = reg.body.token;
    const cat = await post('/api/reisbureau', {}, lid);
    const trip = cat.body.reizen[0];
    const boek = await post('/api/reisbureau/boek', { tripId: trip.id, personen: 2, vertrek: dag(40) }, lid);
    assert.equal(boek.status, 200);

    const r = await post('/api/reis/reizen', {}, lid);
    assert.equal(r.status, 200);
    const reis = r.body.reizen.find(x => x.onderdelen.some(o => o.kenmerk === boek.body.aanvraag.ref));
    assert.ok(reis, 'de aangevraagde reis staat als reis in het overzicht');
    assert.equal(reis.bestemming, trip.bestemming);
    assert.equal(reis.personen, 2);
    assert.deepEqual(reis.herkomsten, ['rtg']);
    assert.equal(reis.onderdelen[0].link, '/apps/reisbureau.html', 'en wijst naar de app die het echte werk doet');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
