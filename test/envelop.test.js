/* DE EVENTENVELOP: de taal op de bus.

   OS.md par. 3 mat het gat: *de bus vervoert, er is geen taal.* Van de
   publicerende plekken droeg er een een `versie`, een een `id`, en geen enkele
   iets waarmee je twee gebeurtenissen aan elkaar knoopt.

   Dit bestand bewaakt vier dingen, en drie ervan zijn grenzen en geen functies:

     1. DE ACTOR IS EEN CODENAAM. Een envelop gaat met REDIS_URL over een
        netwerk en door een geheugendatabase. Dat is precies de plek waar een
        echte naam of een e-mailadres ongemerkt uit de identiteitskluis lekt.
        Toets 3 en 8.
     2. ONBEKEND IS GEEN OPENBAAR. Wie de gevoeligheid niet noemt, krijgt
        `onbekend` -- nooit de geruststellende waarde. Toets 2, en toets 5 zegt
        dat een gevolg-gebeurtenis de classificatie NIET erft: dat zou raden
        zijn, en raden over gevoeligheid is de duurste soort raden.
     3. DE LEVERING GAAT VOOR. Een fout in de envelop mag nooit een melding
        tegenhouden, en mag ook nooit stil verdwijnen. Toets 8.
     4. DE BROWSER ZIET DE ENVELOP NOOIT. De SSE-laag stuurt `data` en verder
        niets; de actor en de classificatie blijven binnen. Toets 9.

   Draai los: node --test test/envelop.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../server/kern/envelop');
const { maakBus } = require('../server/bus');
const { maakSse } = require('../server/kern/sse');
const meter = require('../scripts/envelop');

test('1. een envelop draagt acht velden en geen negende', () => {
  /* De opsomming staat er voluit omdat de envelop GESLOTEN is: zodra er een
     veld bij mag, staat er binnen een jaar inhoud in en is het een tweede
     berichtformaat. Deze toets zakt zowel bij een veld erbij als bij een veld
     eraf. */
  const e = E.maak({ kanaal: 'sse' });
  assert.deepEqual(Object.keys(e).sort(),
    ['actor', 'at', 'classificatie', 'correlatie', 'id', 'kanaal', 'oorzaak', 'versie']);
  assert.equal(e.versie, E.VERSIE);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(e.at), 'de tijd staat in ISO');
  assert.notEqual(E.maak({ kanaal: 'x' }).id, E.maak({ kanaal: 'x' }).id, 'elke gebeurtenis een eigen id');
  assert.ok(Object.isFrozen(e), 'een envelop ligt vast zodra hij bestaat');
  e.actor = 'anders';
  assert.equal(e.actor, null, 'en laat zich niet omschrijven');
});

test('2. wie de gevoeligheid niet noemt, krijgt onbekend en niet openbaar', () => {
  assert.equal(E.maak({ kanaal: 'sse' }).classificatie, 'onbekend');
  assert.equal(E.maak({ kanaal: 'sse', classificatie: 'verzonnen' }).classificatie, 'onbekend',
    'een classificatie buiten de lijst bestaat niet');
  assert.equal(E.maak({ kanaal: 'sse', classificatie: 'bijzonder' }).classificatie, 'bijzonder');
  for (const soort of ['openbaar', 'intern', 'persoonsgegeven', 'bijzonder', 'onbekend'])
    assert.ok(E.CLASSIFICATIES[soort], soort + ' staat op de lijst met een uitleg');
});

test('3. de actor is een codenaam, geen contactgegeven', () => {
  assert.equal(E.maak({ kanaal: 'sse', actor: 'Reiziger Zeven' }).actor, 'Reiziger Zeven',
    'een codenaam met een spatie mag');
  assert.equal(E.maak({ kanaal: 'sse' }).actor, null, 'geen actor is geen probleem');
  assert.throws(() => E.maak({ kanaal: 'sse', actor: 'jan@voorbeeld.nl' }), /contactgegeven/,
    'een e-mailadres hoort niet op de bus');
  assert.throws(() => E.maak({ kanaal: 'sse', actor: '+31 6 12345678' }), /contactgegeven/,
    'een telefoonnummer evenmin');
  assert.throws(() => E.maak({ kanaal: 'sse', actor: { codename: 'x' } }), /codenaam/,
    'een object is geen codenaam');
  assert.throws(() => E.maak({ kanaal: 'sse', actor: 'x'.repeat(65) }), /te lang/);
});

test('4. de eerste gebeurtenis van een keten is zijn eigen correlatie', () => {
  const e = E.alsStart(E.maak({ kanaal: 'sse' }));
  assert.equal(e.correlatie, e.id);
  const later = E.alsStart(E.maak({ kanaal: 'sse', correlatie: 'bestaande-keten' }));
  assert.equal(later.correlatie, 'bestaande-keten', 'een lopende keten wordt niet overschreven');
});

test('5. binnen een keten erven correlatie en actor, en de classificatie juist niet', () => {
  const eerste = E.alsStart(E.maak({ kanaal: 'sse', actor: 'Reiziger Zeven', classificatie: 'bijzonder' }));
  E.inKeten(eerste, () => {
    assert.equal(E.huidige().id, eerste.id, 'binnen de keten weet je welke gebeurtenis je afhandelt');
    const gevolg = E.maak({ kanaal: 'sse' });
    assert.equal(gevolg.correlatie, eerste.correlatie, 'dezelfde keten');
    assert.equal(gevolg.oorzaak, eerste.id, 'en de directe oorzaak wijst terug');
    assert.equal(gevolg.actor, 'Reiziger Zeven', 'de actor blijft dezelfde mens');
    assert.equal(gevolg.classificatie, 'onbekend',
      'de gevoeligheid erft NIET: dat zou raden zijn over andere inhoud');
  });
  assert.equal(E.huidige(), null, 'buiten de keten is er geen huidige gebeurtenis');
});

test('6. de bus stempelt elk bericht, en stempelt nooit twee keer', () => {
  const bus = maakBus();
  const gezien = [];
  bus.subscribe('proef', m => gezien.push(m));
  bus.publish('proef', { doel: 'key', match: 'k1', event: 'ping', data: { x: 1 } });
  assert.equal(gezien.length, 1);
  const m = gezien[0];
  assert.equal(m.doel, 'key', 'de bestaande sleutels blijven staan');
  assert.deepEqual(m.data, { x: 1 });
  assert.ok(m.envelop && m.envelop.id, 'en er komt een envelop bij');
  assert.equal(m.envelop.kanaal, 'proef');
  assert.equal(m.envelop.correlatie, m.envelop.id, 'de eerste is zijn eigen keten');

  /* Een bericht dat al een envelop MET id draagt, is al eerder gebeurd -- bij
     Redis komt het bij het publicerende proces terug. Dat mag geen tweede
     identiteit krijgen, anders telt elk incident dubbel. */
  bus.publish('proef', m);
  assert.equal(gezien[1].envelop.id, m.envelop.id, 'dezelfde gebeurtenis, hetzelfde id');
});

test('7. wie binnen een afhandeling publiceert, blijft in dezelfde keten', () => {
  const bus = maakBus();
  const gezien = [];
  bus.subscribe('keten', m => {
    gezien.push(m);
    if (m.event === 'eerste') bus.publish('keten', { event: 'tweede', data: {} });
  });
  bus.publish('keten', { event: 'eerste', data: {}, envelop: { actor: 'Reiziger Zeven', classificatie: 'persoonsgegeven' } });
  assert.equal(gezien.length, 2);
  assert.equal(gezien[0].envelop.actor, 'Reiziger Zeven');
  assert.equal(gezien[1].envelop.correlatie, gezien[0].envelop.correlatie, 'een keten');
  assert.equal(gezien[1].envelop.oorzaak, gezien[0].envelop.id, 'en het gevolg wijst naar zijn oorzaak');
  assert.notEqual(gezien[1].envelop.id, gezien[0].envelop.id, 'maar het zijn twee gebeurtenissen');
});

test('8. een geweigerde actor houdt het bericht niet tegen, en verdwijnt niet stil', () => {
  const bus = maakBus();
  const gezien = [];
  const gewaarschuwd = [];
  const oud = console.warn;
  console.warn = (...a) => gewaarschuwd.push(a.join(' '));
  try {
    bus.subscribe('proef', m => gezien.push(m));
    bus.publish('proef', { event: 'ping', data: { x: 1 }, envelop: { actor: 'jan@voorbeeld.nl', classificatie: 'intern' } });
  } finally { console.warn = oud; }
  assert.equal(gezien.length, 1, 'het bericht is gewoon afgeleverd');
  assert.equal(gezien[0].envelop.actor, null, 'maar zonder de actor die niet mocht');
  assert.equal(gezien[0].envelop.classificatie, 'intern', 'de rest van de opgave blijft staan');
  assert.equal(gewaarschuwd.length, 1, 'en er staat een waarschuwing in het log');
  assert.match(gewaarschuwd[0], /envelop geweigerd/);
});

test('9. de envelop bereikt de browser nooit', () => {
  /* De actor en de classificatie zijn intern. Zouden ze meeliften op de
     SSE-regel, dan lekt de codenaam van het ene lid naar het scherm van het
     andere. De afleverlaag stuurt alleen `data`; deze toets legt dat vast op de
     BYTES die de verbinding in gaan en niet op de bedoeling. */
  const bus = maakBus();
  const sse = maakSse({ bus });
  const geschreven = [];
  sse.sseClients.push({ tier: 'rtg', key: 'k1', res: { write: (s) => geschreven.push(s) } });
  bus.publish('sse', { doel: 'key', match: 'k1', event: 'ping', data: { x: 1 },
    envelop: { actor: 'Reiziger Zeven', classificatie: 'persoonsgegeven' } });
  const uit = geschreven.join('');
  assert.match(uit, /event: ping/, 'het event komt aan');
  assert.match(uit, /"x":1/, 'met zijn data');
  assert.ok(!uit.includes('Reiziger Zeven'), 'en zonder de actor');
  assert.ok(!uit.includes('persoonsgegeven'), 'en zonder de classificatie');
  assert.ok(!uit.includes('envelop'), 'de envelop gaat de deur niet uit');
});

test('10. elke plek die zelf een bericht samenstelt, zegt hoe gevoelig het is', () => {
  const uit = meter.meet();
  assert.ok(uit.stelenZelfSamen >= 6, 'de meter vindt de publicerende plekken, nu: ' + uit.stelenZelfSamen);
  assert.deepEqual(uit.zonderClassificatie, [],
    'zonder classificatie: ' + uit.zonderClassificatie.join(', '));
});

test('11. tegenproef: de meter ziet het verschil tussen samenstellen en doorgeven', () => {
  /* Zonder dit onderscheid meldt de meter voor altijd een gat dat niemand kan
     dichten -- een doorgeefluik heeft geen eigen classificatie. En zonder de
     tegenproef zou hij ook groen blijven als hij ALLES doorgeefluik noemde. */
  const uit = meter.analyse([
    { bestand: 'a.js', kanaal: 'sse', doorgeef: false, classificatie: true, actor: true },
    { bestand: 'b.js', kanaal: 'sse', doorgeef: false, classificatie: false, actor: false },
    { bestand: 'c.js', kanaal: 'x', doorgeef: true, classificatie: false, actor: false }
  ]);
  assert.equal(uit.plekken, 3);
  assert.equal(uit.doorgeefluiken, 1);
  assert.equal(uit.stelenZelfSamen, 2);
  assert.equal(uit.metClassificatie, 1);
  assert.equal(uit.metActor, 1);
  assert.deepEqual(uit.zonderClassificatie, ['b.js (sse)'], 'het gat wordt bij naam genoemd');
});

test('12. het tweede argument bepaalt of iets samenstelt of doorgeeft', () => {
  assert.equal(meter.argumentNa('publish(k, b)', 'publish(k, '.length), 'b');
  assert.equal(meter.argumentNa('publish(k, { a: 1 })', 'publish(k, '.length), '{ a: 1 }');
  assert.equal(meter.argumentNa('publish(k, Object.assign({ a: 1 }, x))', 'publish(k, '.length),
    'Object.assign({ a: 1 }, x)');
});
