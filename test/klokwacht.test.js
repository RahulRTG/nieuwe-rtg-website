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
const { meet, telIn, schift } = require('../scripts/klokwacht');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'KLOKWACHT.json');

test('er komen geen nieuwe wachten op de klok bij', () => {
  const vastgelegd = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const nu = meet();
  /* TWEE RATELS, want het zijn twee verschillende vragen -- zie de kop van
     scripts/klokwacht.js. Ze staan hier apart en niet als som: een som laat een
     nieuwe klok in een SCHERMtoets wegvallen tegen een die aan de serverkant
     verdween, en juist die schermkant hoort op nul te blijven.

     Een ontbrekend veld is hier een FOUT en geen nul: toen deze meter van een
     telling naar twee ging, glipte de ratel er even doorheen omdat
     `x > undefined` altijd onwaar is. */
  for (const kant of ['scherm', 'server']) {
    assert.strictEqual(typeof vastgelegd.gemeten[kant], 'number',
      'KLOKWACHT.json mist de telling "' + kant + '"; leg opnieuw vast met npm run klokwacht:vast');
    assert.ok(nu[kant].totaal <= vastgelegd.gemeten[kant],
      'de wachtschuld in de ' + kant + 'toetsen is gestegen van ' + vastgelegd.gemeten[kant] +
      ' naar ' + nu[kant].totaal + ': ' + JSON.stringify(nu[kant].perBestand) +
      '. Wacht op een toestand in plaats van op een tijd -- test/helper.js heeft wachtTot, wachtOpTekst, ' +
      'wachtOpZichtbaar, wachtOpVerandering, wachtOpRust, wachtOpNetstilte en klikEnWacht.');
  }
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

/* DE SCHERMKANT STAAT OP NUL, en dat is een andere bewering dan "hij mag niet
   groeien". Alle 162 wachten van toen zijn omgezet en elk bestand is daarna
   gedraaid; deze toets bewaakt dat er geen enkele terugkomt. Wie er toch een
   nodig heeft, verantwoordt hem hier met naam en reden -- en dan pas in
   KLOKWACHT.json.

   NUL GAAT OVER *.e2e.js EN NIET OVER DE HELE MAP, en dat is geen versoepeling
   maar een correctie. Deze bewering stond hier op `nu.totaal`, en dat leek te
   kloppen omdat de meter maar EEN spelling kende (`waitForTimeout`). Zodra hij
   ook `await new Promise(r => setTimeout(...))` telde, bleken er 92 in de
   SERVERtoetsen te staan die de nul nooit hadden geraakt. Die 92 zijn geen
   verzuim van deze ronde; ze waren er al en werden niet gezien. Wat ze wel of
   niet zijn, staat in de kop van scripts/klokwacht.js -- een deel wacht daar op
   een ECHTE klok in het product. De ratel hierboven houdt ze vast. */
test('geen enkele schermtoets wacht nog op de klok', () => {
  const nu = meet();
  assert.strictEqual(nu.scherm.totaal, 0,
    'deze schermtoetsen wachten weer op een vaste tijd: ' + JSON.stringify(nu.scherm.perBestand) +
    '. Wacht op een toestand (wachtTot, wachtOpTekst, wachtOpZichtbaar, wachtOpVerandering), ' +
    'op het antwoord van de server (klikEnWacht), tot het scherm stil is (wachtOpRust) ' +
    'of tot de pagina is uitgepraat (wachtOpNetstilte).');
});

/* EN DE SPLITSING ZELF, gevoerd met een bekende invoer. Zonder deze zou de
   scheiding scherm/server een bewering zijn over code die niemand ooit heeft
   zien schiften -- en dan kan een mutatie die alles in een van de twee bakken
   gooit ongemerkt door de ratel heen. */
test('de meter schift schermtoetsen van servertoetsen', () => {
  /* MET EEN VERZONNEN BAK, en niet met de echte map. De echte schermkant staat
     op nul, en over een lege bak is alles waar: een mutatie die de schifting
     uitzette (alles naar de serverbak) overleefde deze toets toen hij nog
     meet() las. Nu zit er aan beide kanten iets in. */
  const uit = schift({ 'aap.e2e.js': 3, 'noot.e2e.js': 1, 'mies.test.js': 5, 'wim.pg.test.js': 2 });
  assert.strictEqual(uit.scherm.totaal, 4, 'de twee schermtoetsen samen');
  assert.strictEqual(uit.server.totaal, 7, 'en de twee servertoetsen samen');
  assert.strictEqual(uit.scherm.bestanden, 2);
  assert.strictEqual(uit.server.bestanden, 2);
  assert.strictEqual(uit.totaal, 11, 'de twee bakken tellen op tot het geheel');
  assert.deepStrictEqual(Object.keys(uit.scherm.perBestand), ['aap.e2e.js', 'noot.e2e.js']);

  // en op de echte map: elke naam staat in de bak waar hij hoort
  const nu = meet();
  assert.strictEqual(nu.scherm.totaal + nu.server.totaal, nu.totaal);
  for (const naam of Object.keys(nu.scherm.perBestand)) assert.match(naam, /\.e2e\.js$/);
  for (const naam of Object.keys(nu.server.perBestand)) assert.match(naam, /(?<!\.e2e)\.test\.js$/);
  assert.ok(nu.server.totaal > 0, 'de serverkant is niet leeg; anders zegt de schifting niets');
});

/* DE TELLER ZELF, GEVOERD MET EEN BEKENDE INVOER.

   De drie beweringen hierboven lezen allemaal de echte testmap, en die staat op
   NUL. Daardoor blijven ze waar ook als de teller kapot is: nul in, nul uit. De
   mutatiemotor zag dat en meldde dit bestand als OVERLEEFD -- terecht, want een
   ratel op nul kan niet zien of zijn eigen meter nog werkt (LAT.md regel 10).

   Vandaar deze rij: een echte wacht telt, een wacht in een blokcommentaar niet
   (anders zou het OPSCHRIJVEN waarom een wacht wegging de schuld laten stijgen),
   een in regelcommentaar ook niet, en twee op een regel zijn er twee. Zonder
   deze zou "de schuld staat op nul" een bewering zijn over een meter die niemand
   ooit heeft zien uitslaan.

   En sinds de meter drie spellingen kent, staan die er ook in -- mét de drie
   dingen die er juist NIET onder vallen. Dat is hier het scherpst: de eerste
   versie van de verbreding telde poll-lussen en stubs mee, en dan meet je
   mensen aan het slopen van werkende code. */
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

  /* DE TWEEDE EN DERDE SPELLING. De meter kende ze lang niet, en meldde daarom
     NUL terwijl er 92 stonden -- een meter die een spelling meet in plaats van
     het probleem. Deze regels houden vast dat hij ze alle drie ziet, en net zo
     belangrijk: welke er NIET bij horen. Een sleep achter een voorwaarde of als
     eerste regel in een lus is een met de hand geschreven POLL, en die eruit
     tellen is geen versoepeling maar het verschil dat deze meter bewaakt --
     anders zet hij mensen aan een werkende poll te slopen. */
  const NP = 'new Prom' + 'ise', ST = 'set' + 'Timeout';   // zelfde reden als W hierboven
  const SLEEP = NP + '(r => ' + ST + '(r, 900))';
  assert.strictEqual(telIn('await ' + SLEEP + ';'), 1,
    'de kale sleep is dezelfde wacht met een andere spelling');
  assert.strictEqual(telIn('const w = (ms) => ' + NP + '(r => ' + ST + '(r, ms));\nawait w(1500);\nawait w(2500);'), 2,
    'een eigen hulpje met een naam blijft een klokwacht, en elke aanroep telt');
  assert.strictEqual(telIn('const w = ms => ' + NP + '(r => ' + ST + '(r, ms));\nawait w(1500);'), 1,
    'ook zonder haakjes om de parameter -- die vorm telde de meter eerst als nul');
  /* EEN SLEEP IN EEN LUS IS EEN POLL, en een sleep daarbuiten is een gok. Die
     ene regel verving twee halve ("achter een voorwaarde", "de eerste regel in
     een lus"), die allebei per ongeluk smal waren: ze misten de tik ONDERAAN
     een pollus -- precies de vorm die je krijgt als je het netjes doet. En ze
     golden alleen voor de kale sleep, waardoor een poll met een eigen naampje
     wel meetelde. Beide fouten wijzen dezelfde kant op: de meter zette mensen
     aan een werkende poll te slopen. */
  const LUS = 'for (;;) {\n  if (klaar()) return;\n';
  assert.strictEqual(telIn(LUS + '  await ' + SLEEP + ';\n}'), 0,
    'de tik ONDERAAN een pollus is de cadans van die poll');
  assert.strictEqual(telIn('for (let i = 0; i < 20; i++) {\n  await ' + SLEEP + ';\n}'), 0,
    'en bovenaan net zo goed');
  assert.strictEqual(telIn('while (!klaar) {\n  kijk();\n  await ' + SLEEP + ';\n}'), 0,
    'een while-lus telt ook als lus');
  assert.strictEqual(telIn('if (!klaar) await ' + SLEEP + ';'), 1,
    'maar een sleep achter een voorwaarde ZONDER lus eromheen blijft een gok');

  // en dat geldt voor beide spellingen
  const HULP = 'const even = ms => ' + NP + '(r => ' + ST + '(r, ms));\n';
  assert.strictEqual(telIn(HULP + 'for (let i = 0; i < 60 && !klaar; i++) await even(50);'), 0,
    'een poll met een eigen naampje is geen klokwacht');
  assert.strictEqual(telIn(HULP + 'while (!klaar) {\n  await even(50);\n}'), 0,
    'ook in een while-lus niet');
  assert.strictEqual(telIn(HULP + 'await even(200);'), 1,
    'maar de kale aanroep telt gewoon mee');
  assert.strictEqual(telIn('page.route(u, () => ' + NP + '(r => ' + ST + '(() => r(echt()), 1200)));'), 0,
    'een trage server NABOOTSEN in de pagina is een fixture, geen wacht van de toets');
  /* En de NAAM zonder aanroep is geen wacht. Zonder deze regel overleefde de
     teller een mutatie die de haak uit zijn patroon haalt: dan telt elke
     vermelding mee -- ook die in een register, een commit-bericht of dit
     bestand -- en groeit de schuld zonder dat er een wacht bij kwam. */
  assert.strictEqual(telIn('const naam = "' + W + '";'), 0, 'de naam zonder aanroep is geen wacht');
});
