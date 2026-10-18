/* DE UITROL-CANARY VAN COMMAND op zijn randen (kern/command/canary.js),
   aanvulling op test/canary.test.js.

   De canary zet een functie voor een deel van de mensen open en rolt hem
   vanzelf terug als de serverfouten over de drempel gaan. Daar hoort bij: een
   journaal dat omvalt mag de terugrol niet tegenhouden, een functie die alleen
   voor iedereen tegelijk kan, krijgt geen canary, en een handmatige terugrol
   moet als handwerk in het journaal staan en niet als automaat.

   Wat hier niet mag sneuvelen:
   1. een alleen-globale functie krijgt geen canary (409); een deel buiten
      0..1 wordt begrensd; zonder deel geldt de standaard;
   2. verbreden, terugrollen en afronden zonder lopende canary is een 404 --
      ook op een onbekende functie, en zonder iets aan de schakelkast te doen;
   3. een journaal dat gooit, of helemaal geen journaal, houdt de automatische
      terugrol niet tegen;
   4. een handmatige terugrol heet "hand" met de naam van de mens, de
      automatische "auto" met de automaat; verbreden naar 0 houdt hem
      teruggerold;
   5. een canary zonder nulmeting, of een stand van een functie die niet meer
      bestaat, wordt niet gewogen als iets dat loopt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in start() `if (f.alleenGlobaal) return {...409}` weggehaald
     -> "1. een alleen-globale functie" ZAKT (RAAK)
   - in noteer() de try/catch weggehaald
     -> "3. een journaal dat gooit" ZAKT (RAAK): de weging gooit
   - in terug() `automatisch ? NIVEAUS.auto : NIVEAUS.hand` vervangen door
     `NIVEAUS.auto` -> "4. handmatig heet hand" ZAKT (RAAK)

   Draai: node --test test/canary-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakCanary, STANDAARD } = require('../server/kern/command/canary');
const maakCmdOpslag = require('../server/kern/command/opslag');

function maak(o) {
  o = o || {};
  const tel = { a: 0, f: 0 };
  const meting = { zet: (a, f) => { tel.a = a; tel.f = f; }, reeksen: () => ({ verzoeken: [
    { route: '/api/proef/x', status: '2xx', aantal: tel.a - tel.f }, { route: '/api/proef', status: '5xx', aantal: tel.f }] }) };
  const db = { data: { techniek: { functies: {} } } };
  const regels = [];
  const journaal = o.journaal !== undefined ? o.journaal : { noteer: r => regels.push(r) };
  const OP_ID = { proef: { id: 'proef', naam: 'Proef', categorie: 'T', paden: ['/api/proef'] },
    globaal: { id: 'globaal', naam: 'G', categorie: 'T', paden: ['/api/g'], alleenGlobaal: true } };
  const canary = maakCanary({ opslag: maakCmdOpslag({ db }), save: () => {}, meting, journaal,
    functies: o.zonderFuncties ? undefined : { OP_ID } });
  return { canary, meting, db, regels, kast: db.data.techniek.functies };
}

test('1. alleen-globaal krijgt geen canary; het deel wordt begrensd', () => {
  const { canary, kast } = maak();
  const g = canary.start('globaal', 0.1, { door: 'mw-a' });
  assert.equal(g.status, 409);
  assert.equal(kast.globaal, undefined, 'de schakelkast blijft onaangeroerd');
  assert.equal(canary.start('proef', 7, { door: 'mw-a' }).canary.deel, 1);
  assert.equal(canary.start('proef', -3, { door: 'mw-a' }).canary.deel, 0);
  const std = canary.start('proef');
  assert.deepEqual([std.canary.deel, std.canary.door, std.canary.drempel, std.canary.minimum],
    [STANDAARD.deel, 'onbekend', STANDAARD.drempel, STANDAARD.minimum]);
  assert.equal(maak({ zonderFuncties: true }).canary.start('proef', 0.1).status, 404, 'zonder functielijst bestaat niets');
});

test('2. zonder lopende canary: 404 op verbreden, terugrollen en afronden', () => {
  const { canary, kast } = maak();
  for (const id of ['proef', 'bestaat-niet']) {
    assert.equal(canary.breder(id, 0.5, 'mw-a').status, 404);
    assert.equal(canary.terug(id, 'r', 'mw-a').status, 404);
    assert.equal(canary.af(id, 'mw-a').status, 404);
  }
  kast.proef = { aan: true };
  assert.equal(canary.breder('proef', 0.5, 'mw-a').status, 404, 'een stand zonder canary is geen canary');
  assert.deepEqual(kast.proef, { aan: true });
});

test('3. een journaal dat gooit of ontbreekt houdt de automatische terugrol niet tegen', () => {
  for (const journaal of [null, { noteer: () => { throw new Error('schijf vol'); } }]) {
    const { canary, meting, kast } = maak({ journaal });
    canary.start('proef', 0.1, { door: 'mw-a', minimum: 10, drempel: 0.05 });
    meting.zet(100, 30);
    assert.deepEqual(canary.weeg(), ['proef']);
    assert.equal(kast.proef.canary.stand, 'teruggerold');
    assert.equal(kast.proef.canary.deel, 0);
    assert.match(kast.proef.canary.reden, /^automaat: 30% serverfouten op 100 antwoorden, drempel 5%/);
  }
});

test('4. handmatig heet hand met de mens erbij; verbreden naar 0 blijft teruggerold', () => {
  const { canary, regels } = maak();
  canary.start('proef', 0.2, { door: 'mw-a' });
  const t = canary.terug('proef', '', 'mw-b');
  assert.equal(t.canary.reden, 'met de hand teruggerold');
  assert.equal(t.canary.automatisch, false);
  const r = regels[regels.length - 1];
  assert.deepEqual([r.actor, r.niveau, r.uitslag], ['mw-b', 'hand', 'gedaan']);
  assert.equal(canary.breder('proef', 0, 'mw-b').canary.stand, 'teruggerold');
  assert.equal(canary.breder('proef', 0.3, 'mw-b').canary.stand, 'loopt');
  assert.equal(canary.stand().tel.lopend, 1);
});

test('5. zonder nulmeting of voor een verdwenen functie wordt niets gewogen als lopend', () => {
  const { canary, meting, kast } = maak();
  meting.zet(80, 4);
  kast.proef = { canary: { deel: 0.5, stand: 'loopt', drempel: 0.02, minimum: 50 } };
  kast.weg = { canary: { deel: 0.5, stand: 'loopt', drempel: 0.02, minimum: 50 } };
  kast.leeg = null;
  const l = canary.lopende();
  assert.deepEqual(l.map(k => k.id), ['proef'], 'een verdwenen functie staat niet in de lijst');
  assert.deepEqual([l[0].meting.antwoorden, l[0].meting.fouten, l[0].oordeel], [80, 4, 'over de drempel']);
  assert.match(l[0].let, /anoniem verkeer/);
});
