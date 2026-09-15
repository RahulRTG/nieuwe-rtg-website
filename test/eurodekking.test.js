/* HOEVEEL VAN HET GELD BEGRIJPT DEZE MACHINE -- en de vier manieren waarop dat
   getal kan liegen.

   De dragende toetsen zijn 3, 4 en 5, en geen van drieen gaat over rekenen:

     3. ZAADWERELD en PRODUCTIE mogen nooit hetzelfde cijfer worden. Een
        zaadwereld bewijst dat de rekenmachine werkt; productie vertelt hoeveel
        van de werkelijkheid zij begrijpt.
     4. Een dekking over meerdere valuta bestaat niet. Deze fout is in dit
        bestand echt gemaakt (15 september 2026): de eerste versie telde EUR,
        JPY en TRY op en meldde 99,1% waar het over euro's 92,5% was.
     5. De noemer is de ABSOLUTE waarde. Anders verbetert een huis zijn dekking
        door geld terug te draaien. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const dk = require('../server/kern/waarde/dekking.js');
const eh = require('../server/kern/waarde/economischeherkomst.js');

const VOL = () => eh.geldrij({
  bedragCenten: 96000, valuta: 'EUR',
  economischeHerkomst: 'lid', economischeEigenaar: 'derde', naarWie: 'rtg',
  grond: 'hotelnacht', bronObject: 'payboeking:PB-1'
});

test('1. elke ontbrekende schakel komt met NAAM terug, en ze zijn los te vangen', () => {
  assert.deepEqual(dk.volledigVerklaard(VOL()), { ok: true, mist: [] });
  /* Per schakel EEN mutatie, want een toets die alles tegelijk sloopt bewijst
     alleen dat er iets kapot kan. */
  const gevallen = {
    valuta: (r) => { r.valuta = null; },
    economischeHerkomst: (r) => { r.economischeHerkomst = eh.ONBEKEND; },
    economischeEigenaar: (r) => { r.economischeEigenaar = eh.ONBEKEND; },
    naarWie: (r) => { r.naarWie = eh.ONBEKEND; },
    bronObject: (r) => { r.bronObject = null; }
  };
  for (const [schakel, sloop] of Object.entries(gevallen)) {
    const r = { ...VOL() };
    sloop(r);
    const u = dk.volledigVerklaard(r);
    assert.equal(u.ok, false, schakel + ' ontbrak en de rij heette toch volledig verklaard');
    assert.ok(u.mist.includes(schakel),
      'de melding noemt "' + schakel + '" niet: ' + JSON.stringify(u.mist) + '. Een nee zonder ' +
      'reden is als werklijst nutteloos.');
  }
  assert.equal(dk.volledigVerklaard({ valuta: 'EUR' }).mist[0], 'bedrag');
  /* EN EEN EIGENAAR DIE NERGENS IS INGEDEELD. Dit is de schakel die niet uit de
     rij zelf komt maar uit kern/waarde/bijdragebasis.js: een verzonnen
     partijsoort ziet er op de rij compleet uit. */
  const vreemd = { ...VOL(), economischeEigenaar: 'kartel' };
  assert.ok(dk.volledigVerklaard(vreemd).mist.includes('classificatie'),
    'een partijsoort die nergens is ingedeeld, telde als volledig verklaard');
});

test('2. herkomstdekking en economisch verklaard zijn TWEE getallen', () => {
  /* Een rij met alleen een herkomst telt in een zacht dekkingscijfer mee alsof
     hij begrepen is, terwijl niemand kan aanwijzen waar hij heen ging. */
  const half = eh.geldrij({ bedragCenten: 4000, valuta: 'EUR', economischeHerkomst: 'lid' });
  const u = dk.dekkingOver([VOL(), half]);
  assert.equal(u.herkomst.percentage, 100, 'de zachte teller ziet de halve rij niet als gat');
  assert.equal(u.economisch.percentage, 96);
  assert.notEqual(u.herkomst.percentage, u.economisch.percentage,
    'de twee getallen zijn gelijk; dan meet deze toets niets en mogen ze ook niet apart heten');
  assert.deepEqual(Object.keys(u.ontbreekt).sort(),
    ['bronObject', 'economischeEigenaar', 'naarWie']);
});

test('3. DRAGEND: drie toestanden, en ZAADWERELD is nooit PRODUCTIE', () => {
  const rijen = [VOL()];
  const leeg = dk.euroDekking([], { wereld: 'productie' });
  assert.equal(leeg.status, 'GEEN_NOEMER');
  assert.equal(leeg.percentage, null, 'een lege noemer werd een percentage');

  /* DE WERELD WORDT VERKLAARD EN NIET GERADEN. Zonder opgave geen cijfer: een
     dekkingsgetal zonder wereld leest als productie. */
  const ongezegd = dk.euroDekking(rijen);
  assert.equal(ongezegd.status, 'GEEN_NOEMER');
  assert.equal(ongezegd.percentage, null);
  assert.match(ongezegd.reden, /niet opgegeven/);

  const zaad = dk.euroDekking(rijen, { wereld: 'zaadwereld' });
  const prod = dk.euroDekking(rijen, { wereld: 'productie' });
  assert.equal(zaad.status, 'ZAADWERELD');
  assert.equal(prod.status, 'PRODUCTIE');
  assert.notEqual(zaad.status, prod.status,
    'dezelfde rijen gaven dezelfde toestand; dan is de wereld geen onderscheid maar een sierveld');
  assert.notEqual(zaad.reden, prod.reden,
    'de twee toestanden dragen dezelfde uitleg; dan kan een lezer ze niet uit elkaar houden');
  assert.match(zaad.reden, /zegt niets over hoeveel van de werkelijkheid/);
});

test('4. DRAGEND: een dekking over meerdere valuta bestaat niet', () => {
  const yen = eh.geldrij({ bedragCenten: 500000, valuta: 'JPY',
    economischeHerkomst: 'lid', economischeEigenaar: 'derde', naarWie: 'derde', bronObject: 'reis:p-3' });
  const u = dk.dekkingOver([VOL(), yen]);
  assert.equal(u.eenValuta, null);
  assert.equal(u.totaalCenten, null,
    'er kwam een totaal uit over twee munten. Dit is de fout die op 15 september 2026 echt is ' +
    'gemaakt: EUR 27.732,30 voor geld dat grotendeels in yen stond.');
  assert.equal(u.herkomst, null, 'er kwam een kopcijfer uit over twee munten');
  assert.match(u.waaromGeenTotaal, /koers/);
  /* Maar de informatie gaat WEL mee: "geen getal" hoort geen "geen informatie"
     te betekenen. */
  assert.equal(u.perValuta.EUR.economisch.percentage, 100);
  assert.equal(u.perValuta.JPY.economisch.percentage, 100);
  assert.equal(dk.euroDekking([VOL(), yen], { wereld: 'productie' }).status, 'GEEN_NOEMER');
});

test('5. de noemer is de absolute waarde -- terugdraaien verbetert geen dekking', () => {
  const om = require('../server/kern/waarde/omkering.js');
  const heen = VOL();
  const terug = om.keerOm(heen, { grond: 'terugbetaling', reden: 'kamer niet geleverd' }).rij;
  const u = dk.dekkingOver([heen, terug]);
  assert.equal(u.totaalCenten, 192000,
    'de spiegel maakte de noemer kleiner in plaats van groter. Dan kan een huis zijn dekking ' +
    'verbeteren door geld terug te draaien, en bij volledige terugboeking is de noemer nul.');
  assert.equal(u.economisch.percentage, 100);
  /* En de spiegel is zelf volledig verklaard -- anders zou ECON-01 de dekking
     omlaag halen bij elke correcte terugboeking. */
  assert.equal(dk.volledigVerklaard(terug).ok, true, JSON.stringify(dk.volledigVerklaard(terug).mist));
});

test('6. het register houdt de zaadwereld en de productie uit elkaar', () => {
  const u = require('../scripts/doorbelasting.js').meet();
  /* De zaadwereldcijfers staan onder een sleutel die het woord DRAAGT. Een
     percentage dat `dekking` heet en over een fixture is gerekend, wordt bij het
     overtypen vanzelf het cijfer over de werkelijkheid. */
  assert.ok(u.norm.dekkingZaadwereld, 'de zaadwereldmeting staat niet onder een eigen sleutel');
  assert.ok(!('dekking' in u.norm), 'er staat een kale sleutel `dekking` naast; die is te lenen');
  assert.equal(u.norm.euroDekkingZaadwereld.status !== 'PRODUCTIE', true,
    'de zaadwereld meldt zich als productie');

  const ep = u.euroDekkingProductie;
  assert.ok(['GEEN_NOEMER', 'PRODUCTIE', 'ZAADWERELD'].includes(ep.status));
  /* VANDAAG IS HET null, EN MET REDENEN. Zakt deze toets omdat er een cijfer
     staat, dan is dat geen defect maar nieuws: lees de beletsels, en kijk of ze
     echt zijn opgeruimd. */
  assert.equal(ep.status, 'GEEN_NOEMER');
  assert.equal(ep.percentage, null);
  assert.ok(ep.beletsels.length >= 1, 'null zonder opgeschreven beletsel is een lege bewering');
  assert.ok(ep.beletsels.some(x => /valuta/.test(x)),
    'het ontbreken van een munt op de noemer staat er niet bij: ' + JSON.stringify(ep.beletsels));
  /* De teller wordt WEL gerekend, zodat wie de beletsels opruimt niet hoeft te
     raden hoe groot het verklaarde deel was. */
  assert.equal(typeof ep.verklaardCenten, 'number');
});
