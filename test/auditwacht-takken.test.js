/* DE AUDITWACHT TAK VOOR TAK (server/lib/auditwacht.js).

   Toetst de randen naast test/auditwacht.test.js: een eerste melding wekt het
   alarm en een herhaling niet (maar houdt `sinds` vast), een journaal dat weer
   klopt verdwijnt en wekt het alarm opnieuw, een controle die zelf faalt is
   een bevinding en geen stilte, `wis` sluit alleen af wat er was, en de
   periodieke wacht start een keer, leest zijn interval uit de omgeving en
   overleeft een ronde die gooit. console.error wordt tijdens de toets
   opgevangen en daarna teruggezet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const keten = require('../server/lib/keten');
const wacht = require('../server/lib/auditwacht');

const rij = n => { const l = []; for (let i = 0; i < n; i++) keten.noteerIn(l, { at: 'a' + i, wat: 'w' + i }, 0); return l; };
const tik = () => new Promise(r => setImmediate(r));

let fouten = [];
const echteFout = console.error;
test.beforeEach(() => { wacht._wis(); wacht.haakAlarm(null); fouten = []; console.error = (...a) => { fouten.push(a.join(' ')); }; });
test.afterEach(() => { console.error = echteFout; wacht.haakAlarm(null); wacht.stop(); wacht._wis(); });

test('meld: de eerste breuk logt en wekt het alarm, een herhaling alleen het tijdstip', async () => {
  let gewekt = 0;
  wacht.haakAlarm(() => { gewekt++; });
  wacht.meld('handelingLog', 'regel 3 klopt niet', 'requestmerge');
  await tik();
  assert.equal(gewekt, 1);
  assert.equal(fouten.length, 1);
  assert.match(fouten[0], /AUDITSPOOR GEBROKEN: handelingLog \(requestmerge\): regel 3 klopt niet/);
  const eerst = wacht.stand().breuken[0];
  wacht.meld('handelingLog', 'nog steeds', 'ronde');
  await tik();
  assert.equal(gewekt, 1, 'een herhaling is geen nieuw alarm');
  assert.equal(fouten.length, 1);
  const daarna = wacht.stand().breuken[0];
  assert.equal(daarna.sinds, eerst.sinds, 'sinds blijft het eerste moment');
  assert.equal(daarna.reden, 'nog steeds');
  assert.equal(daarna.bron, 'ronde');
});

test('meld: zonder namen een eerlijke standaard, en een lange reden wordt afgekapt', () => {
  wacht.meld();
  const b = wacht.stand().breuken[0];
  assert.equal(b.journaal, 'onbekend');
  assert.equal(b.reden, 'de keten is gebroken');
  assert.equal(b.bron, 'onbekend');
  assert.match(fouten[0], /onbekend \(onbekend\)/);
  wacht.meld('x', 'r'.repeat(500), 'b');
  assert.equal(wacht.stand().breuken.find(x => x.journaal === 'x').reden.length, 300);
});

test('bevinding: null als alles heel is, anders een regel per journaal', () => {
  assert.equal(wacht.bevinding(), null);
  wacht.meld('inzageLog', 'r1', 'ronde');
  wacht.meld('anker', 'r2', 'ankerdienst');
  const b = wacht.bevinding();
  assert.match(b, /^inzageLog \(ronde, sinds [^)]+\): r1; anker \(ankerdienst, sinds [^)]+\): r2$/);
});

test('wis: sluit een bestaande bevinding af en wekt het alarm, een onbekende naam doet niets', async () => {
  let gewekt = 0;
  wacht.meld('anker', 'r', 'ankerdienst');
  wacht.haakAlarm(() => { gewekt++; });
  wacht.wis('onbekend-journaal');
  await tik();
  assert.equal(gewekt, 0);
  wacht.wis('anker');
  await tik();
  assert.equal(gewekt, 1);
  assert.equal(wacht.bevinding(), null);
});

test('haakAlarm: alleen een functie telt, en een haak die gooit breekt niets', async () => {
  wacht.haakAlarm('geen functie');
  wacht.meld('a', 'r', 'b');
  await tik();
  assert.equal(fouten.length, 1, 'alleen de melding, geen alarmfout');
  wacht.haakAlarm(() => { throw new Error('weging stuk'); });
  wacht.meld('c', 'r', 'b');
  await tik();
  assert.equal(fouten.length, 3);
  assert.match(fouten[2], /\[auditwacht\] alarm kon niet worden gewogen: weging stuk/);
});

test('controleer: een lege of ontbrekende database is heel, en telt de rondes', () => {
  const a = wacht.controleer(null);
  assert.deepEqual(Object.values(a).map(x => x.ok), [true, true, true, true, true]);
  wacht.controleer({});
  const st = wacht.stand();
  assert.equal(st.rondes, 2);
  assert.ok(st.laatsteRonde && st.laatsteRonde.at);
  assert.deepEqual(st.laatsteRonde.uitslag, a);
});

test('controleer: elk journaal met een breuk krijgt zijn eigen reden', () => {
  const gebroken = () => { const l = rij(3); l[1] = { ...l[1], wat: 'vervalst' }; return l; };
  const uit = wacht.controleer({ data: { inzageLog: gebroken(), securityLog: gebroken(), handelingLog: rij(2),
    apiSpoor: { commandJournaal: [{ id: 'x' }] }, commandJournaal: [{ id: 'y', zegel: 'z' }] } });
  assert.equal(uit.inzageLog.ok, false);
  assert.match(uit.inzageLog.reden, /^regel \d+: /);
  assert.equal(uit.securityLog.ok, false);
  assert.equal(uit.handelingLog.ok, true);
  assert.equal(uit.apiSpoor.reden, 'de zegelketen van het API-spoor klopt niet');
  assert.equal(uit.commandJournaal.reden, 'de zegelketen van het besluitjournaal klopt niet');
  assert.deepEqual(wacht.stand().breuken.map(b => b.journaal).sort(), ['apiSpoor', 'commandJournaal', 'inzageLog', 'securityLog']);
  assert.ok(wacht.stand().breuken.every(b => b.bron === 'ronde'));
});

test('controleer: een controle die zelf faalt is een bevinding, geen stilte', () => {
  const data = { get handelingLog() { throw new Error('schijf weg'); } };
  const uit = wacht.controleer({ data });
  assert.deepEqual(uit.handelingLog, { ok: false, reden: 'de controle kon niet draaien: schijf weg' });
  assert.match(wacht.bevinding(), /handelingLog \(ronde/);
  const kaal = { get inzageLog() { throw 'zonder bericht'; } };   // eslint-disable-line no-throw-literal
  assert.equal(wacht.controleer({ data: kaal }).inzageLog.reden, 'de controle kon niet draaien: zonder bericht');
});

test('controleer: een journaal dat weer klopt verdwijnt en wekt het alarm; een heel journaal zonder breuk niet', async () => {
  let gewekt = 0;
  wacht.meld('handelingLog', 'gemeld door de requestmerge', 'requestmerge');
  wacht.haakAlarm(() => { gewekt++; });
  wacht.controleer({ data: { handelingLog: rij(2) } });
  await tik();
  assert.equal(gewekt, 1, 'alleen het herstelde journaal wekt het alarm');
  assert.equal(wacht.bevinding(), null);
});

test('start: een keer, met het interval uit de omgeving, en stop zet hem stil', async () => {
  const db = { data: { handelingLog: rij(2) } };
  assert.deepEqual(wacht.start({ db, omgeving: { RTG_AUDITWACHT_MINUTEN: '2' } }), { gestart: true, minuten: 2 });
  assert.deepEqual(wacht.start({ db }), { gestart: false, reden: 'loopt al' });
  assert.equal(wacht.stand().actief, true);
  assert.equal(wacht.stand().minuten, 2);
  await tik();
  assert.equal(wacht.stand().rondes, 1, 'de eerste ronde draait direct na de start');
  wacht.stop();
  assert.equal(wacht.stand().actief, false);
  wacht.stop();   // twee keer stoppen is geen fout
  assert.equal(wacht.stand().actief, false);
});

test('start: onzin, nul of niets in de omgeving geeft de standaard van vijf minuten', () => {
  for (const waarde of ['abc', '0', undefined]) {
    const uit = wacht.start({ db: {}, omgeving: { RTG_AUDITWACHT_MINUTEN: waarde } });
    assert.deepEqual(uit, { gestart: true, minuten: 5 }, String(waarde));
    wacht.stop();
  }
  assert.deepEqual(wacht.start({ db: {}, omgeving: { RTG_AUDITWACHT_MINUTEN: '0.2' } }).minuten, 1, 'nooit vaker dan een keer per minuut');
  wacht.stop();
});

test('start zonder opties leest process.env, en een ronde die gooit wordt gelogd en niet doorgegeven', async () => {
  const oud = process.env.RTG_AUDITWACHT_MINUTEN;
  try {
    process.env.RTG_AUDITWACHT_MINUTEN = '3';
    assert.deepEqual(wacht.start(), { gestart: true, minuten: 3 });
    wacht.stop();
  } finally { if (oud === undefined) delete process.env.RTG_AUDITWACHT_MINUTEN; else process.env.RTG_AUDITWACHT_MINUTEN = oud; }
  const stuk = { get data() { throw new Error('db stuk'); } };
  wacht.start({ db: stuk, omgeving: {} });
  await tik();
  assert.ok(fouten.some(f => /\[auditwacht\] ronde mislukt: db stuk/.test(f)));
});
