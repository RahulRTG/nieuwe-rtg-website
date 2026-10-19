/* EEN PROEF DIE ONDER DE SIMULATIEBANK BETAALT, LEGT ZIJN AFLOOP VAST.

   BEWIJSMACHINE.md par. 6a: een proef kan een geldige uitslag geven en toch het
   verkeerde experiment zijn uitgevoerd. RITPROEF.json uit de meetronde van 19
   oktober 2026 (stempel dc501544) gaf zes schakels stuk. De meetronde draait met
   RTG_SIMULATIEBANK=1, en die bank (server/betaal/synthetisch.js) kiest de
   afloop per herhaalsleutel: 85 betaald, 7 geweigerd, 5 traag, 3 terugboeking.
   /api/ride/pay laadt bij met een sleutel die van de rit-ref afhangt, en die ref
   is per run anders. Schakel 2 kreeg een 402, en de rest viel erachteraan. Een
   muntworp in de meting.

   DE REGEL. Een proef die een route aanroept die de bankrail raakt (RAILROUTES)
   vraagt zijn afloop uitdrukkelijk: een sleutel waarvan vooraf vaststaat wat de
   bank zegt (betaaldeSleutel / afloop in scripts/lib/voltooizorggeld.js, of
   scripts/lib/simulatieafloop.js), of `simulatie: '<afloop>'` waar de route dat
   doorgeeft. Een proef zonder zo'n merk zakt -- tenzij hij in BEKEND_OPEN staat
   met de reden, en die lijst mag alleen krimpen.

   RAILROUTES IS EEN ONDERGRENS. De rail wordt via ingespoten kernnamen bereikt;
   statisch is niet elke weg te volgen. De lijst is daarom uitgeschreven, en de
   toets bewaakt twee dingen: elke route die de router werkelijk kent, en elke
   route waarvan het routeblok zichtbaar een betaalfunctie aanroept, staat erin.
   Wat er toch doorglipt, zegt het stempel (scripts/lib/stempel.js): een register
   dat met de simulatiebank aan is gemeten, noemt dat en de gevraagde afloop.

   Los: node --test test/simulatieafloop.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SA = require('../scripts/lib/simulatieafloop');

const WORTEL = path.join(__dirname, '..');

/* Proeven die geld bewegen zonder vastgelegde afloop, en die nog niet zijn
   nagelopen (gemeten op 19 oktober 2026). Elke regel is een te repareren
   proef; de lijst mag alleen KRIMPEN. Een proef die hier staat en inmiddels een
   merk draagt, moet eraf -- anders verbergt de lijst een reparatie. */
const BEKEND_OPEN = {
  'scripts/bezorgproef.js': '/api/order/pay met een ref per run',
  'scripts/factuurproef.js': '/api/pay/oplaad met een vaste sleutel waarvan niet is nagegaan wat de bank zegt',
  'scripts/ketenronde.js': '/api/pay/oplaad; de ronde saboteert bewust, maar de afloop van de bank zelf ligt niet vast',
  'scripts/moveproef.js': '/api/booking/pay met een ref per run',
  'scripts/omzetproef.js': '/api/order/pay met een ref per run',
  'scripts/romeproef.js': '/api/reisbureau/betaal',
  'scripts/lib/herstelwereld.js': '/api/pay/oplaad bij het klaarzetten van de wereld, met een sleutel waarvan niet is nagegaan wat de bank zegt',
  'scripts/lib/idemwereld.js': '/api/pay/oplaad; de idemproef meet de herhaling, maar de afloop van de eerste oplading ligt niet vast',
  'scripts/lib/rolproef.js': '/api/pay/oplaad in de rolwereld',
  'scripts/lib/voltooi/assets.js': '/api/asset/aanvraag/betaal',
  'scripts/lib/voltooi/move.js': '/api/booking/pay',
  'scripts/lib/voltooi/pay.js': '/api/pay/oplaad; het scenario meet ook de weigering, maar via een sleutel die niet is vastgelegd',
  'scripts/lib/voltooi/terplaatse.js': '/api/booking/pay'
};

/* Bestanden die een railroute als GEGEVEN noemen en hem niet aanroepen. */
const NOEMT_ALLEEN = new Set(['simulatieafloop.js', 'appcontract.js']);

function proefBestanden() {
  const uit = fs.readdirSync(path.join(WORTEL, 'scripts')).filter((f) => /proef.*\.js$|ronde\.js$/.test(f)).map((f) => 'scripts/' + f);
  for (const f of fs.readdirSync(path.join(WORTEL, 'scripts/lib/voltooi'))) if (f.endsWith('.js')) uit.push('scripts/lib/voltooi/' + f);
  /* Ook de bibliotheken: een opbouw of wereld die oplaadt, betaalt net zo goed
     (scripts/lib/idoropbouw.js gaf in ronde 11 een 402). Niet de registers die
     de routes alleen NOEMEN. */
  for (const f of fs.readdirSync(path.join(WORTEL, 'scripts/lib'))) {
    if (f.endsWith('.js') && !NOEMT_ALLEEN.has(f)) uit.push('scripts/lib/' + f);
  }
  return uit.sort();
}

test('elke proef die de bankrail raakt, legt zijn afloop vast (of staat met reden in BEKEND_OPEN)', () => {
  const open = [];
  for (const f of proefBestanden()) {
    const t = fs.readFileSync(path.join(WORTEL, f), 'utf8');
    const raakt = SA.raaktRail(t);
    if (!raakt.length || SA.legtAfloopVast(t)) continue;
    if (!BEKEND_OPEN[f]) open.push(f + ' roept ' + raakt.join(', ') + ' aan zonder vastgelegde afloop');
  }
  assert.deepEqual(open, [], 'een muntworp in de meting:\n  ' + open.join('\n  '));
});

test('BEKEND_OPEN mag alleen krimpen: wie gerepareerd is, staat er niet meer in', () => {
  for (const f of Object.keys(BEKEND_OPEN)) {
    const p = path.join(WORTEL, f);
    assert.ok(fs.existsSync(p), f + ' bestaat niet meer; haal hem uit BEKEND_OPEN');
    const t = fs.readFileSync(p, 'utf8');
    assert.ok(SA.raaktRail(t).length > 0, f + ' raakt de rail niet meer; haal hem uit BEKEND_OPEN');
    assert.ok(!SA.legtAfloopVast(t), f + ' legt zijn afloop nu vast; haal hem uit BEKEND_OPEN');
  }
});

test('RAILROUTES bestaan bij de router, en wat zichtbaar betaalt staat erin', () => {
  const routes = require('../scripts/lib/routes').alleRoutes();
  const paden = new Set(routes.map((r) => r.pad));
  for (const p of SA.RAILROUTES) assert.ok(paden.has(p), p + ' staat in RAILROUTES maar de router kent hem niet');
  const cache = {};
  const blok = (r) => {
    if (!r.bestand || !r.regel) return '';
    const t = cache[r.bestand] = cache[r.bestand] || fs.readFileSync(path.join(WORTEL, r.bestand), 'utf8');
    const i = t.split('\n').slice(r.regel - 1).join('\n');
    const j = i.slice(1).search(/\n\s*app\.(get|post|put|delete|patch)\(/);
    return j < 0 ? i.slice(0, 4000) : i.slice(0, j + 1);
  };
  const zichtbaar = routes.filter((r) => SA.ROEPT_RAIL.test(blok(r))).map((r) => r.pad);
  for (const p of zichtbaar) assert.ok(SA.RAILROUTES.includes(p), p + ' roept zichtbaar een betaalfunctie aan maar staat niet in RAILROUTES');
});

test('de herkenning: een merk telt alleen als echte code, een vergelijking is geen aanroep', () => {
  assert.deepEqual(SA.raaktRail("P('/api/ride/pay', { ref }, M)"), ['/api/ride/pay']);
  assert.deepEqual(SA.raaktRail("P('/api/ride/request', {}, M)"), []);
  assert.equal(SA.legtAfloopVast("const { kiesRef } = require('./lib/simulatieafloop');"), false, 'een import alleen legt niets vast');
  assert.equal(SA.legtAfloopVast("await kiesRef(maak, 'betaald')"), true);
  assert.equal(SA.legtAfloopVast("w.post('/api/pay/oplaad', { idem: betaaldeSleutel(c) })"), true);
  assert.equal(SA.legtAfloopVast("w.post('/api/x', { simulatie: 'betaald' })"), true);
  assert.equal(SA.legtAfloopVast('// hier zou betaaldeSleutel moeten staan'), false, 'een merk in commentaar telt niet');
});

test('het stempel noemt de simulatiebank en de gevraagde afloop', () => {
  SA._herstel();
  assert.equal(SA.stempelDeel({}), undefined, 'zonder bank geen veld');
  const zonder = SA.stempelDeel({ RTG_SIMULATIEBANK: '1' });
  assert.equal(zonder.aan, true);
  assert.match(String(zonder.afloop), /niet vastgelegd/);
  SA.bankAan(); SA.vraag('betaald', 'gelukspad');
  const met = SA.stempelDeel({});
  assert.deepEqual(met.afloop, [{ afloop: 'betaald', waarvoor: 'gelukspad' }]);
  SA._herstel();
});
