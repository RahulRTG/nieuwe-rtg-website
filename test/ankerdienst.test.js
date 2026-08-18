/* DE ANKERDIENST -- het ene getal dat naar buiten moet.

   De hashketen ziet gesleutel MIDDEN in een spoor. Wat hij NIET ziet is
   kopafknipping: wie de nieuwste regels weggooit, houdt een keten over die van
   voor naar achter perfect klopt. Dat is precies wat iemand doet die zijn eigen
   bezoek wil uitwissen.

   De zwaarste toets van dit bestand is daarom niet dat het anker werkt, maar
   dat de dienst NIET groen zegt zolang er geen blok naar buiten is gebracht.
   Een anker dat nergens buiten staat bewijst niets, en code die dan toch "in
   bedrijf" toont is erger dan geen anker -- het is een gerustheid zonder grond.

   Draai los: node --test test/ankerdienst.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maakAnkerdienst } = require('../server/lib/ankerdienst');
const keten = require('../server/lib/keten');

function maak() {
  const db = { data: { inzageLog: [], securityLog: [], handelingLog: [],
    livingLab: { audit: [] }, ledenBoardLog: {} } };
  let t = Date.parse('2026-08-18T10:00:00.000Z');
  const dienst = maakAnkerdienst({ db, nu: () => t });
  return { dienst, db, verzet: (ms) => { t += ms; } };
}

const vul = (rij, n, wat) => { for (let i = 0; i < n; i++) keten.noteerIn(rij, { wat: wat + i }, 1000); };

test('zonder blok naar buiten staat de dienst op NIET IN BEDRIJF', () => {
  const o = maak();
  vul(o.db.data.securityLog, 5, 'inlog');

  const s = o.dienst.stand(null);
  assert.equal(s.inBedrijf, false, 'een anker dat nergens buiten staat, bewijst niets');
  assert.match(s.uitleg, /gescheiden plek/i);
  assert.ok(s.blok, 'maar het blok om weg te zetten ligt er wel klaar');
});

test('het blok draagt een punt per journaal, met een zegel over het geheel', () => {
  const o = maak();
  vul(o.db.data.securityLog, 3, 'inlog');
  vul(o.db.data.handelingLog, 4, 'handeling');

  const b = o.dienst.blok();
  assert.ok(b.zegel, 'een zegel over het geheel');
  assert.equal(b.punten.securityLog.nr, 3);
  assert.equal(b.punten.handelingLog.nr, 4);
  assert.equal(b.punten.inzageLog, null, 'een leeg journaal heeft geen punt, en dat is geen fout');
});

/* ---------------------------------------------------------------------------
   WAAR HET OM BEGONNEN IS: KOPAFKNIPPING.
   ------------------------------------------------------------------------- */

test('de nieuwste regels wegknippen valt op tegen een eerder blok', () => {
  const o = maak();
  vul(o.db.data.securityLog, 10, 'inlog');
  const buiten = o.dienst.blok();            // dit blok staat nu ergens anders

  // de keten zelf blijft perfect kloppen na het afknippen
  o.db.data.securityLog.splice(0, 4);        // de VIER NIEUWSTE eraf
  assert.equal(keten.verifieer(o.db.data.securityLog).ok, true,
    'de overgebleven keten klopt met zichzelf -- daarom ziet de keten dit niet');

  const uit = o.dienst.reken(buiten);
  assert.equal(uit.ok, false, 'maar tegen het anker valt het WEL op');
  assert.ok(uit.ingekort.includes('securityLog'));
  assert.equal(uit.perJournaal.securityLog.kwijt, 4, 'en het zegt hoeveel er weg zijn');
});

test('een ongemoeid journaal rekent netjes af', () => {
  const o = maak();
  vul(o.db.data.handelingLog, 6, 'handeling');
  const buiten = o.dienst.blok();
  vul(o.db.data.handelingLog, 3, 'nieuwer');   // gewoon doorgroeien mag

  const uit = o.dienst.reken(buiten);
  assert.equal(uit.ok, true, 'doorgroeien is geen afknipping');
  assert.equal(uit.ingekort.length, 0);
});

test('een journaal dat HELEMAAL leeg is gemaakt, valt op', () => {
  const o = maak();
  vul(o.db.data.securityLog, 8, 'inlog');
  const buiten = o.dienst.blok();
  o.db.data.securityLog.length = 0;

  const uit = o.dienst.reken(buiten);
  assert.equal(uit.ok, false);
  assert.ok(uit.perJournaal.securityLog.ingekort, 'een leeggemaakt journaal is de ergste vorm hiervan');
});

test('de boardroom-journalen krijgen EEN gezamenlijke kop, geen duizend ankers', () => {
  const o = maak();
  o.db.data.ledenBoardLog = { 'user-1': [], 'user-2': [] };
  vul(o.db.data.ledenBoardLog['user-1'], 2, 'a');
  vul(o.db.data.ledenBoardLog['user-2'], 3, 'b');

  const b = o.dienst.blok();
  assert.equal(b.punten.ledenBoardLog.nr, 2, 'twee journalen, een punt');
  assert.match(b.punten.ledenBoardLog.samenvatting, /2 boardroom-journalen/);

  // een regel uit EEN lid-journaal verandert de gezamenlijke hash
  const voor = b.punten.ledenBoardLog.hash;
  o.db.data.ledenBoardLog['user-1'].shift();
  assert.notEqual(o.dienst.blok().punten.ledenBoardLog.hash, voor,
    'verdwijnt er ergens een regel, dan verandert de gezamenlijke kop');
});

test('met een blok erbij staat de dienst WEL in bedrijf', () => {
  const o = maak();
  vul(o.db.data.securityLog, 5, 'inlog');
  const buiten = o.dienst.blok();
  const s = o.dienst.stand(buiten);
  assert.equal(s.inBedrijf, true);
  assert.equal(s.ok, true);
});

test('een blok zonder punten is geen blok', () => {
  const o = maak();
  assert.equal(o.dienst.reken(null).ok, false);
  assert.equal(o.dienst.reken({}).ok, false);
});

test('alle vier de journalen plus de boardroom zitten in het blok', () => {
  const o = maak();
  const b = o.dienst.blok();
  for (const naam of ['inzageLog', 'securityLog', 'handelingLog', 'livingLabAudit', 'ledenBoardLog']) {
    assert.ok(naam in b.punten, naam + ' hoort in het blok te staan, anders ankert hij niets');
  }
});
