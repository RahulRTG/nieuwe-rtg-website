/* ============================================================================
   DE WACHTSCHULD MAG ALLEEN KRIMPEN (scripts/klokwacht.js, KLOKWACHT.json).

   WAAROM DEZE RATEL ER IS. Een schermtoets die `waitForTimeout(2500)` doet,
   wacht op de klok in plaats van op wat er moet gebeuren. Dat is op een rustige
   machine te lang en onder belasting te kort, en dat tweede kost een rode
   uitslag zonder dat er iets stuk is. TAKEN.md 6.5 beschrijft twee keer een
   halve dag zoeken naar precies die fout.

   Het waren er 162. Ze zijn niet in een zoek-vervang-ronde weggewerkt: de drie
   zwaarste bestanden (livinglab 41, horecaschermen 36, werkscherm 15) zijn stuk
   voor stuk omgezet, en elk daarvan legde een race bloot die de vaste wachttijd
   toedekte. De rest staat geteld in KLOKWACHT.json.

   Deze toets bewaakt alleen de RICHTING. Wie een nieuwe klok toevoegt, ziet
   hier rood; wie er een weghaalt, legt de nieuwe stand vast met
   `npm run klokwacht:vast`.

   Draai los: node --test test/klokwacht.test.js
   ========================================================================== */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { meet } = require('../scripts/klokwacht');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'KLOKWACHT.json');

test('er komen geen nieuwe wachten op de klok bij', () => {
  const vastgelegd = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const nu = meet();
  assert.ok(nu.totaal <= vastgelegd.gemeten.totaal,
    'de wachtschuld is gestegen van ' + vastgelegd.gemeten.totaal + ' naar ' + nu.totaal +
    '. Wacht op een toestand in plaats van op een tijd -- test/helper.js heeft wachtTot, wachtOpTekst, ' +
    'wachtOpZichtbaar, wachtOpVerandering, wachtOpRust en klikEnWacht.');
});

test('het register noemt de bestanden die het nog doen, en klopt met de meting', () => {
  const vastgelegd = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const nu = meet();
  /* Een register dat namen bevat die niet meer bestaan, groeit stil vol en
     leest als schuld die er niet meer is -- dezelfde eis als bij de andere
     registers in dit huis. */
  for (const naam of Object.keys(vastgelegd.schuld || {})) {
    if (!nu.perBestand[naam]) continue;   // opgeruimd is prima
    assert.ok(nu.perBestand[naam] <= vastgelegd.schuld[naam],
      naam + ' heeft er ' + nu.perBestand[naam] + ' terwijl er ' + vastgelegd.schuld[naam] + ' waren vastgelegd');
  }
  const nieuwe = Object.keys(nu.perBestand).filter(n => !(vastgelegd.schuld || {})[n]);
  assert.deepStrictEqual(nieuwe, [],
    'deze bestanden wachten op de klok en staan niet in het register: ' + nieuwe.join(', '));
});

/* En de omgezette bestanden blijven omgezet: wie daar een klok terugzet, komt
   niet weg met "het register stond het toe". */
test('de drie omgezette schermtoetsen blijven zonder klok', () => {
  for (const naam of ['livinglab.e2e.js', 'horecaschermen.e2e.js', 'werkscherm.e2e.js']) {
    const bron = fs.readFileSync(path.join(WORTEL, 'test', naam), 'utf8');
    assert.ok(!/waitForTimeout\s*\(/.test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
      naam + ' wacht weer op de klok; deze drie zijn met de hand omgezet en horen zo te blijven');
  }
});
