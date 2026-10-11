/* Het prikbord LEZEN laat niets achter (kern/genootschap/prikbord.js).

   `bord()` zette een lege rij neer voor een genootschap zonder prikbord, en elke
   weg gebruikte hem -- ook lezen, de AI-samenvatting en een stem of reactie op
   een bericht dat niet bestaat. Dezelfde fout die kern/genootschap/bijeenkomst.js
   al herstelde met lijstVan/kijkVan: daar ving de staatproef hem als een gezakte
   ROLLBACK, en zette de schorspoort de route dicht. Hier was hij nog open
   (GEMEENSCHAP-FASE0.md par. 6, gebrek 7).

   Alleen PLAATSEN mag een rij scheppen; elke andere weg kijkt.

   MUTATIE GEZIEN ZAKKEN: in prikbord.js `kijk` weer laten scheppen zoals `bord`
   -- toets 1 en 2 zakken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function opzet() {
  const staat = { groepen: [{ id: 7, naam: 'De Leesclub', leden: [{ key: 'a', rol: 'beheerder' }] }],
    prikbord: {}, bijeenkomst: {} };
  let bewaard = 0;
  const genootschap = {
    S: () => staat,
    groepMet: (id) => staat.groepen.find(g => String(g.id) === String(id)) || null,
    isLid: (gr, key) => (gr.leden || []).some(l => l.key === key),
    isBeheer: (gr, key) => (gr.leden || []).some(l => l.key === key && l.rol === 'beheerder'),
    publiek: (gr) => ({ id: gr.id, naam: gr.naam })
  };
  const prikbord = require('../server/kern/genootschap/prikbord.js')({
    db: { data: {} }, save: () => { bewaard++; }, codenaamVan: k => 'Codenaam-' + k,
    liveCodename: () => null, notify: null, genootschap });
  return { staat, prikbord, bewaard: () => bewaard };
}

const SESS = { key: 'a' };

test('1. lezen en de AI-regels scheppen geen prikbord', () => {
  const { staat, prikbord, bewaard } = opzet();
  const r = prikbord.lees(SESS, 7);
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.berichten, []);
  assert.deepEqual(prikbord.regels(7), []);
  assert.deepEqual(staat.prikbord, {}, 'lezen liet een lege rij achter');
  assert.equal(bewaard(), 0);
});

test('2. een stem, reactie of verwijdering op een bericht dat niet bestaat, laat niets achter', () => {
  const { staat, prikbord, bewaard } = opzet();
  assert.ok(prikbord.stem(SESS, 7, 123, 0).error);
  assert.ok(prikbord.reageer(SESS, 7, 123, 'hallo').error);
  assert.ok(prikbord.reactieWeg(SESS, 7, 123, 1).error);
  assert.ok(prikbord.weg(SESS, 7, 123).error);
  assert.deepEqual(staat.prikbord, {}, 'een mislukte opzoeking liet een lege rij achter');
  assert.equal(bewaard(), 0);
});

test('3. plaatsen schept de rij wel, en lezen ziet het bericht', () => {
  const { staat, prikbord } = opzet();
  const p = prikbord.plaats(SESS, 7, { tekst: 'Donderdag lezen we hoofdstuk drie.' });
  assert.ok(p.ok, p.error);
  assert.equal(staat.prikbord[7].length, 1);
  const r = prikbord.lees(SESS, 7);
  assert.equal(r.berichten.length, 1);
  assert.equal(prikbord.regels(7).length, 1);
  assert.ok(prikbord.stem(SESS, 7, r.berichten[0].id, 0).error, 'geen peiling, dus geen stem');
});
