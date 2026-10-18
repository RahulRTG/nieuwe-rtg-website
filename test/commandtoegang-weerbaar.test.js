/* DE ZWARE RECHTEN VAN COMMAND (kern/command/toegang.js) op hun randen,
   aanvulling op test/command-zware-rechten.test.js.

   Daar staat per recht dat de poort echt iets opent en sluit. Hier staan de
   weigeringen rond geven, intrekken en de rechtengraaf: wie zonder naam, zonder
   reden of op een onbekend recht iets probeert, en of de graaf bij een audit
   eerlijk zegt wat er nu openstaat.

   Wat hier niet mag sneuvelen:
   1. een onbekend recht, geen ontvanger of geen reden geeft niets; een
      gevraagde duur boven het maximum wordt afgekapt op het maximum;
   2. de nooddeur kent alleen de vijf zware rechten;
   3. intrekken vraagt een bestaand recht en een actor, en gebeurt één keer:
      een tweede intrekking is een 409 en verschuift het einde niet;
   4. wat iemand nu heeft (vanWie) en de graaf tellen alleen levende rechten:
      een ingetrokken of verlopen recht staat bij "verlopen", en een lege
      graaf zegt met zoveel woorden dat dat de rusttoestand is.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in geef() `Math.min(..., r.maxMinuten)` weggehaald
     -> "1. een onbekend recht ... afgekapt" ZAKT (RAAK)
   - in trekIn() `if (item.ingetrokken) return {... 409}` weggehaald
     -> "3. intrekken gebeurt één keer" ZAKT (RAAK)
   - in vanWie() `&& !x.ingetrokken` weggehaald
     -> "4. alleen levende rechten" ZAKT (RAAK)

   Draai: node --test test/commandtoegang-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakToegang } = require('../server/kern/command/toegang');
const maakCmdOpslag = require('../server/kern/command/opslag');

function maak() {
  const regels = [];
  const t = maakToegang({ opslag: maakCmdOpslag({ db: { data: {} } }), save: () => {}, crypto,
    journaal: { noteer: r => regels.push(r) } });
  return { t, regels };
}

test('1. onbekend recht, geen ontvanger of geen reden: niets; te lang wordt het maximum', () => {
  const { t, regels } = maak();
  assert.equal(t.geef('alles-mag', 'mw-b', 'mw-a', 'goede reden').status, 404);
  const zonder = t.geef('kluis-inzage', '', 'mw-a', 'goede reden');
  assert.deepEqual([zonder.status, zonder.error], [400, 'Aan wie?']);
  assert.equal(t.geef('kluis-inzage', 'mw-b', 'mw-a', 'kor').status, 400);
  assert.equal(t.geef('kluis-inzage', 'mw-b', 'mw-a').status, 400);
  assert.equal(regels.length, 0);
  assert.equal(t.open().length, 0);
  const lang = t.geef('massamutatie', 'mw-b', 'mw-a', 'grote correctie', 600);
  assert.equal(lang.recht.minuten, 30, 'nooit langer dan het maximum van het recht');
  const std = t.geef('agent-ontgrendelen', 'mw-b', 'mw-a', 'agent hervatten');
  assert.equal(std.recht.minuten, 120, 'zonder duur: het maximum');
  assert.equal(t.vereist('mw-b', 'massamutatie'), null);
});

test('2. de nooddeur kent alleen de vijf zware rechten', () => {
  const { t } = maak();
  const r = t.breekGlas('root', 'mw-a', 'de hele zaak ligt plat, nu');
  assert.equal(r.status, 404);
  assert.match(r.error, /bestaat niet: root/);
  assert.equal(t.open().length, 0);
});

test('3. intrekken vraagt een bestaand recht en een actor, en gebeurt een keer', () => {
  const { t, regels } = maak();
  const { recht } = t.geef('kluis-inzage', 'mw-b', 'mw-a', 'KYC-controle');
  assert.equal(t.trekIn('onbekend', 'mw-a').status, 404);
  assert.equal(t.trekIn(recht.id, '').status, 403);
  assert.equal(t.vereist('mw-b', 'kluis-inzage'), null, 'een geweigerde intrekking laat het recht staan');
  const weg = t.trekIn(recht.id, 'mw-a');
  assert.equal(weg.recht.ingetrokken, true);
  assert.equal(weg.recht.introkDoor, 'mw-a');
  assert.equal(regels[regels.length - 1].reden, 'niet meer nodig');
  const tot = weg.recht.tot;
  const nog = t.trekIn(recht.id, 'mw-c', 'nog eens');
  assert.equal(nog.status, 409);
  assert.equal(t.open().length, 0);
  assert.equal(recht.tot, tot, 'een tweede intrekking verschuift het einde niet');
  assert.equal(t.vereist('mw-b', 'kluis-inzage').status, 403);
});

test('4. vanWie en de graaf tellen alleen levende rechten', () => {
  const { t } = maak();
  const leeg = t.graaf();
  assert.match(leeg.uitleg, /bedoelde rusttoestand/);
  assert.deepEqual([leeg.nood, leeg.verlopen, leeg.actief.length], [0, 0, 0]);
  const a = t.geef('kluis-inzage', 'mw-b', 'mw-a', 'KYC-controle').recht;
  const b = t.geef('herstel-forceren', 'mw-b', 'mw-a', 'storing herstellen').recht;
  t.breekGlas('massamutatie', 'mw-c', 'calamiteit: alles ligt plat');
  t.trekIn(a.id, 'mw-a', 'klaar');
  b.tot = new Date(Date.now() - 1000).toISOString();
  assert.deepEqual(t.vanWie('mw-b'), [], 'ingetrokken en verlopen tellen niet');
  // de vlag is het gezag, niet het einde: een ingetrokken rij met een einde in de toekomst telt ook niet
  a.tot = new Date(Date.now() + 3600000).toISOString();
  assert.deepEqual(t.vanWie('mw-b'), []);
  assert.equal(t.geldig('mw-b', 'kluis-inzage'), false);
  assert.deepEqual(t.vanWie('mw-c').map(x => x.recht), ['massamutatie']);
  const g = t.graaf();
  assert.equal(g.uitleg, null);
  assert.equal(g.nood, 1);
  assert.equal(g.verlopen, 2);
  assert.deepEqual(g.actief.map(x => [x.recht, x.aan, x.nood]), [['massamutatie', 'mw-c', true]]);
  assert.equal(g.soorten.find(s => s.id === 'massamutatie').nuActief, 1);
  assert.equal(g.soorten.find(s => s.id === 'kluis-inzage').nuActief, 0);
});
