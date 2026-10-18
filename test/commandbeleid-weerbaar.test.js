/* HET BELEIDSREGISTER VAN COMMAND (server/kern/command/beleid.js), op de randen.

   Het register beslist "mag dit, en hoeveel toezicht hoort erbij": de
   risicogrenzen, het geldplafond per agent, of runbooks zonder mens mogen
   draaien. Wie hier een regel kan zetten zonder naam, zonder reden of zonder
   tweede paar ogen, kan daarmee elke andere grendel van Command openzetten.

   Wat hier niet mag sneuvelen:
   1. zonder herleidbare actor wordt er niets gezet, goedgekeurd of teruggezet
      (403), en een onbekende regel of een ontbrekende reden zet ook niets;
   2. spoed slaat vier ogen alleen over met het zware recht: zonder die
      controle bestaat spoed niet, en een geweigerd recht laat de regel staan;
   3. een voorstel wordt één keer beslist: een tweede besluit is een 409, en
      een afwijzing laat de oude waarde live;
   4. terugzetten is een NIEUWE versie bovenop (het spoor blijft), en zonder
      vorige versie is er niets om naar terug te gaan;
   5. lezen schrijft niet: een waarde opvragen van een onbekende regel geeft
      de standaard en legt niets vast.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in zet() `if (!door) return {... 403}` weggehaald
     -> "1. zonder actor" ZAKT (RAAK)
   - in zet() de spoedcontrole `zwaar ? zwaar(...) : {403}` vervangen door
     `zwaar ? zwaar(...) : null` -> "2. spoed zonder zwaar recht" ZAKT (RAAK)
   - in keur() `if (v.status !== 'wacht')` vervangen door `if (false)`
     -> "3. een voorstel wordt één keer beslist" ZAKT (RAAK)

   Draai: node --test test/commandbeleid-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakBeleid } = require('../server/kern/command/beleid');

function maak(extra) {
  const vak = {}, regels = [];
  let saves = 0;
  const beleid = maakBeleid(Object.assign({ db: { data: {} }, save: () => { saves++; }, crypto,
    journaal: { noteer: (r) => regels.push(r) }, vak: () => vak }, extra || {}));
  return { beleid, vak, regels, saves: () => saves };
}

test('1. zonder actor, zonder reden of op een onbekende regel wordt er niets gezet', () => {
  const { beleid, regels } = maak();
  assert.equal(beleid.zet('bestaat.niet', 1, 'ops-a', 'een goede reden').status, 404);
  const r = beleid.zet('agent.actiesPerUur', 9999, '', 'een goede reden');
  assert.equal(r.status, 403);
  assert.match(r.error, /herleidbare actor/);
  assert.equal(beleid.zet('agent.actiesPerUur', 9999, 'ops-a', 'kor').status, 400);
  assert.equal(beleid.zet('agent.actiesPerUur', 9999, 'ops-a', '   ').status, 400);
  assert.equal(beleid.getal('agent.actiesPerUur'), 200, 'de waarde staat nog op de start');
  assert.equal(regels.length, 0, 'een weigering schrijft ook geen journaalregel');
});

test('1b. een regel zonder vier ogen gaat live, met bereik en journaal van oud naar nieuw', () => {
  const { beleid, regels, saves } = maak();
  const r = beleid.zet('herstel.maxPerRonde', 10, 'ops-a', 'kleiner na incident', 'NL');
  assert.deepEqual(r, { regel: 'herstel.maxPerRonde', waarde: 10, versie: 2 });
  const rij = beleid.alles().find(x => x.id === 'herstel.maxPerRonde');
  assert.equal(rij.bereik, 'NL');
  assert.equal(rij.door, 'ops-a');
  assert.equal(saves(), 1);
  assert.deepEqual([regels[0].voor, regels[0].na], [{ waarde: 50, versie: 1 }, { waarde: 10, versie: 2 }]);
  assert.equal(regels[0].actie, 'beleid zetten');
});

test('2. spoed zonder zware controle bestaat niet; met een geweigerd recht blijft de regel staan', () => {
  const kaal = maak();
  const r = kaal.beleid.zet('risico.autoGrens', 90, 'ops-a', 'met spoed omhoog', null, true);
  assert.equal(r.status, 403);
  assert.match(r.error, /Spoed bestaat hier niet/);
  assert.equal(kaal.beleid.getal('risico.autoGrens'), 30);

  const gevraagd = [];
  const nee = maak({ zwaar: (door, wat) => { gevraagd.push([door, wat]); return { status: 403, error: 'geen zwaar recht' }; } });
  assert.deepEqual(nee.beleid.zet('risico.autoGrens', 90, 'ops-a', 'met spoed omhoog', null, true), { status: 403, error: 'geen zwaar recht' });
  assert.deepEqual(gevraagd, [['ops-a', 'beleid-spoed']]);
  assert.equal(nee.beleid.getal('risico.autoGrens'), 30);

  const ja = maak({ zwaar: () => null });
  const z = ja.beleid.zet('risico.autoGrens', 40, 'ops-a', 'met spoed omhoog', null, true);
  assert.equal(z.versie, 2);
  assert.equal(ja.beleid.getal('risico.autoGrens'), 40);
  assert.equal(ja.regels[0].actie, 'beleid zetten met spoed');
  assert.equal(ja.beleid.openVoorstellen().length, 0, 'spoed met recht maakt geen voorstel');
});

test('3. een voorstel wordt één keer beslist, en een afwijzing laat de oude waarde live', () => {
  const { beleid, regels } = maak();
  const { voorstel } = beleid.zet('risico.mensGrens', 95, 'ops-a', 'grens verruimen', 'BE');
  assert.equal(voorstel.bereik, 'BE');
  assert.equal(beleid.keur('onbekend', 'ops-b', true).status, 404);
  assert.equal(beleid.keur(voorstel.id, '', true).status, 403);
  assert.equal(beleid.keur(voorstel.id, 'ops-a', true).status, 403, 'wie voorstelt keurt niet zelf');
  const af = beleid.keur(voorstel.id, 'ops-b', false);
  assert.equal(af.uitkomst, null);
  assert.equal(af.voorstel.status, 'afgewezen');
  assert.equal(af.voorstel.tweedeReden, '');
  assert.equal(beleid.getal('risico.mensGrens'), 70, 'afgewezen: de oude waarde blijft live');
  const laatste = regels[regels.length - 1];
  assert.equal(laatste.actie, 'beleid afwijzen');
  assert.equal(laatste.reden, 'grens verruimen', 'zonder eigen reden draagt de afwijzing de reden van het voorstel');
  assert.deepEqual(laatste.na, { waarde: 70 });
  const nogEens = beleid.keur(voorstel.id, 'ops-c', true);
  assert.equal(nogEens.status, 409);
  assert.match(nogEens.error, /afgewezen/);
  assert.equal(beleid.getal('risico.mensGrens'), 70, 'een tweede besluit zet hem alsnog niet live');
});

test('3b. goedkeuren zet het voorstel live met beide namen en het voorgestelde bereik', () => {
  const { beleid } = maak();
  const { voorstel } = beleid.zet('foundation.deelPromille', 310, 'ops-a', 'meer naar de foundation', 'NL');
  const ja = beleid.keur(voorstel.id, 'ops-b', true, 'akkoord');
  assert.deepEqual(ja.uitkomst, { regel: 'foundation.deelPromille', waarde: 310, versie: 2 });
  const rij = beleid.alles().find(x => x.id === 'foundation.deelPromille');
  assert.equal(rij.door, 'ops-a + ops-b');
  assert.equal(rij.bereik, 'NL');
  assert.equal(beleid.openVoorstellen().length, 0);
});

test('4. terugzetten is een nieuwe versie bovenop; zonder vorige versie of actor gebeurt niets', () => {
  const { beleid, regels } = maak();
  assert.equal(beleid.terug('bestaat.niet', 'ops-a').status, 404);
  assert.equal(beleid.terug('zaak.termijnUren', 'ops-a').status, 409);
  beleid.zet('zaak.termijnUren', 24, 'ops-a', 'sneller beslissen');
  assert.equal(beleid.terug('zaak.termijnUren', '').status, 403);
  assert.equal(beleid.getal('zaak.termijnUren'), 24, 'een geweigerde terugzet laat de waarde staan');
  const t = beleid.terug('zaak.termijnUren', 'ops-b');
  assert.deepEqual(t, { regel: 'zaak.termijnUren', waarde: 48, versie: 3, terugNaar: 1 });
  const g = beleid.geschiedenis('zaak.termijnUren');
  assert.deepEqual(g.versies.map(v => v.waarde), [48, 24, 48], 'de fout blijft in het spoor staan');
  assert.equal(g.versies[0].reden, 'terug naar versie 1');
  assert.equal(regels[regels.length - 1].reden, 'terug naar versie 1');
  assert.equal(beleid.geschiedenis('bestaat.niet').status, 404);
});

test('5. lezen schrijft niet; een onleesbare of onbekende waarde valt terug op de standaard', () => {
  const { beleid, vak } = maak();
  assert.equal(beleid.waarde('bestaat.niet', 'std'), 'std');
  assert.equal(beleid.getal('bestaat.niet', 7), 7);
  assert.equal(vak.commandBeleid, undefined, 'een opvraging legt niets vast');
  vak.commandBeleid = { 'agent.actiesPerUur': { id: 'agent.actiesPerUur', wat: 'x', eenheid: 'stuks', vierOgen: false,
    versies: [{ v: 1, waarde: 'veel', at: null, door: 'oud' }] } };
  assert.equal(beleid.getal('agent.actiesPerUur', 200), 200, 'een niet-getal telt niet als grens');
  assert.equal(beleid.alles().find(x => x.id === 'agent.actiesPerUur').bereik, 'globaal', 'opslag zonder bereik is globaal');
});
