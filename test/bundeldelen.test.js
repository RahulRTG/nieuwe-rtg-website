/* De bundels en hun losse delen mogen niet uit elkaar lopen.

   DIT KOMT UIT EEN ECHTE FOUT, en uit de duurste soort: eentje die niets liet
   zakken. De grote browser-scripts staan opgeknipt in public/<naam>/NN-*.js en
   worden rauw aaneengeplakt tot public/<naam>.js. Bewerk je de BUNDEL in
   plaats van de delen, dan werkt alles -- de bundel is wat de browser krijgt --
   tot iemand `npm run build` draait. Dan wordt de bundel opnieuw uit de oude
   delen geschreven en is de wijziging weg. Geen fout, geen melding, gewoon een
   week werk minder.

   Zo verdwenen hier het lege beginscherm, de hoofdwerelden, de Berichten-app en
   het app-menu: vier commits hadden alleen de bundel aangeraakt, en de vijfde
   draaide de build. De afwijking stond er al die tijd; hij is alleen nooit
   gemeten op een moment dat iemand keek.

   Want de meting BESTOND al: scripts/check.js regel 6 roept controleer() aan.
   Maar check.js draait in CI en niet tijdens het werk, en `npm test` -- wat je
   wel de hele dag draait -- kwam er nooit langs. Een handhaver die op de
   verkeerde plek staat, handhaaft niets. Vandaar deze toets: dezelfde regel,
   nu in de suite die bij elke wijziging draait.

   Draai los: node --test test/bundeldelen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { bundels, bundel, controleer } = require('../scripts/bundel');
const PUB = path.join(__dirname, '..', 'public');

test('elke bundel is de som van zijn delen', () => {
  controleer();
});

test('en de meting slaat uit als er een byte verschilt', () => {
  /* De ijking van de toets hierboven. controleer() leest van schijf, dus de
     enige manier om hem te voeden is een echt bestand echt scheeftrekken --
     en het daarna terugzetten, in een finally, want een proef die rommel
     achterlaat is erger dan geen proef.

     Met opzet shared/metgezel.js: dat is een van de drie bundels die het bij
     de storing hierboven begaven. */
  const naam = 'shared/metgezel.js';
  assert.ok(bundels[naam], naam + ' hoort een bundel te zijn');
  const doel = path.join(PUB, naam);
  const echt = fs.readFileSync(doel);

  try {
    fs.writeFileSync(doel, Buffer.concat([echt, Buffer.from('\n/* scheef */\n')]));
    assert.throws(() => controleer(), (e) => {
      assert.match(e.message, /wijken af van hun losse delen/);
      assert.match(e.message, /shared\/metgezel\.js/, 'en noemt de bundel bij naam');
      return true;
    }, 'een byte erbij hoort de meting te laten uitslaan');
  } finally {
    fs.writeFileSync(doel, echt);
  }

  assert.ok(fs.readFileSync(doel).equals(echt), 'en de proef zet het bestand terug zoals het stond');
  controleer();
});

test('de melding waarschuwt dat de build de bundel OVERSCHRIJFT', () => {
  /* De oude melding zei alleen "draai `npm run build`", en dat is precies de
     handeling die de nieuwste inhoud weggooit als de bundel de nieuwe kant
     was. Een foutmelding die je de verkeerde kant op stuurt, is erger dan
     geen foutmelding: hij komt op het moment dat je hem gelooft. */
  const naam = 'shared/metgezel.js';
  const doel = path.join(PUB, naam);
  const echt = fs.readFileSync(doel);
  let melding = '';
  try {
    fs.writeFileSync(doel, Buffer.concat([echt, Buffer.from('\n/* scheef */\n')]));
    try { controleer(); } catch (e) { melding = e.message; }
  } finally {
    fs.writeFileSync(doel, echt);
  }
  assert.match(melding, /overschrijft/i, 'de melding zegt dat de build de bundel overschrijft');
  assert.match(melding, /git diff/, 'en wijst naar de bundel-diff, zodat je ziet welke kant de nieuwe is');
});

test('elke bundel in de lijst heeft delen, en elke delenmap een bundel', () => {
  /* Een bundel die uit de lijst valt, valt ook uit controleer(): dan staan de
     delen er nog, wordt de bundel nooit meer bijgewerkt, en is de opgeknipte
     bron stil dood hout geworden. */
  for (const [uit, deelMap] of Object.entries(bundels)) {
    const dir = path.join(PUB, deelMap);
    assert.ok(fs.existsSync(dir), deelMap + ' bestaat als map met delen');
    const delen = fs.readdirSync(dir).filter((n) => n.endsWith('.js'));
    assert.ok(delen.length > 0, deelMap + ' heeft minstens een deel');
    assert.ok(fs.existsSync(path.join(PUB, uit)), uit + ' bestaat als bundel');
    assert.ok(bundel(uit).length > 0, uit + ' is niet leeg');
  }
});
