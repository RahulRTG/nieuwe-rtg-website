/* DE CAPABILITY-RESOLVER (server/kern/stuur/resolver.js, EXECUTIE.md blok 0).

   Wat hier bewezen moet worden is niet "hij kiest goed" maar iets hardere:
   hij kan de bevoegdheid niet veranderen. De resolver zit VOOR het model en
   krijgt een lijst die ./beleid.js al heeft goedgekeurd; alles wat hij doet is
   die lijst kleiner maken voor deze ene opdracht. Zakt regel 1 hieronder, dan
   is er een tweede weg naar een pad ontstaan en is de allowlist niet langer de
   waarheid.

   Twee gevallen staan er als vaste toets in omdat ze ECHT fout gingen bij het
   bouwen, niet omdat ze bedacht zijn:
     - "maak 200 euro over" koos /api/meet/maak en miste /api/bank/overboek
       (scheidbaar werkwoord: `maak` en `over` staan los in de zin);
     - "boek een tafel" leverde alleen /api/reservering/annuleer op -- een
       versmalling die precies het gevraagde vermogen verbergt.
   Allebei zijn ze de reden dat de code is zoals hij is; ze horen dus in de
   toets en niet in een commentaarregel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveer } = require('../server/kern/stuur/resolver');
const { woordenUit, bruggenVan, SYNONIEMEN } = require('../server/kern/stuur/resolver-woorden');
const { toegestanePaden } = require('../server/kern/stuur/beleid');

/* De echte routes van dit huis, uit het meetregister. Niet verzonnen: een
   resolver die alleen op speelgoedpaden werkt, bewijst niets over 120 paden. */
const ECHTE_ROUTES = [...new Set((require('../IDEMPROEF.json').perRoute || [])
  .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string')
  .map(r => r.pad))].sort();

const LEDENPADEN = toegestanePaden(ECHTE_ROUTES, 'member');

test('0. de meting zelf deugt: er is een echte, niet-lege ledenlijst om op te wegen', () => {
  assert.ok(ECHTE_ROUTES.length > 1000, 'het routeregister is leeg of te klein: ' + ECHTE_ROUTES.length);
  assert.ok(LEDENPADEN.length > 20, 'te weinig toegestane ledenpaden om iets te bewijzen: ' + LEDENPADEN.length);
});

test('1. DE GRENS: wat eruit komt is altijd een deelverzameling van wat erin ging', () => {
  const binnen = new Set(LEDENPADEN);
  const vragen = ['boek een tafel', 'maak geld over', 'zet mijn website live', 'xyzzy',
    '', null, 'agenda', 'betaal 40000 euro aan iemand anders', '../../etc/passwd', '/api/auth/login'];
  for (const v of vragen) {
    const r = resolveer(v, LEDENPADEN);
    for (const p of r.paden) assert.ok(binnen.has(p), 'resolver gaf een pad terug dat er niet in zat: ' + p + ' (vraag: ' + v + ')');
  }
});

test('2. hij verzint nooit een pad, ook niet als de vraag er een noemt', () => {
  const r = resolveer('roep /api/bank/geheim/leegmaken aan', LEDENPADEN);
  assert.ok(!r.paden.includes('/api/bank/geheim/leegmaken'));
});

test('3. hij versmalt niet naar niets: geen enkele treffer = de volledige lijst met een reden', () => {
  const r = resolveer('qqqq wwww eeee', LEDENPADEN);
  assert.equal(r.versmald, false);
  assert.equal(r.paden.length, LEDENPADEN.length);
  assert.match(r.reden, /leeg werkveld|volledige lijst/i);
});

test('4. een lege of woordloze vraag laat de lijst staan', () => {
  for (const v of ['', '   ', null, undefined, 42, {}]) {
    const r = resolveer(v, LEDENPADEN);
    assert.equal(r.versmald, false, 'versmalde op een onbruikbare vraag: ' + JSON.stringify(v));
    assert.equal(r.paden.length, LEDENPADEN.length);
  }
});

test('5. een lijst die al klein is, wordt niet verder uitgedund', () => {
  const klein = LEDENPADEN.slice(0, 5);
  const r = resolveer('agenda', klein);
  assert.equal(r.versmald, false);
  assert.deepEqual(r.paden, klein);
});

test('6. hij versmalt echt: een gewone vraag levert een klein werkveld op', () => {
  const r = resolveer('zet een afspraak in mijn agenda voor morgen', LEDENPADEN);
  assert.equal(r.versmald, true);
  assert.ok(r.paden.length < LEDENPADEN.length / 3,
    'nauwelijks versmald: ' + r.paden.length + ' van ' + LEDENPADEN.length);
  assert.ok(r.paden.some(p => p.startsWith('/api/agenda/')), 'de agendapaden ontbreken juist');
});

test('7. het scheidbare werkwoord: "maak 200 euro over" vindt de overboeking', () => {
  const r = resolveer('maak 200 euro over naar mijn spaarrekening', LEDENPADEN);
  assert.ok(r.paden.includes('/api/bank/overboek'),
    'overboek ontbreekt; gevonden: ' + r.paden.join(' '));
});

test('8. de verborgen-vermogen-val: "boek een tafel" toont de boekroute en niet alleen annuleren', () => {
  const r = resolveer('boek een tafel voor twee vanavond', LEDENPADEN);
  assert.ok(r.paden.some(p => /booking/.test(p)),
    'alleen annuleren aangeboden; gevonden: ' + r.paden.join(' '));
});

test('8b. ook zonder het woord "boek": reserveren en een kamer wijzen naar de boekroute', () => {
  /* Deze staat er apart omdat een mutatie het aan het licht bracht: geval 8
     bleef groen toen `tafel` weer een enkele brug kreeg, want `boek` in de
     vraag deed het werk al. Een toets die zijn eigen regel niet bewaakt, is
     geen toets (LAT.md regel 2). Hier staat het woord `boek` dus niet in. */
  for (const vraag of ['reserveer een tafel vanavond', 'reserveer een kamer']) {
    const r = resolveer(vraag, LEDENPADEN);
    assert.ok(r.paden.some(p => /booking/.test(p)),
      'geen boekroute voor "' + vraag + '"; gevonden: ' + r.paden.join(' '));
  }
});

test('9. elke brug in SYNONIEMEN wijst naar een woord dat echt in de routes voorkomt', () => {
  const segmenten = new Set();
  for (const pad of ECHTE_ROUTES) for (const s of pad.split('/')) if (s) segmenten.add(s.toLowerCase());
  const dood = [];
  for (const woord of Object.keys(SYNONIEMEN))
    for (const doel of bruggenVan(woord))
      if (!segmenten.has(doel)) dood.push(woord + ' -> ' + doel);
  assert.deepEqual(dood, [], 'brug(gen) naar een segment dat niet bestaat: ' + dood.join(', '));
});

test('10. de weging leest de paden en niet een eigen routelijst', () => {
  // Een pad dat niemand ooit heeft voorzien wordt gewoon gevonden op zijn eigen
  // woorden. Zou de resolver een tabel hebben, dan kon dit niet.
  const verzonnen = ['/api/eenhoorn/hoefijzer', ...LEDENPADEN];
  const r = resolveer('bestel een hoefijzer voor de eenhoorn', verzonnen);
  assert.ok(r.paden.includes('/api/eenhoorn/hoefijzer'));
});

test('11. de woordenlijst laat stopwoorden en losse letters vallen', () => {
  const w = woordenUit('ik wil dat je de agenda opent');
  assert.ok(w.includes('agenda'));
  for (const stop of ['ik', 'wil', 'dat', 'de']) assert.ok(!w.includes(stop), 'stopwoord bleef staan: ' + stop);
});

test('12. de uitslag zegt altijd waar hij vandaan komt', () => {
  const r = resolveer('agenda afspraak', LEDENPADEN);
  assert.equal(typeof r.reden, 'string');
  assert.ok(r.reden.length > 10);
  assert.equal(r.aantalVoor, LEDENPADEN.length);
});
