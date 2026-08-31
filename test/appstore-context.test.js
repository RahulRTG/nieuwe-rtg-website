/* DE CONTEXTBRUG -- RTG geeft een app de waarden van EEN handeling, en niets meer.

   Wat deze toets vastlegt:

     1. Alleen velden uit de gesloten lijst; een onbekend veld is een FOUT en
        wordt niet genegeerd -- anders denkt een aanroeper iets mee te geven wat
        nooit aankomt.
     2. Er komt nooit een identificator langs deze weg: wat op een e-mailadres,
        telefoonnummer of iban lijkt, wordt geweigerd.
     3. Klaarzetten geeft de app NIETS. Pas het lid geeft door.
     4. Een overdracht is EENMALIG: de tweede keer bestaat hij niet meer.
     5. Hij is van EEN lid: een ander komt er niet bij.
     6. Hij is voor EEN app: doorgeven aan een andere app wordt geweigerd.
     7. Er is geen machtiging die dit een keer aanzet -- de machtigingencatalogus
        kent hem niet, en dat is het verschil met een brugmethode.

   Draai los: node --test test/appstore-context.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakContext, VELDEN } = require('../server/kern/appstore/context');
const { MACHTIGINGEN } = require('../server/kern/appstore/machtigingen');

function proef(nuISO) {
  const staat = {};
  let klok = nuISO || '2026-08-31T12:00:00.000Z';
  const c = maakContext({ S: () => staat, save: () => {}, nu: () => klok });
  return { staat, c, zet: (t) => { klok = t; } };
}

test('1. alleen velden uit de gesloten lijst', () => {
  const { c } = proef();
  const r = c.klaarzet('K1', 'app', { verzonnen: 1 });
  assert.equal(r.status, 400);
  assert.match(r.error, /bestaat niet/);
  assert.match(r.error, /bedrag/, 'de lijst staat in de fout, zodat niemand hoeft te raden');
  assert.equal(c.klaarzet('K1', 'app', {}).status, 400, 'leeg is geen handeling');
});

test('2. er komt nooit iets langs waarmee je een mens vindt', () => {
  const { c } = proef();
  for (const stiekem of ['jan@example.com', '+31612345678', 'NL91ABNA0417164300']) {
    const r = c.klaarzet('K1', 'app', { bestemming: stiekem });
    assert.equal(r.status, 400, stiekem + ' kwam er toch door');
  }
  /* En een gewone plaatsnaam wel: de grens mag niet zo streng zijn dat hij het
     veld nutteloos maakt. */
  assert.equal(c.klaarzet('K1', 'app', { bestemming: 'Rome' }).status, 200);
});

test('3. klaarzetten geeft de app niets; lezen verbruikt niets', () => {
  const { c } = proef();
  const k = c.klaarzet('K1', 'rtg-rekenmachine', { bedrag: 184.5, btwTarief: 21 });
  assert.equal(k.status, 200);
  assert.match(k.let, /beslist zelf/);
  /* Twee keer lezen mag: het lid moet kunnen kijken voordat hij beslist. */
  assert.equal(c.lees('K1', k.id).status, 200);
  assert.equal(c.lees('K1', k.id).status, 200);
  const toont = c.lees('K1', k.id).toont;
  assert.deepEqual(toont.map(t => t.veld), ['bedrag', 'btwTarief']);
  assert.equal(toont[0].waarde, 184.5, 'de waarde staat er voluit, niet samengevat');
  /* En hoe hij er voor een mens uitziet, wordt EEN keer bepaald: twee schermen
     die hetzelfde getal anders schrijven, zijn twee waarheden. */
  assert.equal(toont[0].tekst, 'EUR 184,50');
  assert.equal(toont[1].tekst, '21%');
});

test('4. doorgeven kan een keer', () => {
  const { c } = proef();
  const k = c.klaarzet('K1', 'app', { bedrag: 10 });
  const eerste = c.geef('K1', k.id);
  assert.equal(eerste.status, 200);
  assert.deepEqual(eerste.velden, { bedrag: 10 });
  const tweede = c.geef('K1', k.id);
  assert.equal(tweede.status, 404, 'de tweede keer bestaat hij niet meer');
  assert.equal(c.lees('K1', k.id).status, 404);
});

test('5. een overdracht van een ander lid bestaat niet', () => {
  const { c } = proef();
  const k = c.klaarzet('K1', 'app', { bedrag: 10 });
  assert.equal(c.lees('K2', k.id).status, 404);
  assert.equal(c.geef('K2', k.id).status, 404);
  assert.equal(c.geef('K1', k.id).status, 200, 'en de eigenaar kan er nog wel bij');
});

test('6. hij is voor een app, en niet voor de app die er toevallig openstaat', () => {
  const { c } = proef();
  const k = c.klaarzet('K1', 'rtg-rekenmachine', { bedrag: 10 });
  assert.equal(c.geef('K1', k.id, 'rtg-tetris').status, 403);
  assert.equal(c.geef('K1', k.id, 'rtg-rekenmachine').status, 200);
});

test('7. hij verloopt, en een verlopen overdracht is er gewoon niet meer', () => {
  const p = proef('2026-08-31T12:00:00.000Z');
  const k = p.c.klaarzet('K1', 'app', { bedrag: 10 });
  p.zet('2026-08-31T12:14:00.000Z');
  assert.equal(p.c.lees('K1', k.id).status, 200, 'binnen het kwartier');
  p.zet('2026-08-31T12:16:00.000Z');
  assert.equal(p.c.lees('K1', k.id).status, 404, 'daarna niet meer');
  assert.match(p.c.lees('K1', k.id).error, /kwartier/, 'en de reden staat erbij');
});

test('8. dit is geen machtiging, en dat is het hele punt', () => {
  for (const m of MACHTIGINGEN) {
    assert.ok(!/context/i.test(m.id), 'er bestaat een machtiging "' + m.id + '" die hierop lijkt');
  }
  /* Elk veld draagt een wereld en een uitleg die een lid leest: een veld zonder
     uitleg is een veld waar niemand ja op kan zeggen. */
  for (const naam of Object.keys(VELDEN)) {
    assert.ok(VELDEN[naam].label && VELDEN[naam].uitleg && VELDEN[naam].wereld, naam + ' is niet uit te leggen');
  }
});
