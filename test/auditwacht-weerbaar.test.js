/* DE AUDITWACHT, WEERBAAR (server/lib/auditwacht.js).

   De auditwacht maakt van een gebroken auditspoor een ALARM in plaats van een
   stille schrijfstoring. test/auditwacht.test.js toetst de ronde en de
   requestmerge, test/auditwacht-takken.test.js elke tak van meld/controleer/
   start. Hier staan de AANVALLEN op het spoor zelf, met de echte keten: een
   regel die verdwijnt, een regel die wordt bijgezet, een besluit dat uit het
   midden van het besluitjournaal wordt gehaald -- en de twee manieren waarop
   de wacht zelf stil kan vallen.

   Wat hier niet mag sneuvelen:
   1. een regel die uit het MIDDEN van een hashketen verdwijnt, of een regel
      die er tussen wordt gezet, is een breuk met een regelnummer;
   2. een afgekapte staart (een begrensd journaal) is GEEN breuk: anders gaat
      het alarm af bij elk journaal dat zijn limiet haalt, en klikt de piket
      het weg;
   3. in de zegelketen van het besluitjournaal en het API-spoor is een
      weggehaald besluit, een verwisselde volgorde, een gestripte zegel of een
      lege regel een breuk;
   4. een verifieerder die "niet ok" zegt zonder aan te wijzen waar, is nog
      steeds een breuk (met een eerlijke standaardreden), nooit "heel";
   5. herstel is pas herstel na een nieuwe GESLAAGDE ronde: een melding van de
      requestmerge blijft staan tot de ronde het journaal heel ziet, en het
      wissen van een andere naam wist hem niet;
   6. de periodieke ronde stempelt zich bij de sensorstilte; een ronde die
      omvalt wordt daar GETELD, zodat een stilgevallen auditwacht niet klinkt
      als een spoor dat heel is.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `return g ? 'regel ' + g.index + ': ' + g.waarom : 'de keten is gebroken'`
     vervangen door `return g ? ... : null`
     -> "4. een verifieerder die niet aanwijst" ZAKT (RAAK): de breuk telde
     dan als heel.
   - in start(): `catch (e) { stilte.fout('auditwacht', e); ...}` vervangen door
     `catch (e) { console.error(...) }`
     -> "6. een ronde die omvalt wordt geteld" ZAKT (RAAK).
   - in controleer(): `else if (staat.breuken.has(naam)) {...}` vervangen door
     `else if (false) {...}`
     -> "1. een regel die verdwijnt" en "5. herstel is pas herstel na een
     geslaagde ronde" ZAKKEN (RAAK): de breuk bleef dan ook na herstel staan.

   Draai: node --test test/auditwacht-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const keten = require('../server/lib/keten');
const { commandHash } = require('../server/lib/zegelketen');
const wacht = require('../server/lib/auditwacht');
const stilte = require('../server/kern/command/sensorstilte');
const { wachtOpWaarde } = require('./helper');

const rij = n => { const l = []; for (let i = 0; i < n; i++) keten.noteerIn(l, { at: 'a' + i, wat: 'w' + i }, 0); return l; };
function zegels(n) {
  const l = [];
  for (let i = 0; i < n; i++) {
    const kern = { id: 'c' + i, actie: 'besluit ' + i, vorig: i ? l[i - 1].zegel : null };
    l.push({ ...kern, zegel: commandHash(kern) });
  }
  return l;
}

const echteFout = console.error;
test.beforeEach(() => { wacht._wis(); wacht.haakAlarm(null); console.error = () => {}; });
test.afterEach(() => { console.error = echteFout; wacht.stop(); wacht._wis(); stilte._wis(); });

test('1. een regel die uit het midden verdwijnt of ertussen wordt gezet, is een breuk met een regelnummer', () => {
  const weg = rij(5); weg.splice(2, 1);
  const uit = wacht.controleer({ data: { securityLog: weg } });
  assert.equal(uit.securityLog.ok, false, 'een verwijderde regel in het beveiligingsjournaal moet opvallen');
  assert.match(uit.securityLog.reden, /^regel 1: /);

  const erbij = rij(4);
  erbij.splice(2, 0, { at: 'x', wat: 'bijgezet', hash: erbij[2].hash, vorige: erbij[3].hash });
  const uit2 = wacht.controleer({ data: { inzageLog: erbij } });
  assert.equal(uit2.inzageLog.ok, false, 'een bijgezette regel met een geleende hash valt op');

  const gat = rij(4); delete gat[1].hash;
  assert.match(wacht.controleer({ data: { handelingLog: gat } }).handelingLog.reden, /^regel 0: verwijst naar een voorganger die zijn hash kwijt is/,
    'een gestripte hash in het midden is geen "oude regel" maar een gat');
  /* Elke ronde kijkt naar de opgeslagen waarheid van ALLE journalen: in deze
     laatste ronde ontbraken het beveiligings- en het inzagejournaal, dus hun
     breuk is van het bord. Wat blijft, is de breuk die deze ronde zag. */
  assert.deepEqual(wacht.stand().breuken.map(b => b.journaal), ['handelingLog']);
});

test('2. een afgekapte staart van een begrensd journaal is geen breuk', () => {
  const l = []; for (let i = 0; i < 12; i++) keten.noteerIn(l, { at: 't' + i, wat: 'w' + i }, 5);
  assert.equal(l.length, 5);
  const uit = wacht.controleer({ data: { securityLog: l, inzageLog: l.slice(0, 3) } });
  assert.equal(uit.securityLog.ok, true, 'een journaal dat zijn limiet haalt, is niet gebroken');
  assert.equal(uit.inzageLog.ok, true);
  assert.equal(wacht.bevinding(), null);
  // oude regels van voor de keten, ONDER de oudste geketende regel, zijn erfenis en geen breuk
  const met = rij(3); met.push({ at: 'oud', wat: 'van voor de keten' });
  assert.equal(wacht.controleer({ data: { securityLog: met } }).securityLog.ok, true);
});

test('3. de zegelketen: een weggehaald besluit, een verwisselde volgorde, een gestripte zegel of een lege regel', () => {
  assert.equal(wacht.controleer({ data: { commandJournaal: zegels(4), apiSpoor: { commandJournaal: zegels(3) } } }).commandJournaal.ok, true);
  const gevallen = {
    'weggehaald besluit': (l) => { l.splice(1, 1); return l; },
    'verwisselde volgorde': (l) => { [l[1], l[2]] = [l[2], l[1]]; return l; },
    'gestripte zegel': (l) => { delete l[2].zegel; return l; },
    'lege regel': (l) => { l[3] = null; return l; },
    'herschreven besluit': (l) => { l[0].actie = 'iets anders'; return l; },
    'regel zonder id': (l) => { delete l[1].id; return l; }
  };
  for (const [naam, maak] of Object.entries(gevallen)) {
    wacht._wis();
    const uit = wacht.controleer({ data: { commandJournaal: maak(zegels(4)), apiSpoor: { commandJournaal: maak(zegels(4)) } } });
    assert.equal(uit.commandJournaal.ok, false, naam + ' in het besluitjournaal');
    assert.equal(uit.apiSpoor.ok, false, naam + ' in het API-spoor');
  }
  // een API-spoor zonder journaal is leeg, en leeg is heel
  wacht._wis();
  assert.equal(wacht.controleer({ data: { apiSpoor: {} } }).apiSpoor.ok, true);
});

test('4. een verifieerder die "niet ok" zegt zonder aan te wijzen waar, is nog steeds een breuk', () => {
  const echt = keten.verifieer;
  keten.verifieer = () => ({ ok: false });
  try {
    const uit = wacht.controleer({ data: {} });
    for (const naam of ['inzageLog', 'securityLog', 'handelingLog']) {
      assert.deepEqual(uit[naam], { ok: false, reden: 'de keten is gebroken' }, naam);
    }
    keten.verifieer = () => ({ ok: false, gebroken: [] });
    assert.equal(wacht.controleer({ data: {} }).securityLog.reden, 'de keten is gebroken');
  } finally { keten.verifieer = echt; }
});

test('5. herstel is pas herstel na een geslaagde ronde, en wissen van een andere naam wist niets', async () => {
  let gewekt = 0;
  wacht.haakAlarm(() => { gewekt++; });
  wacht.meld('securityLog', 'regel 4: vervalst', 'requestmerge/database');
  wacht.wis('anker');
  wacht.wis('securityLog ');
  assert.match(wacht.bevinding(), /^securityLog \(requestmerge\/database, sinds /, 'een andere naam wist de breuk niet');
  // een ronde die ook een breuk ziet, laat hem staan (met de ronde als bron)
  const kapot = rij(3); kapot[1] = { ...kapot[1], wat: 'vervalst' };
  wacht.controleer({ data: { securityLog: kapot } });
  assert.equal(wacht.stand().breuken[0].bron, 'ronde');
  assert.equal(wacht.stand().breuken.length, 1);
  await wachtOpWaarde(() => gewekt === 1, { wat: 'een wekker voor de eerste breuk' });
  // pas een ronde die het journaal heel ziet, sluit hem af
  wacht.controleer({ data: { securityLog: rij(3) } });
  assert.equal(wacht.bevinding(), null);
  await wachtOpWaarde(() => gewekt === 2, { wat: 'een wekker voor het herstel' });
  assert.equal(wacht.stand().laatsteRonde.uitslag.securityLog.ok, true);
});

test('6. de periodieke ronde stempelt bij de sensorstilte, en een ronde die omvalt wordt geteld', async () => {
  stilte._wis();
  const van = () => stilte.oordeel().find(r => r.naam === 'auditwacht');
  wacht.start({ db: { data: { securityLog: rij(2) } }, omgeving: { RTG_AUDITWACHT_MINUTEN: '1' } });
  const goed = await wachtOpWaarde(() => { const s = van(); return s && /rondes, laatste/.test(s.reden) ? s : null; },
    { wat: 'een geslaagde ronde van de auditwacht' });
  assert.equal(goed.stand, 'levend');
  assert.equal(goed.fouten, 0);
  wacht.stop();

  stilte._wis();
  wacht.start({ db: { get data() { throw new Error('opslag onleesbaar'); } }, omgeving: {} });
  const stuk = await wachtOpWaarde(() => { const s = van(); return s && s.fouten >= 1 ? s : null; },
    { wat: 'een getelde fout van de auditwacht' });
  assert.match(stuk.reden, /1 mislukte rondes en nog geen geslaagde/,
    'een auditwacht die alleen omvalt, heeft geen geslaagde ronde -- en klinkt dus niet als een heel spoor');
  assert.match(stuk.laatsteFout.reden, /opslag onleesbaar/);
});
