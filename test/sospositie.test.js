/* EEN SOS-POSITIE HOORT BIJ DE MELDING (NAVIGATIE.md N18).

   Vijf stromen, een regel (server/kern/sospositie.js): zolang de melding open
   is blijft de positie, 90 dagen na het sluiten gaat hij eraf, en een proef of
   een binnen een minuut door de melder ingetrokken melding verliest hem meteen.
   Per stroom een toets op de ECHTE domeinmodule (in-process, want de termijn is
   90 dagen en die wachten we niet af: de wisfuncties nemen de klok van de
   bewaarveger mee).

   Elke assert is met een mutatie nagetrokken; wat hem laat zakken staat erbij
   als "ZAKT OP".

   Draai los: node --test test/sospositie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const R = require('../server/kern/sospositie');

const DAG = 86400000;
const T0 = Date.parse('2026-09-29T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

test('1. de regel: open blijft, 90 dagen na sluiten weg, proef en snelle intrekking meteen', () => {
  /* ZAKT OP: BEWAAR_MS op 30 dagen -- dan is dag 89 al weg.
     ZAKT OP: `> BEWAAR_MS` in verlopen() omdraaien of weghalen.
     ZAKT OP: `doorMelder &&` weghalen uit directWeg -- dan verliest een SOS die
     een ANDER binnen een minuut afhandelde zijn plek, en die kan nog nodig zijn. */
  const lijst = [
    { id: 'open', lat: 52.1, lng: 4.3, at: iso(T0) },
    { id: 'dag89', lat: 52.2, lng: 4.4, at: iso(T0), dicht: iso(T0) },
    { id: 'dag91', lat: 52.3, lng: 4.5, at: iso(T0), dicht: iso(T0 - 2 * DAG) }
  ];
  const n = R.veeg(lijst, { velden: ['lat', 'lng'], dicht: r => r.dicht, nu: T0 + 89 * DAG });
  assert.equal(n, 1, 'alleen de melding die 91 dagen dicht is');
  assert.equal(lijst[0].lat, 52.1, 'een open melding houdt haar plek, hoe oud ook');
  assert.equal(lijst[1].lat, 52.2, 'op dag 89 na sluiten blijft de plek');
  assert.equal(lijst[2].lat, null, 'na 90 dagen is de plek weg');
  assert.equal(lijst[2].lng, null);
  assert.ok(lijst[2].positieGewist, 'en de melding zegt DAT hij weg is');

  assert.equal(R.directWeg({ proef: true, at: iso(T0), dicht: iso(T0 + DAG) }), true, 'een proef altijd');
  assert.equal(R.directWeg({ doorMelder: true, at: iso(T0), dicht: iso(T0 + 50000) }), true, 'zelf ingetrokken binnen een minuut');
  assert.equal(R.directWeg({ doorMelder: true, at: iso(T0), dicht: iso(T0 + 61000) }), false, 'na een minuut is het een echte melding');
  assert.equal(R.directWeg({ doorMelder: false, at: iso(T0), dicht: iso(T0 + 5000) }), false, 'door een ander afgehandeld is niet ingetrokken');
});

test('2. huur en charter: de SOS op de boeking, dicht met ok.at van de zaak', () => {
  /* ZAKT OP: `n += veeg(...)` in kern/voertuigsos.js weghalen -- dan blijft de
     plek van een afgehandelde SOS eeuwig op de boeking staan.
     ZAKT OP: SOORTEN tot `huur` versmallen -- dan blijft de charter staan. */
  const { vergeetVoertuigSos } = require('../server/kern/voertuigsos');
  const oud = { door: 'Balie', at: iso(T0 - 91 * DAG) };
  const boekingen = [
    { kind: 'huur', sos: [{ bericht: 'pech', at: iso(T0 - 92 * DAG), lat: 38.9, lng: 1.3, ok: oud },
      { bericht: 'nog open', at: iso(T0 - 200 * DAG), lat: 38.8, lng: 1.2, ok: null }] },
    { kind: 'charter', sos: [{ bericht: 'motor', at: iso(T0 - 92 * DAG), lat: 38.86, lng: 1.2, ok: oud }] },
    { kind: 'charter', sos: [{ bericht: 'net af', at: iso(T0 - 2 * DAG), lat: 38.7, lng: 1.1, ok: { door: 'x', at: iso(T0 - DAG) } }] },
    { kind: 'tafel', sos: [{ lat: 1, lng: 2, ok: oud }] }
  ];
  assert.equal(vergeetVoertuigSos(boekingen, T0), 2);
  assert.equal(boekingen[0].sos[0].lat, null, 'huur: 91 dagen na afhandelen weg');
  assert.equal(boekingen[0].sos[0].bericht, 'pech', 'de melding zelf blijft, alleen de plek gaat eraf');
  assert.equal(boekingen[0].sos[1].lat, 38.8, 'huur: een open SOS houdt zijn plek');
  assert.equal(boekingen[1].sos[0].lat, null, 'charter: 91 dagen na afhandelen weg');
  assert.equal(boekingen[2].sos[0].lat, 38.7, 'charter: een dag na afhandelen blijft hij');
  assert.equal(boekingen[3].sos[0].lat, 1, 'een ander soort boeking is niet van deze regel');
});

function bouwOntmoeting() {
  const db = { data: {} };
  const o = require('../server/kern/ontmoeting').maakOntmoeting({ db, save: () => {}, crypto, accounts: {},
    notify: () => {}, sseToCustomer: () => {}, sseToOffice: () => {}, codenaamVan: k => 'Codenaam ' + k });
  o.ontmoetVergeetOudePosities();   // lijsten() via de radar
  db.data.ontmoetDates = [{ id: 'd1', a: 'A', b: 'B', status: 'actief', sos: [], posities: {} }];
  return { db, o };
}

test('3. date: de plek van de SOS blijft open en 90 dagen na afhandelen; de live-posities gaan mee dicht', () => {
  /* ZAKT OP: de veeg in vergeetSosPosities (kern/ontmoeting/sos.js) weghalen.
     ZAKT OP: `d.posities = {}` in sosAf weghalen -- dan blijft de live-positie
     van een afspraak die al voorbij was staan nadat de SOS is afgehandeld. */
  const { db, o } = bouwOntmoeting();
  assert.equal(o.ontmoetSos('A', 'd1', 'help', 38.91, 1.43).status, 200);
  const d = db.data.ontmoetDates[0];
  assert.equal(d.sos[0].lat, 38.91);
  assert.equal(o.ontmoetVergeetSosPosities(Date.now() + 365 * DAG), 0, 'open: een jaar later staat hij er nog');
  assert.equal(d.sos[0].lat, 38.91);

  assert.equal(o.ontmoetStop('A', 'd1').status, 200);
  assert.ok(d.posities.A, 'afspraak voorbij, SOS nog open: de meldkamer houdt de live-positie');
  assert.equal(o.ontmoetSosAf('d1', d.sos[0].id, 'Kantoor').status, 200);
  assert.deepEqual(d.posities, {}, 'SOS afgehandeld en afspraak voorbij: live-posities weg');
  assert.equal(d.sos[0].lat, 38.91, 'de plek van de SOS zelf blijft bij de melding');

  assert.equal(o.ontmoetVergeetSosPosities(Date.now() + 89 * DAG), 0, 'dag 89: blijft');
  assert.equal(o.ontmoetVergeetSosPosities(Date.now() + 91 * DAG), 1, 'dag 91: weg');
  assert.equal(d.sos[0].lat, null);
  assert.equal(d.sos[0].lng, null);
});

function bouwAlarm() {
  const db = { data: {} };
  const opslag = require('../server/kern/veiligheid/opslag')({ db });
  const plek = require('../server/kern/veiligheid/plek')({ opslag, save: () => {} });
  const kring = { ontvangers: () => ({ alle: ['M'], metPlek: ['M'], zonderPlek: [], mails: [] }) };
  const alarm = require('../server/kern/veiligheid/alarm')({ opslag, save: () => {}, crypto, kring, plek,
    meldAan: () => {}, mail: { send: () => {} }, appUrl: () => '' });
  const alarmen = () => opslag.tak('alarmen');
  return { plek, alarm, alarmen };
}

// Een alarm met een plek: het alarm opent zelf een venster, daarna meldt het toestel zich.
function slaMetPlek(b, opties) {
  const r = b.alarm.alarmSlaan(Object.assign({ handle: 'H', codenaam: 'Codenaam H', soort: 'knop' }, opties));
  assert.equal(r.status, 200, JSON.stringify(r));
  const a = b.alarmen().find(x => x.id === r.id);
  a.plek = { lat: 52.37, lon: 4.9, at: a.at };   // wat laatstePlek() gaf bij een toestel dat zich al meldde
  return a;
}

test('4. alarm van de kring: een proef verliest zijn plek bij afsluiten', () => {
  /* ZAKT OP: de regel `if (directWeg(a)) sosPositie.wis(a, ['plek'])` in
     alarmAfsluiten weghalen. */
  const b = bouwAlarm();
  const a = slaMetPlek(b, { proef: true });
  a.at = iso(Date.now() - 10 * 60000);   // tien minuten oud: niet de minuutregel maar de proef
  assert.equal(b.alarm.alarmAfsluiten('H', a.id, 'proef klaar').status, 200);
  assert.equal(a.plek, null, 'een proefalarm bewaart na afsluiten geen plek');
});

test('5. alarm van de kring: binnen een minuut zelf afgesloten is ingetrokken; daarna blijft de plek 90 dagen', () => {
  /* ZAKT OP: INTREK_MS op 0 -- dan houdt een meteen ingetrokken alarm zijn plek.
     ZAKT OP: vergeetAlarmPlekken in alarm.js laten teruggeven zonder te vegen. */
  const b = bouwAlarm();
  const snel = slaMetPlek(b, {});
  assert.equal(b.alarm.alarmAfsluiten('H', snel.id).status, 200);
  assert.equal(snel.plek, null, 'binnen een minuut ingetrokken: plek weg');

  const echt = slaMetPlek(b, {});
  echt.at = iso(Date.now() - 5 * 60000);
  assert.equal(b.alarm.alarmAfsluiten('H', echt.id, 'het is goed').status, 200);
  assert.equal(echt.plek.lat, 52.37, 'een echt alarm houdt zijn plek na afsluiten');
  assert.equal(b.alarm.vergeetAlarmPlekken(Date.now() + 89 * DAG), 0);
  assert.equal(echt.plek.lat, 52.37, 'dag 89: blijft');
  assert.equal(b.alarm.vergeetAlarmPlekken(Date.now() + 91 * DAG), 1);
  assert.equal(echt.plek, null, 'dag 91: weg');
});

test('6. alarm van de kring: een alarm dat openstaat houdt zijn plek, en de veger vangt een proef die bleef staan', () => {
  /* ZAKT OP: `direct: directWeg` uit vergeetAlarmPlekken halen -- dan blijft een
     proef die buiten alarmAfsluiten dicht ging zijn plek 90 dagen houden.
     ZAKT OP: `a.afgesloten &&` uit de dicht-functie halen (dan telt een open
     alarm met een oude afgeslotenAt als dicht). */
  const b = bouwAlarm();
  const open = slaMetPlek(b, {});
  open.afgeslotenAt = iso(Date.now() - 200 * DAG);   // een oude sluittijd op een HEROPEND alarm telt niet
  const proef = slaMetPlek(b, { proef: true });
  proef.afgesloten = true; proef.afgeslotenAt = iso(Date.now());   // dicht zonder alarmAfsluiten
  assert.equal(b.alarm.vergeetAlarmPlekken(Date.now()), 1);
  assert.equal(open.plek.lat, 52.37, 'open blijft staan');
  assert.equal(proef.plek, null, 'de proef is alsnog weg');
});

function bouwBeveiliging() {
  const zaak = { code: 'BEV', name: 'Team', type: 'beveiliging', beveiliging: { posten: [{ id: 'p1', naam: 'Object', minMan: 1 }] } };
  const db = { data: { bevDiensten: [], bevIncidenten: [], bevRondes: [], suppliers: [zaak] } };
  const bev = require('../server/kern/beveiliging').maakBeveiliging({
    db, save: () => {}, crypto,
    accounts: { listStaff: () => [{ id: 7, name: 'Bewaker Zeven', role: 'staff' }], publicStaff: x => x },
    findSupplier: c => (c === 'BEV' ? zaak : null),
    notify: () => {}, notifySupplier: () => {}, sseToSupplier: () => {}, sseToOffice: () => {},
    logActivity: () => {}, haversine: () => 0
  });
  return { db, zaak, bev };
}

test('7. bewaker: incident en SOS houden hun plek open, en 90 dagen na afhandelen niet meer', () => {
  /* ZAKT OP: `x.afgehandeldAt = nu()` in beslisIncident weghalen -- dan heeft
     een afgehandeld incident geen klok en start de veger hem pas later.
     ZAKT OP: `else delete x.afgehandeldAt` weghalen -- dan telt een heropend
     incident als dicht en verliest het zijn plek terwijl het loopt.
     ZAKT OP: de veeg in vergeetPdaSos (pda/index.js) weghalen. */
  const { db, zaak, bev } = bouwBeveiliging();
  const sos = bev.bevSos('BEV', 7, 38.876, 1.383);
  const inc = bev.bevMeldIncident('BEV', 7, { tekst: 'Inbraakpoging', lat: 38.87, lng: 1.38 });
  assert.equal(sos.status, 200); assert.equal(inc.status, 200);
  const rauw = id => db.data.bevIncidenten.find(x => x.id === id);

  assert.equal(bev.bevVergeetSosPosities(Date.now() + 365 * DAG), 0, 'open: een jaar later staat alles er nog');
  assert.equal(rauw(sos.incident.id).lat, 38.876);

  bev.bevBeslisIncident(zaak, sos.incident.id);       // afgehandeld
  bev.bevBeslisIncident(zaak, inc.incident.id);       // afgehandeld...
  bev.bevBeslisIncident(zaak, inc.incident.id);       // ...en weer open
  assert.equal(rauw(inc.incident.id).afgehandeldAt, undefined, 'heropend: de klok staat stil');
  assert.ok(Math.abs(Date.parse(rauw(sos.incident.id).afgehandeldAt) - Date.now()) < 5000,
    'afhandelen zet de klok zelf, en niet pas de veger');

  assert.equal(bev.bevVergeetSosPosities(Date.now() + 89 * DAG), 0, 'dag 89: blijft');
  assert.equal(bev.bevVergeetSosPosities(Date.now() + 91 * DAG), 1, 'dag 91: de SOS verliest zijn plek');
  assert.equal(rauw(sos.incident.id).lat, null);
  assert.equal(rauw(sos.incident.id).lng, null);
  assert.equal(rauw(inc.incident.id).lat, 38.87, 'het heropende incident houdt zijn plek');
});

test('8. bewaker: een incident dat voor deze regel al afgehandeld was, krijgt een klok van NU en geen verzonnen verleden', () => {
  /* ZAKT OP: de klok-backfill in vergeetPdaSos (pda/index.js) weghalen -- dan blijft een
     oud afgehandeld incident zonder afgehandeldAt zijn plek eeuwig houden. */
  const { db, bev } = bouwBeveiliging();
  db.data.bevIncidenten.push({ id: 'oud', supplierCode: 'BEV', status: 'afgehandeld', lat: 1, lng: 2, at: iso(T0 - 400 * DAG) });
  assert.equal(bev.bevVergeetSosPosities(Date.now()), 0, 'niet meteen weg: de klok start nu');
  assert.ok(db.data.bevIncidenten[0].afgehandeldAt, 'maar hij heeft nu een klok');
  assert.equal(bev.bevVergeetSosPosities(Date.now() + 91 * DAG), 1, 'en 90 dagen later gaat de plek eraf');
});
