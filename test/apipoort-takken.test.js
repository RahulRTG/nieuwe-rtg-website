/* DE API-POORT VAN COMMAND op zijn randen (kern/command/apipoort.js,
   apipoort-controle.js en apipoort-levensduur.js), aanvulling op
   test/apipoort.test.js en test/apipoort-levensduur.test.js.

   De poort geeft machinesleutels uit voor koppelingen van buiten. Elke tak
   hieronder is een plek waar een halve of rare invoer de poort zou kunnen
   openzetten of een sleutel stil zou laten doorleven.

   Wat hier niet mag sneuvelen:
   1. de sleutellijst is begrensd: bij het maximum komt er geen bij, ook niet
      als er ingetrokken sleutels tussen staan;
   2. scopes die geen lijst zijn, of een scope zonder pad, geven geen sleutel;
      een scope zonder methoden krijgt GET en POST en niet "alles";
   3. de controle weigert een ontbrekende sleutel (401) en een ontbrekend pad
      (403), en een ontbrekende methode telt als GET -- niet als vrijbrief;
   4. roteren zonder naam wordt geweigerd EN laat de oude sleutel werken (geen
      gat zonder sleutel); roteren op naam trekt de oude in en noemt de nieuwe;
   5. intrekken van een onbekende sleutel is een 404; een toelating zonder
      pad of buiten /api/ komt er niet in.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in maak() `>= MAX_SLEUTELS` vervangen door `> MAX_SLEUTELS`
     -> "1. de sleutellijst is begrensd" ZAKT (RAAK)
   - in de controle `String(methode || 'GET')` vervangen door
     `String(methode || 'POST')` -> "3. de controle" ZAKT (RAAK)

   Draai: node --test test/apipoort-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakApiPoort } = require('../server/kern/command/apipoort');
const maakCmdOpslag = require('../server/kern/command/opslag');

function maak() {
  const db = { data: {} }, regels = [];
  const poort = maakApiPoort({ db, opslag: maakCmdOpslag({ db }), save: () => {}, crypto,
    journaal: { noteer: r => regels.push(r) } });
  poort.laatToe('/api/extern/aanbod', null, 'mw-a');
  return { poort, regels };
}

test('1. bij het maximum komt er geen sleutel bij, ook niet na intrekken', () => {
  const { poort } = maak();
  let eerste = null;
  for (let i = 0; i < 50; i++) {
    const r = poort.maak('k' + i, [{ pad: '/api/extern/aanbod' }], { door: 'mw-a' });
    assert.ok(r.sleutel, JSON.stringify(r));
    if (!eerste) eerste = r.sleutel.id;
  }
  poort.trekIn(eerste, 'mw-a', 'opruimen');
  const te = poort.maak('nog een', [{ pad: '/api/extern/aanbod' }], { door: 'mw-a' });
  assert.equal(te.status, 409);
  assert.match(te.error, /al 50 sleutels/);
  assert.equal(poort.stand().tel.sleutels, 50);
});

test('2. geen lijst of geen pad: geen sleutel; geen methoden: GET en POST', () => {
  const { poort } = maak();
  assert.equal(poort.maak('x', 'alles', { door: 'mw-a' }).status, 400);
  assert.equal(poort.maak('x', [{ pad: '/api/extern/aanbod' }]).status, 403, 'zonder opties: niet op naam, geen sleutel');
  const zonderPad = poort.maak('x', [{ methoden: ['GET'] }], { door: 'mw-a' });
  assert.equal(zonderPad.status, 403);
  assert.equal(poort.stand().tel.sleutels, 0);
  const r = poort.maak(null, [{ pad: '/api/extern/aanbod', methoden: [] }], { door: 'mw-a' });
  assert.deepEqual(r.sleutel.scopes[0].methoden, ['GET', 'POST']);
  assert.equal(r.sleutel.naam, 'sleutel ' + r.sleutel.id);
  assert.equal(r.sleutel.eigenaar, null, 'geen eigenaar is null, geen lege naam');
  const t = poort.stand().toelating[0];
  assert.deepEqual([t.versie, t.uitfasering, t.waarvoor], ['v1', null, ''], 'een toelating zonder opties');
});

test('3. de controle: geen sleutel 401, geen pad 403, geen methode is GET', () => {
  const { poort } = maak();
  const leesSleutel = poort.maak('lezer', [{ pad: '/api/extern/aanbod', methoden: ['GET'] }], { door: 'mw-a' }).geheim;
  const schrijfSleutel = poort.maak('schrijver', [{ pad: '/api/extern/aanbod', methoden: ['POST'] }], { door: 'mw-a' }).geheim;
  assert.deepEqual([poort.apiSleutelOk(undefined, '/api/extern/aanbod', 'GET').status], [401]);
  assert.equal(poort.apiSleutelOk(leesSleutel, undefined, 'GET').status, 403);
  assert.equal(poort.apiSleutelOk(leesSleutel, '/api/extern/aanbod').ok, true, 'zonder methode: GET');
  const s = poort.apiSleutelOk(schrijfSleutel, '/api/extern/aanbod');
  assert.deepEqual([s.ok, s.status, s.reden], [false, 403, 'buiten de scope van deze sleutel']);
});

test('4. roteren zonder naam laat de oude werken; op naam trekt het de oude in', () => {
  const { poort, regels } = maak();
  const oud = poort.maak('k', [{ pad: '/api/extern/aanbod', methoden: ['GET'] }], { door: 'mw-a' });
  const nee = poort.roteer(oud.sleutel.id);
  assert.equal(nee.status, 403);
  assert.equal(poort.apiSleutelOk(oud.geheim, '/api/extern/aanbod', 'GET').ok, true, 'geen gat zonder sleutel');
  const ja = poort.roteer(oud.sleutel.id, { door: 'mw-b' });
  assert.equal(ja.vorige.ingetrokken.door, 'mw-b');
  assert.equal(ja.vorige.ingetrokken.reden, 'geroteerd naar ' + ja.sleutel.id);
  assert.equal(poort.apiSleutelOk(oud.geheim, '/api/extern/aanbod', 'GET').reden, 'deze sleutel is ingetrokken');
  assert.equal(poort.apiSleutelOk(ja.geheim, '/api/extern/aanbod', 'GET').ok, true);
  const r = regels.find(x => x.actie === 'api-sleutel geroteerd');
  assert.deepEqual([r.objectId, r.reden, r.actor], [oud.sleutel.id, ja.sleutel.id, 'mw-b']);
});

test('5. onbekende sleutel intrekken is 404; een toelating zonder pad komt er niet in', () => {
  const { poort, regels } = maak();
  assert.equal(poort.trekIn('onbekend', 'mw-a').status, 404);
  const k = poort.maak('k', [{ pad: '/api/extern/aanbod' }], { door: 'mw-a' });
  const weg = poort.trekIn(k.sleutel.id);
  assert.deepEqual(weg.sleutel.ingetrokken.door, '');
  assert.equal(regels[regels.length - 1].reden, '');
  assert.equal(poort.laatToe(undefined, {}, 'mw-a').status, 400);
  assert.equal(poort.laatToe('  /extern/iets ', {}, 'mw-a').status, 400);
  assert.equal(poort.stand().toelating.length, 1);
});
