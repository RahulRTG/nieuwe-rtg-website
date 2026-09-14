/* DE NAMENSVORM-METER: kan hij nog vinden wat hij beweert niet te vinden?

   REPRESENTATIE.md par. 0 rust op twee nullen: 0 van de 50 velden staan in alle
   zes mechanismen die opslaan, en 0 van de 7 werkwoorden staat in alle zeven op
   naam. Op een nul een architectuurbesluit bouwen mag alleen als je kunt laten
   zien dat de meter ook een NIET-nul zou hebben gevonden -- anders staat hij
   groen om precies dezelfde reden als een meter die kapot is, en die twee zijn
   van buiten niet te onderscheiden. Dat is dezelfde zelfijking die
   test/carrierevorm.test.js en test/stagevorm.test.js afdwingen.

   TOETS 2 BEWAAKT EEN FOUT DIE BIJ HET BOUWEN ECHT IS GEMAAKT en die geen
   uitzondering gaf. Het naampatroon kende `function x(` en `const x = (` maar
   niet `async function x(`, en meldde daarop dat kern/vertegenwoordiging/ geen
   `verlenen`, `aanvaarden` en `intrekken` heeft -- terwijl die drie er
   letterlijk staan. De uitslag was geldig, netjes opgemaakt en onwaar. Dat is
   de klasse uit BEWIJSMACHINE.md par. 6a: een bewijs draagt niet alleen zijn
   uitslag maar ook zijn INDELING, en die is zelf aantoonbaar of hij is niet
   waar.

   TOETS 4 IS DE BESTURINGSPROEF OP DE ANDERE KANT. De synoniemenlijst is ruim
   (`stand`, `actief`, `mag[A-Z]`), en een patroon dat overal raakt is geen
   patroon maar een stempel. Er moet dus aantoonbaar een werkwoord zijn dat
   OOK op synoniem niet overal staat -- anders meet deze as niets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const N = require('../scripts/namensvorm');
const om = require('../scripts/objectmodel');

const WORTEL = path.join(__dirname, '..');

test('1. zelfijking: versmald tot twee verwante mechanismen VINDT de meter wel een gedeelde vorm', () => {
  const echt = N.meet().gemeten.smal;
  assert.equal(echt.inAlleMechanismen, 0, 'over alle mechanismen staat er geen veld in elk mechanisme');

  /* bijstand en de servicemachtiging zijn de twee die volgens de bron ZELF een
     vorm delen: de kop van kern/service/machtiging.js zegt met zoveel woorden
     "Dat er twee zijn is bewust: bijstand gaat over een omgeving van iemand
     anders, dit over een dossier bij RTG zelf. De vorm is gedeeld, de poort
     niet." Vindt de meter daar niets, dan bewijst de nul over zeven
     mechanismen niets over die mechanismen -- alleen iets over de meter. */
  const twee = N.HANDELEN.filter(m => m.naam === 'bijstand' || m.naam === 'servicemachtiging');
  assert.equal(twee.length, 2, 'beide mechanismen staan nog in de lijst');
  const g = om.lees();
  const smal = N.vorm(g.vormen, N.envelopLees(), twee);
  assert.ok(smal.inAlleMechanismen > 0,
    'versmald tot bijstand+servicemachtiging vindt de meter wel gedeelde velden, gevonden: ' +
    smal.inAlleMechanismen);
});

test('2. het naampatroon herkent `async function` -- de vorm waarop het eerder brak', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/vertegenwoordiging/acties.js'), 'utf8');
  const namen = N.namenVan(bron);
  for (const n of ['voorstel', 'aanvaard', 'intrek']) {
    assert.ok(namen.includes(n), '`async function ' + n + '(` wordt herkend als gedeclareerde naam');
  }
  /* En de tegenproef: het patroon leest NIET zomaar elk woord. Een naam die
     alleen in de uitleg van dat bestand staat, mag er niet in zitten -- anders
     is elk werkwoord altijd aanwezig en meet deze as de hoeveelheid commentaar. */
  assert.ok(bron.includes('machtiging'), 'het woord staat wel degelijk in de bron');
  assert.ok(!namen.includes('machtigingsscherm'), 'een woord uit de uitleg is geen gedeclareerde naam');
});

test('3. kern/vertegenwoordiging voert als enige de hele grammatica op naam', () => {
  const w = N.meet().gemeten.werkwoord;
  assert.deepEqual(w.volledigOpNaam, ['vertegenwoordiging'],
    'precies een mechanisme voert alle zeven werkwoorden onder de naam die dit huis eraan geeft');
  assert.equal(w.inAlleMechanismenOpNaam.length, 0,
    'en geen enkel werkwoord staat onder die naam in alle mechanismen');
});

test('4. besturingsproef: ook de RUIME synoniemenlijst kan missen', () => {
  const w = N.meet().gemeten.werkwoord;
  const kanMissen = w.perWerkwoord.filter(x => x.opSynoniem < w.mechanismen);
  assert.ok(kanMissen.length > 0,
    'minstens een werkwoord ontbreekt ook op synoniem; een patroon dat overal raakt is geen instrument. ' +
    'Raakt dit ooit op nul, dan is de synoniemenlijst te ruim geworden en meet deze as niets meer.');
  /* En andersom: de lijst mag niet zo streng zijn dat er niets doorkomt, want
     dan is het verschil tussen naam en synoniem betekenisloos. */
  assert.ok(w.gemiddeldOpSynoniem > w.gemiddeldOpNaam,
    'de ruime lijst vindt aantoonbaar meer dan de strenge; zonder dat verschil zeggen twee assen hetzelfde');
});

test('5. de woordenschat telt identifiers en geen commentaar', () => {
  const r = N.meet();
  const bij = (w) => r.woordenschat.find(x => x.woord === w);
  /* `envelop` is de bekende bezette naam van dit huis (AFSPRAAK.md: de
     gebeurtenisenvelop), dus die MOET bezet uitkomen. Komt hij vrij, dan leest
     de meter de bron niet. */
  assert.equal(bij('envelop').stand, 'bezet', 'kern/envelop.js bestaat, dus `envelop` is bezet');
  assert.ok(bij('envelop').bestanden > 1, 'en hij staat in meer dan een bestand');

  /* De tegenproef op dezelfde as: een verzonnen woord dat NERGENS in de code
     staat moet vrij zijn. Zonder deze helft haalt een meter die alles bezet
     noemt de toets hierboven. */
  const verzonnen = N.woordenschat(['server/kern/envelop.js'], ['zzgeenwoorddatbestaat']);
  assert.equal(verzonnen[0].stand, 'vrij', 'een woord dat nergens staat, komt vrij uit');
});

test('6. het register NAMENSVORM.json klopt met een verse meting', () => {
  const vast = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NAMENSVORM.json'), 'utf8'));
  const vers = N.meet();
  /* Alleen de dragende getallen, niet het hele blok: de treffers bevatten
     namen die bij een onschuldige hernoeming meebewegen, en dan zakt deze
     toets op iets wat geen bevinding is. Wat hier staat is waar
     REPRESENTATIE.md naar verwijst. */
  const klopt = (wat, a, b) => assert.deepEqual(a, b,
    'NAMENSVORM.json loopt achter op de code (' + wat + ') -- draai: npm run namensvorm:vast. ' +
    'REPRESENTATIE.md par. 0 rust op deze getallen, en een verouderde nul ziet er identiek uit aan een verse.');
  klopt('velden in alle mechanismen', vast.gemeten.smal.inAlleMechanismen, vers.gemeten.smal.inAlleMechanismen);
  klopt('velden totaal', vast.gemeten.smal.velden, vers.gemeten.smal.velden);
  klopt('ruim, velden in alle', vast.gemeten.ruim.inAlleMechanismen, vers.gemeten.ruim.inAlleMechanismen);
  klopt('mechanismen met de hele grammatica', vast.gemeten.werkwoord.volledigOpNaam, vers.gemeten.werkwoord.volledigOpNaam);
  klopt('werkwoorden in alle mechanismen', vast.gemeten.werkwoord.inAlleMechanismenOpNaam, vers.gemeten.werkwoord.inAlleMechanismenOpNaam);
});
