/* ============================================================================
   HET REGRESSIECORPUS VAN HET BEWIJSBOEK.

   Dit is de laag die mag zeggen "die toets hoeft niet opnieuw". Elke fout erin
   is dus geen zakkende toets maar een toets die ONTERECHT wordt overgeslagen --
   en die verdwijnt zonder geluid. Vandaar per beslisregel een voorbeeld, en
   vooral: per manier waarop de erfenis hoort te WEIGEREN.

   ACHT UITKOMSTEN EN "ERVEN" IS ER MAAR EEN VAN. De zeven weigeringen zijn het
   eigenlijke werk; wie alleen de gelukkige weg toetst, toetst een cache en geen
   bewijs.

   DE MUTATIE VOOR DIT BESTAND: haal in bewijsboek.js de vervalcontrole weg
   -> "een verlopen bewijs vervalt" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bb = require('../scripts/lib/bewijsboek');

const OMG = { hash: 'aaaa', ongemeten: ['browser'], delen: [] };
const NU = 1_755_000_000_000;                       // een vast tijdstip, geen klok
const boekMet = (b) => ({ versie: 1, bewijzen: { 'test/x.test.js': b } });
const groen = (extra) => boekMet(Object.assign(
  { stempel: 'S1', uitkomst: 'groen', tijdstip: NU - 3600000, onbegrensd: null }, extra));

/* Een stempel die NIET in de steekproef valt, zodat de andere regels los te
   beproeven zijn. Welke dat is, wordt hier gezocht in plaats van gegokt. */
const dag = Math.floor(NU / 86400000);
let RUSTIG = null;
for (let i = 0; i < 500 && RUSTIG === null; i++) {
  if (!bb.inSteekproef('S' + i, dag)) RUSTIG = 'S' + i;
}

test('de omgeving noemt ook wat zij NIET kan meten', () => {
  /* Een lijst die alleen het meetbare noemt, leest als volledigheid. De
     browserversie van de vloot en de databasemotor achter een productieadres
     staan hier niet in en kunnen hier niet in; dat hoort te staan. */
  const o = bb.omgeving();
  assert.ok(o.ongemeten.length >= 1, 'er is iets dat we niet weten, en het staat er');
  for (const naam of o.ongemeten) {
    const d = o.delen.find((x) => x.naam === naam);
    assert.ok(d && d.bron && d.bron.length > 20,
      naam + ' hoort te zeggen WAAROM hij niet te meten is');
  }
  assert.ok(o.dekking > 0 && o.dekking < 100, 'dekking is een echt getal: ' + o.dekking);
  assert.match(o.hash, /^[0-9a-f]{16}$/);
});

test('onwetendheid maakt de houdbaarheid KORTER, nooit langer', () => {
  /* Fail-closed in zijn zuiverste vorm: elk ongemeten deel halveert. */
  const h0 = bb.houdbaarheid({ ongemeten: [] });
  const h1 = bb.houdbaarheid({ ongemeten: ['a'] });
  const h4 = bb.houdbaarheid({ ongemeten: ['a', 'b', 'c', 'd'] });
  assert.equal(h0, bb.BASISDAGEN * 24 * 3600 * 1000);
  assert.equal(h1, h0 / 2);
  assert.ok(h4 < h1, 'meer onwetendheid, kortere houdbaarheid');
  assert.ok(bb.houdbaarheid({ ongemeten: new Array(40).fill('x') }) >= 3600 * 1000,
    'maar nooit onder een uur -- anders is er nooit iets te erven en meet niemand meer mee');
});

test('geen bewijs in het boek: draaien', () => {
  assert.equal(bb.geldig({ bewijzen: {} }, 'test/x.test.js', 'S1', OMG, NU).erven, false);
});

test('het laatste bewijs was rood: draaien, en dat staat er', () => {
  const g = bb.geldig(groen({ uitkomst: 'rood' }), 'test/x.test.js', 'S1', OMG, NU);
  assert.equal(g.erven, false);
  assert.match(g.reden, /rood/);
});

test('een andere stempel -- andere invoer of andere omgeving -- vervalt', () => {
  const g = bb.geldig(groen(), 'test/x.test.js', 'S2', OMG, NU);
  assert.equal(g.erven, false);
  assert.match(g.reden, /invoer of omgeving/);
});

test('onbegrensde invoer erft NOOIT, ook niet als alles verder klopt', () => {
  /* Een toets die door een onoplosbare require heen leest, kan niet bewijzen
     wat hij niet leest. Dat is de tweede grondwetzin, hier als harde regel. */
  const g = bb.geldig(groen({ stempel: RUSTIG, onbegrensd: 'kern/x.js:12' }),
    'test/x.test.js', RUSTIG, OMG, NU);
  assert.equal(g.erven, false);
  assert.match(g.reden, /onbegrensd/);
});

test('een verlopen bewijs vervalt, en de reden noemt de gerekende houdbaarheid', () => {
  const oud = groen({ stempel: RUSTIG, tijdstip: NU - 40 * 24 * 3600 * 1000 });
  const g = bb.geldig(oud, 'test/x.test.js', RUSTIG, { hash: 'aaaa', ongemeten: [] }, NU);
  assert.equal(g.erven, false);
  assert.match(g.reden, /verlopen/);
  assert.match(g.reden, /houdbaar \d+u/, 'met het getal erbij, zodat het te betwisten is');
});

test('de steekproef laat een deel TOCH draaien, om de erfenis zelf te betrappen', () => {
  /* Een cache die nooit wordt tegengesproken, wordt vanzelf een verhaal. */
  let inSteek = null;
  for (let i = 0; i < 500 && inSteek === null; i++) if (bb.inSteekproef('T' + i, dag)) inSteek = 'T' + i;
  assert.ok(inSteek, 'er valt echt iets in de steekproef');
  const g = bb.geldig(groen({ stempel: inSteek }), 'test/x.test.js', inSteek, OMG, NU);
  assert.equal(g.erven, false);
  assert.match(g.reden, /steekproef/);
});

test('de steekproef is deterministisch per dag, en rouleert', () => {
  /* Deterministisch, zodat twee draaiingen op dezelfde dag hetzelfde besluiten
     en de keuze niet van een dobbelsteen afhangt. En roulerend, zodat er op den
     duur niets buiten schot blijft. */
  assert.equal(bb.inSteekproef('S1', 100), bb.inSteekproef('S1', 100));
  const overDagen = [];
  for (let d = 0; d < 200; d++) overDagen.push(bb.inSteekproef('S1', d));
  assert.ok(overDagen.some(Boolean), 'dit bewijs komt op enig moment aan de beurt');
  assert.ok(overDagen.some((x) => !x), 'en niet elke dag');
  let raak = 0;
  for (let i = 0; i < 2000; i++) if (bb.inSteekproef('X' + i, 7)) raak++;
  assert.ok(raak > 2000 / bb.STEEKPROEFDEEL * 0.6 && raak < 2000 / bb.STEEKPROEFDEEL * 1.6,
    'ongeveer een op de ' + bb.STEEKPROEFDEEL + ', gemeten ' + raak + ' van 2000');
});

test('en anders erft hij, met de leeftijd erbij', () => {
  const g = bb.geldig(groen({ stempel: RUSTIG }), 'test/x.test.js', RUSTIG, OMG, NU);
  assert.equal(g.erven, true, g.reden);
  assert.match(g.reden, /zelfde invoer, zelfde omgeving/);
});

test('de sluiting is transitief, en een onoplosbare require maakt haar onbegrensd', () => {
  const nep = {
    bestanden: new Map([
      ['a.js', { pad: 'a.js', hash: 'h1', kanten: { opgelost: ['b.js'], benaderd: [], onbekend: [] } }],
      ['b.js', { pad: 'b.js', hash: 'h2', kanten: { opgelost: ['c.js'], benaderd: [], onbekend: [] } }],
      ['c.js', { pad: 'c.js', hash: 'h3', kanten: { opgelost: [], benaderd: [], onbekend: [] } }],
      ['d.js', { pad: 'd.js', hash: 'h4', kanten: { opgelost: [], benaderd: [],
        onbekend: [{ lijn: 9, vorm: 'kale variabele', reden: 'pad uit een variabele' }] } }]
    ])
  };
  const s = bb.sluiting(nep, ['a.js']);
  assert.deepEqual(s.paden, ['a.js', 'b.js', 'c.js'], 'drie stappen diep');
  assert.equal(s.onbegrensd, null);
  assert.ok(bb.sluiting(nep, ['d.js']).onbegrensd, 'wie door een maplader leest, leest onbegrensd');
});

test('de stempel verandert zodra er iets in de sluiting verandert', () => {
  /* Zonder dit is het boek een naamlijst en geen bewijs. */
  const maak = (hash) => ({ bestanden: new Map([
    ['a.js', { pad: 'a.js', hash: 'x', kanten: { opgelost: ['b.js'], benaderd: [], onbekend: [] } }],
    ['b.js', { pad: 'b.js', hash: hash, kanten: { opgelost: [], benaderd: [], onbekend: [] } }]
  ]) });
  const s1 = bb.stempel(maak('h2'), ['a.js'], OMG);
  const s2 = bb.stempel(maak('h2-anders'), ['a.js'], OMG);
  assert.notEqual(s1.hash, s2.hash, 'een gewijzigd bestand DRIE lagen diep telt gewoon mee');
  assert.equal(bb.stempel(maak('h2'), ['a.js'], { hash: 'bbbb', ongemeten: [] }).hash !== s1.hash, true,
    'en een andere omgeving ook');
});
