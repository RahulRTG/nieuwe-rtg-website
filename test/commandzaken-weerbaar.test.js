/* DE UITZONDERINGSRIJ VAN COMMAND (kern/command/zaken.js).

   Wat de machine niet zelf mag doen, wordt een ZAAK voor een mens: met een
   eigenaar, een termijn uit het beleid en een besluit met reden. Wie een zaak
   kan oppakken of afsluiten zonder naam, of een afgehandelde zaak opnieuw kan
   openbreken, maakt van het spoor van menselijke besluiten een lijst die
   niemand meer kan navertellen.

   Wat hier niet mag sneuvelen:
   1. oppakken en besluiten vragen een bestaande zaak en een medewerker op
      naam; een afgehandelde zaak gaat niet opnieuw open (409), ook niet door
      haar op te pakken;
   2. een besluit zonder keuze of zonder reden zet niets;
   3. de termijn komt uit het beleid, en een te laat besluit heet ook zo
      (opTijd false) -- de tellingen zien wie over de termijn is en wie zonder
      eigenaar;
   4. een zaak zonder gegevens krijgt eerlijke standaarden (geen lege titel,
      oorzaak "onbekend"), en het journaal noemt de opener;
   5. filteren op domein, eigenaar en oorzaak; leerpunten tellen pas vanaf de
      drempel, het vaakst eerst.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in neem() `if (z.status === KLAAR) return {... 409}` weggehaald
     -> "1. oppakken en besluiten" ZAKT (RAAK)
   - in besluit() `opTijd: nu() <= z.termijn` vervangen door `opTijd: true`
     -> "3. de termijn komt uit het beleid" ZAKT (RAAK)

   Draai: node --test test/commandzaken-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakZaken, BEZIG, KLAAR } = require('../server/kern/command/zaken');

function maak(termijnUren) {
  const vak = {}, regels = [];
  const z = maakZaken({ save: () => {}, crypto, journaal: { noteer: r => regels.push(r) }, vak: () => vak,
    beleid: { getal: (id, std) => (id === 'zaak.termijnUren' && termijnUren != null ? termijnUren : std) } });
  return { z, vak, regels };
}

test('1. oppakken en besluiten vragen een zaak en een naam; afgehandeld blijft afgehandeld', () => {
  const { z, regels } = maak();
  const zaak = z.open({ titel: 'Terugbetaling boven grens', domein: 'betalen', oorzaak: 'geld-grens', door: 'agent-7' });
  assert.equal(z.neem('onbekend', 'mw-a').status, 404);
  assert.equal(z.neem(zaak.id, '').status, 403);
  assert.equal(z.besluit('onbekend', 'mw-a', 'terugbetalen', 'klopt zo').status, 404);
  assert.equal(z.besluit(zaak.id, '', 'terugbetalen', 'klopt zo').status, 403);
  assert.equal(zaak.eigenaar, null, 'een geweigerde actie wijst geen eigenaar toe');
  const genomen = z.neem(zaak.id, 'mw-a');
  assert.equal(genomen.zaak.status, BEZIG);
  assert.equal(regels[regels.length - 1].actie, 'zaak oppakken');
  assert.deepEqual(regels[regels.length - 1].voor, { eigenaar: null, status: 'open' });
  z.besluit(zaak.id, 'mw-a', 'terugbetalen', 'bon gecontroleerd');
  const nogEens = z.neem(zaak.id, 'mw-b');
  assert.equal(nogEens.status, 409);
  assert.equal(zaak.eigenaar, 'mw-a', 'oppakken breekt een afgehandelde zaak niet open');
  assert.equal(z.besluit(zaak.id, 'mw-b', 'weigeren', 'toch niet').status, 409);
  assert.equal(zaak.besluit.keuze, 'terugbetalen');
});

test('2. een besluit zonder keuze of reden zet niets', () => {
  const { z } = maak();
  const zaak = z.open({ titel: 't' });
  assert.equal(z.besluit(zaak.id, 'mw-a', '', 'goede reden').status, 400);
  assert.equal(z.besluit(zaak.id, 'mw-a', 'ja', 'nee').status, 400);
  assert.equal(z.besluit(zaak.id, 'mw-a', 'ja').status, 400);
  assert.equal(zaak.status, 'open');
  assert.equal(zaak.besluit, null);
});

test('3. de termijn komt uit het beleid, en een te laat besluit heet zo', () => {
  const { z } = maak(-1);
  const laat = z.open({ titel: 'te laat', oorzaak: 'x' });
  const open = z.open({ titel: 'nog open', eigenaar: 'mw-c' });
  z.open({ titel: 'wees' });
  assert.ok(Date.parse(laat.termijn) < Date.now(), 'een termijn van -1 uur ligt al achter ons');
  let t = z.tellingen();
  assert.deepEqual([t.totaal, t.open, t.zonderEigenaar, t.overTermijn, t.bezig], [3, 3, 2, 3, 0]);
  z.neem(open.id, 'mw-c');
  const b = z.besluit(laat.id, 'mw-a', 'goedkeuren', 'na controle');
  assert.equal(b.zaak.besluit.opTijd, false);
  t = z.tellingen();
  assert.deepEqual([t.afgehandeld, t.opTijdAfgehandeld, t.bezig, t.open], [1, 0, 1, 2]);
  const ruim = maak(48);
  const z2 = ruim.z.open({ titel: 'ruim' });
  assert.ok(Math.abs(Date.parse(z2.termijn) - Date.parse(z2.at) - 48 * 3600000) < 1000);
  ruim.z.besluit(z2.id, 'mw-a', 'ok', 'op tijd');
  assert.equal(ruim.z.tellingen().opTijdAfgehandeld, 1);
});

test('4. een kale zaak krijgt eerlijke standaarden, en het journaal noemt de opener', () => {
  const { z, regels } = maak();
  const zaak = z.open({ objectId: 0, risico: 0 });
  assert.deepEqual([zaak.titel, zaak.domein, zaak.oorzaak, zaak.bron, zaak.eigenaar, zaak.objectId, zaak.risico],
    ['Uitzondering', 'overig', 'onbekend', 'command', null, '0', 0]);
  assert.deepEqual(zaak.stappen[0].door, 'command');
  assert.deepEqual([regels[0].actor, regels[0].niveau, regels[0].reden], ['command', 'auto', 'onbekend']);
  const vol = z.open({ titel: 'x', door: 'agent-1', niveau: 'assist', reden: 'te hoog risico', eigenaar: 'mw-a' });
  assert.deepEqual([regels[1].actor, regels[1].niveau, regels[1].reden], ['agent-1', 'assist', 'te hoog risico']);
  assert.equal(vol.eigenaar, 'mw-a');
  assert.equal(z.vind(vol.id), vol);
  assert.equal(z.vind('weg'), null);
});

test('5. filteren, en leerpunten pas vanaf de drempel', () => {
  const { z } = maak();
  const maakEnSluit = (oorzaak, keuze, domein) => {
    const x = z.open({ titel: oorzaak, oorzaak, domein });
    z.neem(x.id, 'mw-a');
    z.besluit(x.id, 'mw-a', keuze, 'zelfde uitkomst');
    return x;
  };
  for (let i = 0; i < 4; i++) maakEnSluit('dubbele-boeking', 'terugdraaien', i % 2 ? 'reizen' : 'betalen');
  for (let i = 0; i < 3; i++) maakEnSluit('adres-onvolledig', 'aanvullen', 'leden');
  maakEnSluit('zeldzaam', 'iets', 'leden');
  z.open({ titel: 'open', oorzaak: 'dubbele-boeking', domein: 'reizen' });
  assert.equal(z.lijst({ domein: 'reizen' }).length, 3);
  assert.equal(z.lijst({ oorzaak: 'adres-onvolledig' }).length, 3);
  assert.equal(z.lijst({ eigenaar: 'mw-a', status: KLAAR }).length, 8);
  assert.equal(z.lijst({ max: 2 }).length, 2);
  assert.equal(z.lijst().length, 9);
  const l = z.leerpunten();
  assert.deepEqual(l.map(g => [g.oorzaak, g.aantal]), [['dubbele-boeking', 4], ['adres-onvolledig', 3]]);
  assert.deepEqual(l[0].domeinen.sort(), ['betalen', 'reizen']);
  assert.equal(l[0].voorbeelden.length, 3, 'hooguit drie voorbeelden');
  assert.equal(z.leerpunten(4).length, 1);
  assert.equal(z.leerpunten(1).length, 3);
});
