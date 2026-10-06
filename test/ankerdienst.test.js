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

/* ---------------------------------------------------------------------------
   AUDIT P1-3: een GETEKEND anker, een VOLLEDIGE herschrijving, en de
   zegelketens van het API-spoor en het besluitjournaal.
   ------------------------------------------------------------------------- */
const crypto = require('crypto');
const ZAAD = Buffer.alloc(32, 7);
function getekend(zaad) {
  const db = { data: { inzageLog: [], securityLog: [], handelingLog: [], livingLab: { audit: [] }, ledenBoardLog: {},
    apiSpoor: { commandJournaal: [], commandJournaalTotaal: 0 } } };
  const dienst = maakAnkerdienst({ db, sleutel: () => zaad || ZAAD, omgeving: {} });
  return { db, dienst };
}

test('P1-3a: het blok is getekend met een sleutel die NIET in de database staat, en een vervalst blok rekent niet af', () => {
  const o = getekend();
  vul(o.db.data.handelingLog, 5, 'h');
  const b = o.dienst.blok();
  assert.equal(b.handtekening && b.handtekening.alg, 'ed25519');
  const db = JSON.stringify(o.db.data);
  assert.ok(!db.includes(ZAAD.toString('hex')) && !db.includes(ZAAD.toString('base64')), 'geen sleutelmateriaal in de database');
  assert.ok(!JSON.stringify(b).includes(ZAAD.toString('base64')), 'en ook niet in het blok');
  assert.equal(o.dienst.reken(b).ok, true);
  assert.equal(o.dienst.reken(b).ondertekend, true);
  /* Wie het blok bijstelt en de zegel opnieuw uitrekent -- dat kon vroeger -- breekt de handtekening. */
  const vals = JSON.parse(JSON.stringify(b));
  vals.punten.handelingLog.nr = 2;
  const { handtekening, zegel, ...kaal } = vals;
  vals.zegel = crypto.createHash('sha256').update(JSON.stringify(kaal)).digest('hex').slice(0, 32);
  const r = o.dienst.reken(vals);
  assert.equal(r.ok, false); assert.equal(r.ondertekend, false);
  /* Een blok van een andere sleutel (met zijn eigen publieke sleutel erin) telt evenmin. */
  const ander = getekend(Buffer.alloc(32, 9));
  vul(ander.db.data.handelingLog, 5, 'h');
  assert.equal(o.dienst.reken(ander.dienst.blok()).ondertekend, false);
  /* Zonder handtekening: niet van ons. */
  const { handtekening: _weg, ...ongetekend } = b;
  assert.equal(o.dienst.reken(ongetekend).ok, false);
});

test('P1-3a: RTG_ANKER_SIGN_KEY wint van de afgeleide sleutel', () => {
  const db = { data: { handelingLog: [] } };
  vul(db.data.handelingLog, 2, 'h');
  const a = maakAnkerdienst({ db, sleutel: () => ZAAD, omgeving: { RTG_ANKER_SIGN_KEY: Buffer.alloc(32, 3).toString('hex') } });
  const b = maakAnkerdienst({ db, sleutel: () => Buffer.alloc(32, 3), omgeving: {} });
  assert.equal(a.publiekeSleutel().sleutelId, b.publiekeSleutel().sleutelId);
  assert.equal(b.reken(a.blok()).ondertekend, true);
});

test('een VOLLEDIGE herschrijving met geldige hashes valt lokaal niet op, maar tegen het externe anker wel', () => {
  const o = getekend();
  vul(o.db.data.handelingLog, 10, 'h');
  const buiten = o.dienst.blok();
  /* Alles opnieuw uitrekenen, met een regel aangepast: elke hash klopt weer. */
  const oud = o.db.data.handelingLog.slice().reverse();
  const nieuw = [];
  for (const r of oud) {
    const { hash, vorige, nr, ...kern } = r;
    if (kern.wat === 'h3') kern.wat = 'een nettere werkelijkheid';
    keten.noteerIn(nieuw, kern, 1000);
  }
  o.db.data.handelingLog = nieuw;
  assert.equal(keten.verifieer(nieuw).ok, true, 'lokaal kloppend -- daarom bestaat het anker');
  const uit = o.dienst.reken(buiten);
  assert.equal(uit.ok, false, 'tegen het anker valt het op');
  assert.equal(uit.perJournaal.handelingLog.herschreven, true);
  /* En alles tot en met de geankerde regel weggooien plus nieuwe regels erbij (P2-5). */
  const o2 = getekend();
  vul(o2.db.data.handelingLog, 10, 'h');
  const b2 = o2.dienst.blok();
  vul(o2.db.data.handelingLog, 3, 'nieuw');
  o2.db.data.handelingLog.length = 3;
  const u2 = o2.dienst.reken(b2);
  assert.equal(u2.ok, false, 'het journaal is niet vol, dus de bewaring verklaart het niet');
  assert.equal(u2.perJournaal.handelingLog.weg, true);
});

test('P1-3c: het API-spoor staat in het blok, en kopafknipping of herzegelen valt op', () => {
  const o = getekend();
  const j = require('../server/kern/command/journaal').maakJournaal({ db: o.db, save: () => {}, crypto,
    vak: () => o.db.data.apiSpoor });
  for (let i = 0; i < 8; i++) j.noteer({ actor: 'a', actie: 'POST /x' + i });
  const buiten = o.dienst.blok();
  assert.equal(buiten.punten.apiSpoor.nr, 8);
  assert.equal(o.dienst.reken(buiten).ok, true);
  j.noteer({ actor: 'a', actie: 'daarna' });
  assert.equal(o.dienst.reken(buiten).ok, true, 'doorgroeien is geen afknipping');
  const bewaard = JSON.parse(JSON.stringify(o.db.data.apiSpoor));
  /* De kop eraf, teller mee omlaag: lager dan het anker. */
  o.db.data.apiSpoor.commandJournaal.splice(-3); o.db.data.apiSpoor.commandJournaalTotaal -= 3;
  assert.equal(j.controleer().heel, true, 'de zegelketen zelf klopt nog');
  assert.equal(o.dienst.reken(buiten).perJournaal.apiSpoor.ingekort, true);
  /* De kop eraf, teller laten staan: de geankerde regel krijgt een andere zegel. */
  o.db.data.apiSpoor = JSON.parse(JSON.stringify(bewaard));
  o.db.data.apiSpoor.commandJournaal.splice(-3);
  assert.equal(o.dienst.reken(buiten).ok, false);
});
