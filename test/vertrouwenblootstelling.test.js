/* DE BLOOTSTELLINGSMETER -- laag 1 van de Trust Fabric.

   Zes beweringen die van buiten niet te zien zijn. De eerste vijf gaan over wat
   de meter doet als hij het NIET weet -- dat is waar een risicometer stukgaat,
   niet bij het geval dat hij kent. De zesde gaat over een aanval op de meter
   zelf.

   1. Een soort die niet in het register staat krijgt geen nul maar `gemeten:
      false` met een reden. Ongewogen is niet licht, en dat verschil is de hele
      bestaansreden van deze laag.
   2. Hetzelfde geldt voor een aantal dat niemand heeft geteld.
   3. Zodra er genoeg waarnemingen zijn meet hij tegen het EIGEN bereik; is dat
      er niet, dan tegen de vaste grens EN hij zegt dat erbij.
   4. Bijzondere persoonsgegevens halveren de drempel, en dat staat in de
      redenen -- een grens die stilletjes verschuift is niet uit te leggen.
   5. Hij schrijft niets, ook niet in zijn eigen register.
   6. En de grondslag is niet door de aanvaller te verzetten: alleen een
      UITGEVOERDE handeling telt mee, nooit een geprobeerde. Anders vraagt hij
      honderd keer een grote uitvoer aan die netjes wordt tegengehouden, en is
      de honderdeneerste "normaal".

   Draai los: node --test test/vertrouwenblootstelling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../server/kern/vertrouwen/blootstelling');
const R = require('../server/kern/vertrouwen/register');

const genoeg = (p95) => ({ p95, n: B.WAARNEMINGEN_NODIG });

test('1. een soort buiten het register krijgt geen nul maar een reden', () => {
  const u = B.meet({ soort: 'iets.verzonnen', aantal: 99999 }, genoeg(10));
  assert.equal(u.gemeten, false, 'ongewogen, en dat staat er');
  assert.equal(u.zwaarte, undefined, 'geen zwaarte: een ongewogen handeling heeft er geen');
  assert.match(u.reden, /niet in het handelingenregister/);
  assert.match(u.reden, /niet hetzelfde als licht/, 'de val staat in de reden zelf benoemd');
  assert.ok(Array.isArray(u.nietGerekend) && u.nietGerekend.length,
    'ook een ongewogen antwoord draagt zijn randen mee');
});

test('2. een aantal dat niemand heeft geteld is geen omvang', () => {
  for (const raar of [undefined, null, -1, NaN, '400', {}]) {
    const u = B.meet({ soort: 'mens.uitdienst', aantal: raar }, genoeg(2));
    assert.equal(u.gemeten, false, JSON.stringify(raar) + ' hoort niet te tellen');
    assert.match(u.reden, /geen telbaar aantal/);
  }
  const nul = B.meet({ soort: 'mens.uitdienst', aantal: 0 }, genoeg(2));
  assert.equal(nul.gemeten, true, 'nul is wel een geldig aantal en geen ontbrekend aantal');
  assert.equal(nul.zwaarte, 'licht');
});

test('3. het eigen bereik wint van de vaste grens, en de koude start zegt dat', () => {
  /* Dezelfde 400 personen: voor wie dat dagelijks doet is het gewoon werk. */
  const gewend = B.meet({ soort: 'mens.uitdienst', aantal: 400 }, { p95: 500, n: 60 });
  assert.equal(gewend.grondslag, 'eigen');
  assert.equal(gewend.zwaarte, 'licht', '400 binnen een eigen bereik van 500 is gewoon werk');

  /* En voor wie hier nieuw is, is het een uitschieter -- met de reden erbij. */
  const nieuw = B.meet({ soort: 'mens.uitdienst', aantal: 400 }, { p95: 500, n: 3 });
  assert.equal(nieuw.grondslag, 'vast', 'drie waarnemingen zijn geen gewoonte');
  assert.equal(nieuw.zwaarte, 'uitzonderlijk');
  assert.ok(nieuw.redenen.some(r => /3 van de/.test(r)),
    'de koude start staat er met het aantal waarnemingen, niet stilzwijgend');

  /* En zonder enige grondslag ook. Dit is het gevaarlijke geval: een
     gloednieuwe actor die meteen groot uithaalt. */
  const kaal = B.meet({ soort: 'mens.uitdienst', aantal: 400 }, null);
  assert.equal(kaal.grondslag, 'vast');
  assert.equal(kaal.zwaarte, 'uitzonderlijk', 'geen grondslag is geen vrijbrief');
});

test('4. bijzondere persoonsgegevens halveren de grens, en dat is uit te leggen', () => {
  const s = R.soort('mens.gevoelig.inzage');
  assert.equal(s.gevoelig, true);
  /* Precies de vaste grens: zonder de halvering was dit 'licht'. */
  const u = B.meet({ soort: 'mens.gevoelig.inzage', aantal: s.vast }, null);
  assert.equal(u.drempel, Math.round(s.vast / 2), 'de drempel ligt op de helft');
  assert.equal(u.zwaarte, 'zwaar');
  assert.ok(u.redenen.some(r => /op de helft/.test(r)), 'en de lezer krijgt te horen waarom');

  const ongevoelig = B.meet({ soort: 'rol.geven', aantal: R.soort('rol.geven').vast }, null);
  assert.equal(ongevoelig.zwaarte, 'licht', 'zonder gevoeligheid is de vaste grens de grens');
});

test('5. onomkeerbaar wordt genoemd, en alleen als het ertoe doet', () => {
  const groot = B.meet({ soort: 'tenant.uitvoer', aantal: 100000 }, null);
  assert.equal(groot.omkeerbaar, false);
  assert.ok(groot.redenen.some(r => /niet terug te draaien/.test(r)));
  assert.ok(groot.redenen.some(r => /verlaten het huis/.test(r)),
    'met de reden uit het register, niet met een algemene zin');

  /* Een kleine uitvoer is ook onomkeerbaar, maar dat is dan geen waarschuwing
     waard: wie bij elke handeling hetzelfde hoort, hoort het niet meer. */
  const klein = B.meet({ soort: 'tenant.uitvoer', aantal: 1 }, null);
  assert.equal(klein.zwaarte, 'licht');
  assert.equal(klein.redenen.length, 0, 'een lichte handeling legt niets uit');
});

test('6. de zin is er een, en hij draagt het getal', () => {
  const u = B.meet({ soort: 'tenant.uitvoer', aantal: 18400 }, null);
  assert.equal(typeof u.zin, 'string');
  assert.equal(u.zin.split('. ').length <= 2, true, 'een step-up die twee zinnen nodig heeft is ruis');
  assert.match(u.zin, /18400/, 'het getal staat erin en niet alleen "veel"');
  assert.match(u.zin, /niet terug te draaien/);
});

test('7. meten heeft geen bijwerking -- ook niet op het register', () => {
  const voor = JSON.stringify(R.SOORTEN);
  const a = B.meet({ soort: 'mens.uitdienst', aantal: 42 }, { p95: 7, n: 30 });
  const b = B.meet({ soort: 'mens.uitdienst', aantal: 42 }, { p95: 7, n: 30 });
  assert.deepEqual(a, b, 'dezelfde invoer geeft hetzelfde oordeel');
  assert.equal(JSON.stringify(R.SOORTEN), voor, 'het register is niet aangeraakt');
  /* En de aanroeper kan het antwoord niet in het register terugduwen. */
  a.nietGerekend.push({ wat: 'kwaad', reden: 'x' });
  assert.equal(R.NIET_GEREKEND.some(n => n.wat === 'kwaad'), true,
    'nu deelt hij nog dezelfde lijst -- deze toets legt dat vast zodat een latere kopie een besluit is');
});

/* ---------- de grondslag zelf (gewoonte.js) ----------

   De scherpste bewering van deze laag zit hier: een grondslag die meetelt wat
   er is GEPROBEERD, is door de aanvaller zelf te verzetten. Toets 9 legt vast
   dat alleen uitgevoerde handelingen tellen -- niet door in de code te kijken,
   maar door de aanval na te spelen. */
const G = require('../server/kern/vertrouwen/gewoonte');

test('8. de gewoonte vergeet, en levert liever niets dan een verzonnen nul', () => {
  const bak = {};
  assert.equal(G.lees(bak, 'A', 'mens.uitdienst'), null, 'een lege reeks is geen grondslag van nul');

  for (let i = 0; i < G.VENSTER + 40; i += 1) G.noteer(bak, 'A', 'mens.uitdienst', 3);
  const g = G.lees(bak, 'A', 'mens.uitdienst');
  assert.equal(g.n, G.VENSTER, 'het venster loopt niet vol maar schuift op');
  assert.equal(g.p95, 3);

  /* Vorig jaar deed deze actor grote dingen; dat hoort uit beeld te lopen. */
  for (let i = 0; i < G.VENSTER; i += 1) G.noteer(bak, 'A', 'mens.uitdienst', 1);
  assert.equal(G.lees(bak, 'A', 'mens.uitdienst').p95, 1, 'de oude reeks is vergeten');

  assert.equal(G.lees(bak, 'B', 'mens.uitdienst'), null, 'en het is per actor gescheiden');
});

test('9. een GEPROBEERDE handeling verzet de grens niet, een uitgevoerde wel', () => {
  const bak = {};
  const meet = (n) => B.meet({ soort: 'mens.uitdienst', aantal: n },
    G.lees(bak, 'aanvaller', 'mens.uitdienst'));

  /* De aanval: honderd keer groot uithalen. Elke poging wordt zwaar bevonden
     en dus tegengehouden -- en juist daarom noteert niemand hem. */
  for (let i = 0; i < 100; i += 1) {
    const u = meet(400);
    assert.notEqual(u.zwaarte, 'licht', 'poging ' + i + ' hoort nog steeds op te vallen');
    // geen G.noteer(): de handeling is niet uitgevoerd
  }
  assert.equal(meet(400).zwaarte, 'uitzonderlijk',
    'na honderd geweigerde pogingen is 400 nog altijd uitzonderlijk');

  /* En het tegendeel: wie het honderd keer ECHT doet, bouwt wel een grondslag
     op. Dat is bedoeld gedrag, en het kost honderd bevestigde momenten. */
  for (let i = 0; i < 100; i += 1) G.noteer(bak, 'aanvaller', 'mens.uitdienst', 400);
  assert.equal(meet(400).zwaarte, 'licht', 'honderd keer uitgevoerd maakt het wel normaal');
  assert.equal(meet(400).grondslag, 'eigen');
});

test('10. wie verdwijnt, laat geen gewoonte achter', () => {
  const bak = {};
  G.noteer(bak, 'C', 'mens.uitdienst', 2);
  G.noteer(bak, 'C', 'rol.geven', 2);
  G.noteer(bak, 'CD', 'rol.geven', 2);
  assert.equal(G.vergeetActor(bak, 'C'), 2, 'beide reeksen van C');
  assert.equal(G.lees(bak, 'C', 'rol.geven'), null);
  assert.ok(G.lees(bak, 'CD', 'rol.geven'), 'en niet die van een actor wiens id ermee begint');
});

/* HET VERGEETRECHT IS EEN EN NIET TWEE. Dit is de fout die de keuring aanwees
   met "de functie vergeet staat in 3 kernmodules": er waren drie antwoorden op
   dezelfde vraag, en het bovenste -- dat wat een aanroeper gebruikt -- wiste
   alleen de gewoonte. De apparatenlijst bleef staan, en dan overleeft het
   profiel de persoon. Deze toets gaat door de fabric heen en niet langs de
   losse modules, want dat is de weg die een echte aanroeper neemt. */
test('11. wie vergeten wordt, laat OOK geen apparaat en geen sessie achter', () => {
  const db = { data: {} };
  const fabric = require('../server/kern/vertrouwen')({ db, save: () => {} });
  fabric.verifieer('sessie-van-D', { hoe: 'wachtwoord', account: 'D', apparaat: 'laptop' });
  fabric.voltooid('D', 'rol.geven', 3);

  const bak = db.data.vertrouwen;
  assert.ok(Object.keys(bak.gewoonte).length, 'er staat een gewoonte');
  assert.ok(Object.keys(bak.sessies).length, 'er staat een sessie');
  assert.ok(Object.keys(bak.apparaten).length, 'en een apparaat');

  fabric.vergeet('D', 'sessie-van-D');
  assert.equal(G.lees(bak, 'D', 'rol.geven'), null, 'de gewoonte is weg');
  assert.equal(Object.keys(bak.sessies).length, 0, 'de sessie ook');
  assert.equal(Object.keys(bak.apparaten).length, 0, 'en de apparatenlijst -- dit was het gat');
});
