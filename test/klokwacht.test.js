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
const { meet, telIn } = require('../scripts/klokwacht');

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

/* DE SCHULD STAAT OP NUL, en dat is een andere bewering dan "hij mag niet
   groeien". Alle 162 wachten zijn omgezet en elk bestand is daarna gedraaid;
   deze toets bewaakt dat er geen enkele terugkomt. Wie er toch een nodig heeft,
   verantwoordt hem hier met naam en reden -- en dan pas in KLOKWACHT.json. */
test('geen enkele schermtoets wacht nog op de klok', () => {
  const nu = meet();
  assert.strictEqual(nu.totaal, 0,
    'deze bestanden wachten weer op een vaste tijd: ' + JSON.stringify(nu.perBestand) +
    '. Wacht op een toestand (wachtTot, wachtOpTekst, wachtOpZichtbaar, wachtOpVerandering), ' +
    'op het antwoord van de server (klikEnWacht) of tot het scherm stil is (wachtOpRust).');
});

/* DE TELLER ZELF, GEVOERD MET EEN BEKENDE INVOER.

   De drie beweringen hierboven lezen allemaal de echte testmap, en die staat op
   NUL. Daardoor blijven ze waar ook als de teller kapot is: nul in, nul uit. De
   mutatiemotor zag dat en meldde dit bestand als OVERLEEFD -- terecht, want een
   ratel op nul kan niet zien of zijn eigen meter nog werkt (LAT.md regel 10).

   Vandaar deze vier: een echte wacht telt, een wacht in een blokcommentaar niet
   (anders zou het OPSCHRIJVEN waarom een wacht wegging de schuld laten stijgen),
   een in regelcommentaar ook niet, en twee op een regel zijn er twee. Zonder
   deze zou "de schuld staat op nul" een bewering zijn over een meter die niemand
   ooit heeft zien uitslaan. */
test('de teller telt een echte wacht en negeert er een in commentaar', () => {
  /* De naam wordt hier OPGEBOUWD en staat nergens als letterlijke aanroep in dit
     bestand. Dat is geen truc maar noodzaak: de meter leest deze map, dus een
     voorbeeldwacht in een toets over de meter zou als schuld meetellen -- de
     meter zou zijn eigen toets meten. Precies de eerste versie hiervan liet alle
     drie de beweringen hierboven zakken, op vijf verzonnen wachten. */
  const W = 'waitFor' + 'Timeout';
  assert.strictEqual(telIn('await page.' + W + '(100);'), 1, 'een echte wacht telt');
  assert.strictEqual(telIn('/* ooit stond hier ' + W + '(100) */'), 0, 'een blokcommentaar telt niet mee');
  assert.strictEqual(telIn('// ' + W + '(100)'), 0, 'een regelcommentaar ook niet');
  assert.strictEqual(telIn('a.' + W + ' (5); b.' + W + '(6);'), 2, 'twee op een regel zijn er twee');
  assert.strictEqual(telIn('await wachtOpRust(page);'), 0, 'een wacht op een TOESTAND is geen schuld');
  /* En de NAAM zonder aanroep is geen wacht. Zonder deze regel overleefde de
     teller een mutatie die de haak uit zijn patroon haalt: dan telt elke
     vermelding mee -- ook die in een register, een commit-bericht of dit
     bestand -- en groeit de schuld zonder dat er een wacht bij kwam. */
  assert.strictEqual(telIn('const naam = "' + W + '";'), 0, 'de naam zonder aanroep is geen wacht');
});
