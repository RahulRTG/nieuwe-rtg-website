const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { meet, alleToetsen } = require('../scripts/attributie');

function journaal(regels) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-attr-')), 'journaal.log');
  fs.writeFileSync(p, regels.join('\n') + '\n');
  return p;
}

/* De sleutel van dit register is de BESTANDSNAAM van een toets. Werkt die niet,
   dan meet alles hieronder iets anders dan het zegt. */
const EEN = alleToetsen()[0];

test('een toets met kanten in het journaal is waargenomen en draagt geen volle ring', () => {
  const p = journaal(['TOETS GET /api/health ' + EEN, 'SCHERM /apps/app.html ' + EEN + ' navigatie']);
  const uit = meet([p]);
  assert.equal(uit.per[EEN].stand, 'waargenomen');
  assert.equal(uit.per[EEN].kanten, 2);
  assert.equal(uit.per[EEN].volleRing, false);
});

/* DIT IS DE REGEL DIE ERTOE DOET. Een toets die niet in het journaal staat mag
   nooit als "raakt niets aan" gelden -- dat is de vorm waarin een planner een
   toets overslaat omdat de METING ontbrak. */
test('een toets zonder waarneming is ongemeten en draagt WEL een volle ring', () => {
  const uit = meet([journaal(['TOETS GET /api/health ' + EEN])]);
  const ander = alleToetsen().find(t => t !== EEN);
  assert.equal(uit.per[ander].stand, 'ongemeten');
  assert.equal(uit.per[ander].volleRing, true);
  /* en er staat er geen enkele op een stand die versmallen zou toestaan */
  const mag = Object.values(uit.per).filter(v => v.volleRing === false);
  assert.equal(mag.length, 1);
});

test('een kant zonder eigenaar telt apart en wordt aan niemand toegeschreven', () => {
  const uit = meet([journaal(['TOETS GET /api/health onbekend', 'SCHERM /apps/app.html onbekend navigatie'])]);
  assert.equal(uit.gemeten.kantenZonderEigenaar, 2);
  assert.equal(uit.gemeten.waargenomen, 0);
  assert.deepEqual(uit.gemeten.onbekendeNamen, []);
});

test('een naam die geen bestaand toetsbestand is, wordt gemeld en niet stil geteld', () => {
  const uit = meet([journaal(['TOETS GET /api/health verdwenen.test.js'])]);
  assert.deepEqual(uit.gemeten.onbekendeNamen, ['verdwenen.test.js']);
  assert.equal(uit.gemeten.waargenomen, 0);
});

test('een ontbrekend journaal levert geen meting maar een leeg gelezen-veld', () => {
  const uit = meet(['/bestaat/niet/journaal.log']);
  assert.deepEqual(uit.gelezen.journalen, []);
  assert.equal(uit.gelezen.ontbrekend.length, 1);
});

/* De bronbestand-as staat er als TEKORT en niet als nul; zodra iemand hem echt
   meet hoort dit veld te verdwijnen en niet stil op 0 te blijven staan. */
test('de niet-gemeten as wordt benoemd in plaats van als nul gepresenteerd', () => {
  const uit = meet([journaal(['TOETS GET /api/health ' + EEN])]);
  assert.match(uit.nietGemeten.bronbestanden, /niet gemeten/);
});

/* ---- DE METING DIE DE PLANNER MOET VERDIENEN ----

   Deze toets bewaakt geen drempel maar een VORM: zolang er toetsbestanden zijn
   die de statische graaf niet ziet, hoort dat getal te bestaan en groter dan
   nul te zijn. Zakt hij ooit naar nul, dan is dat geweldig nieuws en hoort
   iemand hier te komen kijken of het klopt -- en niet of de meter stuk is. */
const { meet: bereik } = require('../scripts/impactbereik');

test('de blinde vlek van de statische graaf wordt geteld en niet weggelaten', () => {
  const uit = bereik(['server/kern/pay/poort.js']);
  assert.ok(uit.gemeten.toetsbestanden > 1000, 'de noemer is de hele testmap');
  assert.ok(uit.gemeten.zonderRequireKantNaarServer > 0,
    'nul zou betekenen dat elke toets via require aan server/ hangt -- controleer dat voor je dit verwacht');
  assert.equal(typeof uit.gemeten.blindePct, 'number');
  /* En de proef zelf: een impactvraag levert een AANTAL en nooit stilte. */
  assert.equal(uit.proeven.length, 1);
  assert.equal(typeof uit.proeven[0].toetsen, 'number');
});
