/* DE FRICTIESCHADUW -- meelopen zonder te bijten.

   kern/stuur/beleid.js beantwoordt "mag de AI dit pad" uit een statische lijst
   plus de bodem. De frictieMOTOR rekent per GEVAL met bedrag en aantal, en die
   staan in de body die stuurToets al in handen heeft. CONTROLPLANE.md zegt hoe
   zo'n koppeling begint: eerst meelopen, dan pas afdwingen.

   VIER DINGEN, en de eerste is de enige die er echt toe doet:

     1 DE SCHADUW BESLIST NIETS. Getoetst op de BRON, zoals bij ./plan.js: de
       aanroep in kern/stuur.js staat achter een vangnet en zijn uitkomst raakt
       `beleid.niveau` nergens aan. Zou hij dat wel doen, dan is dit geen schaduw
       maar een tweede poort die nooit in de schaduw heeft gelopen.
     2 HIJ KAN ALLEEN VERZWAREN. Dezelfde regel als de bodem in ./beleid.js:
       frictie mag omhoog van de omstandigheden en omlaag van niets.
     3 EEN BEDRAG ZONDER EENHEID WORDT NIET GELEZEN. COMMERCE.md heeft daar een
       fout op gemeten: `bedrag` staat in kern/mall/aanbod.js in EURO'S. Stil
       maal honderd doen is erger dan het veld negeren.
     4 HET ANKER. Bedrag alleen verzwaart niet, bedrag en aantal samen wel. Dat
       is gemeten en niet beredeneerd, en het is precies wat de eerste versie van
       dit bestand fout had. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const schaduw = require('../server/kern/stuur/frictieschaduw');
const { NIVEAUS } = require('../server/kern/stuur/beleid');
const { VERZWAREN, meet } = require('../scripts/frictiestuur');

const WORTEL = path.join(__dirname, '..');
const weger = schaduw.maakSchaduw({});

test('1. DE SCHADUW BESLIST NIETS -- getoetst op de bron van kern/stuur.js', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/stuur.js'), 'utf8');
  const regel = bron.split('\n').find(r => r.includes('frictieschaduw.noteer('));
  assert.ok(regel, 'de schaduw wordt niet meer aangeroepen vanuit stuurToets');
  assert.ok(/^\s*try\s*\{/.test(regel),
    'de schaduwaanroep staat niet achter een vangnet: een gemiste tel mag nooit een actie weigeren');
  assert.ok(!/beleid\.niveau\s*=[^=]/.test(bron),
    'iets kent `beleid.niveau` een nieuwe waarde toe -- dan beslist de schaduw mee en is hij geen schaduw');
});

test('2. ALLEEN VERZWAREN: een zware context maakt een lezen-pad nooit lichter', () => {
  const zwaar = { centen: 2500000, aantal: 500 };
  for (const van of [NIVEAUS.lezen, NIVEAUS.klein, NIVEAUS.voorstel]) {
    const u = weger.weeg(van, zwaar);
    const orde = { lezen: 1, klein: 2, voorstel: 3, verboden: 4 };
    assert.ok(orde[u.naar] >= orde[van], van + ' werd lichter gemaakt naar ' + u.naar);
  }
});

test('3. een bedrag zonder eenheid in de naam wordt NIET gelezen', () => {
  const u = schaduw.contextUit({ bedrag: 250000 });
  assert.equal(u.ctx.centen, undefined, '`bedrag` is in dit huis soms euro\'s -- niet omrekenen');
  assert.deepEqual(u.eenheidOnbekend, ['bedrag'], 'en het wordt ook niet stil weggelaten');
  const wel = schaduw.contextUit({ centen: 250000 });
  assert.equal(wel.ctx.centen, 250000);
  assert.deepEqual(wel.gevonden, ['centen']);
});

test('4. HET ANKER: bedrag alleen verzwaart niet, bedrag en aantal samen wel', () => {
  assert.equal(weger.weeg(NIVEAUS.klein, { centen: 25000000 }).zouVerzwaren, false,
    '250.000 euro alleen komt niet boven de autogrens -- de bedragfactor loopt vast op 25');
  const samen = weger.weeg(NIVEAUS.klein, { centen: 2500000, aantal: 500 });
  assert.equal(samen.zouVerzwaren, true, 'bedrag en aantal samen horen er wel overheen te komen');
  assert.equal(samen.naar, NIVEAUS.voorstel, 'en dat betekent: een mens bevestigt');
  assert.ok(samen.opbouw.length >= 3, 'een score zonder opbouw is een orakel');
});

test('5. het meetscript staat op zijn vastgelegde stand', () => {
  assert.deepEqual(meet().verzwaren, [...VERZWAREN],
    'de gevallen die verzwaren zijn verschoven -- iemand zat aan de grenzen of de factoren');
});

test('6. de telling telt, en houdt geen journaal', () => {
  schaduw.vergeet();
  schaduw.noteer('lid', '/api/bank/pas/betaal', weger.weeg(NIVEAUS.klein, { centen: 2500000, aantal: 500 }));
  schaduw.noteer('lid', '/api/agenda/lijst', weger.weeg(NIVEAUS.lezen, {}));
  const s = schaduw.stand();
  assert.equal(s.gewogen, 2);
  assert.equal(s.zouVerzwaren, 1);
  assert.ok(s.nietGemeten.includes('geruststelling'), 'de stand hoort te zeggen wat hij NIET bewijst');
  assert.ok(!JSON.stringify(s).includes('cn-'), 'er hoort geen codenaam in een teller te belanden');
  schaduw.vergeet();
});
