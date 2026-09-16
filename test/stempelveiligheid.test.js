/* KAN EEN METER REPO-WAARHEID SCHRIJVEN DIE NIEMAND HEEFT GEVRAAGD?

   Deze toetsen bewaken de METER en niet de scripts die hij telt. Dat is met
   opzet: de getallen mogen bewegen (er komen generatoren bij, er gaan grendels
   op), maar de meter mag niet blind worden. Een klasse die naar nul zakt doordat
   het instrument niets meer ziet, leest als vooruitgang en is het niet.

   De dragende toets is nummer 4. Deze meter heeft zichzelf tijdens het bouwen
   DRIE keer beetgenomen, elke keer op dezelfde manier -- semantiek afleiden uit
   de vorm van code -- en elke keer in een andere richting:

     een regexliteraal `/writeFileSync\(/` geteld als schrijfplek   (vals alarm)
     tekst weggehaald, waardoor de VLAG onzichtbaar werd            (vals alarm)
     het woord eisSchoneBoom in een eigen ZIN gelezen als grendel   (vals VEILIG)

   De derde is de gevaarlijkste en de enige die niemand was opgevallen: hij
   keurde zijn eigen bestand goed. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const sv = require('../scripts/stempelveiligheid.js');
const u = sv.meet();

test('1. de vijf klassen sluiten elkaar uit en dekken alle schrijvers', () => {
  const som = Object.values(u.klassen).reduce((a, b) => a + b, 0);
  assert.equal(som, u.schrijvers,
    'de klassen tellen niet op tot het aantal schrijvers; dan valt er iets tussen of dubbel. ' +
    JSON.stringify(u.klassen));
  for (const r of u.rijen) {
    assert.ok(Object.prototype.hasOwnProperty.call(u.klassen, r.klasse), r.naam + ': onbekende klasse');
    assert.ok(r.waarom && r.waarom.length > 20, r.naam + ': een klasse zonder reden is een etiket');
  }
});

test('2. DE ZELFIJKING: het bekende geval wordt gevonden', () => {
  /* Het incident van 15 september: npm run ci:lokaal op een vuile boom schreef
     ROLRONDE.json met boomVuil: true, en git add -A veegde hem mee. */
  assert.equal(u.ijking.gevondenInKlasse, true,
    'scripts/rolronde.js staat niet meer in KAN_COMMITBEWIJS_ONGELDIG_MAKEN. Dat is OF een echte ' +
    'reparatie aan dat script OF een meter die blind is geworden -- kijk welke van de twee ' +
    'voordat je dit getal als vooruitgang leest.');
  assert.equal(u.ijking.gevondenInDoorsnede, true,
    'rolronde.js zit in de klasse maar niet in de doorsnede. Precies dat was de eerste versie van ' +
    'deze meter: hij miste het geval waarvoor hij was gebouwd, omdat ci-lokaal.js zijn poorten uit ' +
    '.github/workflows haalt en niet uit package.json.');
});

test('3. de doorsnede meet iets ANDERS dan de klasse', () => {
  /* scripts/ci-lokaal.js noemt zelf drie schrijvers. Twee zijn vanuit een poort
     bereikbaar, de ladder niet -- en juist dat verschil laat zien dat de
     doorsnede geen tweede naam voor de klasse is. */
  const d = u.ijking.drieUitCiLokaal;
  assert.equal(d['rolronde.js'].inDoorsnede, true);
  assert.equal(d['gluurronde.js'].inDoorsnede, true);
  assert.equal(d['bewijsladder.js'].inDoorsnede, false,
    'de ladder staat in de doorsnede terwijl hij nergens vanuit een poort bereikbaar is; dan is ' +
    'de doorsnede hetzelfde geworden als de klasse en meet hij niets extras');
  assert.ok(u.inEenPoort.length < (u.klassen.KAN_COMMITBEWIJS_ONGELDIG_MAKEN || 0),
    'de doorsnede is even groot als de klasse; dan is de poortvraag geen onderscheid');
});

test('4. DRAGEND: de meter trapt niet in de drie vormen waarin hij zelf trapte', () => {
  const eigen = u.rijen.find(r => r.naam === 'stempelveiligheid.js');
  assert.ok(eigen, 'de meter telt zichzelf niet mee; een instrument dat buiten zijn eigen bereik ' +
    'valt, kan zijn eigen fout niet vinden');
  /* VALS VEILIG. Dit bestand noemt eisSchoneBoom in een zin, en roept hem niet
     aan. Zolang hij op VUILE_BOOM_TOEGESTAAN staat, leest de meter de AANROEP
     en niet het woord. */
  assert.equal(eigen.grendelt, false,
    'deze meter meldt van zichzelf dat hij grendelt. Hij doet dat niet -- het woord staat alleen in ' +
    'een toelichting. Dit is de fout die op 15 september 2026 echt is gemaakt, en zij is vals ' +
    'VEILIG: elk script kan de risicoklasse ontlopen door het woord ergens te noemen.');
  assert.equal(eigen.klasse, 'VUILE_BOOM_TOEGESTAAN');

  /* VALS ALARM 1: een regexliteraal is geen aanroep. scripts/bewijsladder.js is
     een meter OVER writeFileSync. */
  const ladder = u.rijen.find(r => r.naam === 'bewijsladder.js');
  assert.equal(ladder.schrijfplekken, 1,
    'bewijsladder.js telt ' + ladder.schrijfplekken + ' schrijfplekken. Hij heeft er een; de rest ' +
    'zijn regexliteralen die het WOORD writeFileSync dragen omdat dat zijn onderwerp is.');

  /* VALS ALARM 2: de vlag IS een tekst, dus hij mag niet worden weggestreept
     voordat ernaar wordt gezocht. */
  assert.equal(ladder.achterVlag, 1,
    'de vlag boven de schrijfregel van bewijsladder.js wordt niet gezien. Dat gebeurde toen de ' +
    'aanroep en de vlag in DEZELFDE, van tekst ontdane regels werden gezocht: 17 scripts ' +
    'verhuisden naar de risicoklasse zonder dat er een letter aan veranderde.');
  assert.ok((u.klassen.VUILE_BOOM_TOEGESTAAN || 0) > 10,
    'de bak VUILE_BOOM_TOEGESTAAN is vrijwel leeg; dat is het beeld dat ontstaat als de ' +
    'vlagdetectie stuk is, en het ziet eruit als een huis vol risico');
});

test('5. de meter draagt zijn eigen grens en graad', () => {
  assert.equal(u.graad, 'vermoed', 'lexicaal gemeten heet vermoed en niet gemeten');
  assert.match(u.grens, /ONDERgrens/);
  assert.match(u.grens, /werklijst en geen aanklacht/,
    'de grens zegt niet dat de risicoklasse een werklijst is; zonder die zin leest een lijst van ' +
    'vijftig scripts als een lijst van vijftig fouten');
  assert.ok(u.incident && u.incident.length > 40, 'de aanleiding staat er niet bij');
});

test('6. de drie blinde vlekken, elk met een VERZONNEN getuige', () => {
  /* Twee van de drie hebben vandaag geen echt voorbeeld in scripts/. Een
     grendel zonder getuige is een bewering: deze toets levert de getuigen zelf,
     zodat alle drie beproefd zijn en niet alleen die ene die toevallig
     voorkomt. */
  const q = String.fromCharCode(39);

  /* a. EEN REGEXLITERAAL IS GEEN AANROEP. (echt voorbeeld: bewijsladder.js) */
  const regexbron = 'for (const m of bron.matchAll(/writeFileSync\\(\\s*([^,]+),/g)) { tel++; }';
  assert.equal(sv.opVerzoek(regexbron).plekken, 0,
    'een regex die het WOORD writeFileSync draagt telt als schrijfplek');

  /* b. HET WOORD IN EEN STRING IS GEEN AANROEP. (vandaag geen echt voorbeeld) */
  const tekstbron = 'const uitleg = ' + q + 'deze meter telt writeFileSync(' + q + ';';
  assert.equal(sv.opVerzoek(tekstbron).plekken, 0,
    'het woord writeFileSync binnen een string telt als schrijfplek. Dit is de vorm waar geen ' +
    'enkel bestaand script een voorbeeld van is -- daarom staat hij hier verzonnen.');

  /* c. EN EEN ECHTE AANROEP TELT WEL. De besturingsproef: zonder deze regel
     slaagt alles hierboven ook bij een meter die NIETS meer ziet. */
  assert.equal(sv.opVerzoek('fs.writeFileSync(DOEL, x);').plekken, 1, 'een echte aanroep wordt gemist');
  assert.equal(sv.opVerzoek('  writeFileSync(DOEL, x);').plekken, 1,
    'een aanroep zonder fs-voorvoegsel (uit een destructurering) wordt gemist');

  /* d. DE VLAG IS ZELF EEN TEKST en mag dus niet zijn weggestreept. */
  const metVlag = 'if (process.argv.includes(' + q + '--vastleggen' + q + ')) {\n' +
    '  fs.writeFileSync(DOEL, x);\n}';
  const m = sv.opVerzoek(metVlag);
  assert.equal(m.plekken, 1);
  assert.equal(m.achterVlag, 1,
    'de vlag boven de schrijfregel wordt niet gezien; dan verhuist elk net script naar de ' +
    'risicoklasse zonder dat er iets aan veranderd is');
  assert.equal(m.alle, true);

  /* e. EN EEN VLAG DIE BIJ IETS ANDERS HOORT, TELT NIET. */
  const vlagElders = 'if (process.argv.includes(' + q + '--vastleggen' + q + ')) { log(); }\n' +
    'function later() {\n  fs.writeFileSync(DOEL, x);\n}';
  assert.equal(sv.opVerzoek(vlagElders).achterVlag, 0,
    'een vlag die boven een ANDERE functie staat, dekt deze schrijfregel; dan is de vlagvraag ' +
    '"staat het woord ergens in het bestand" en dat is geen grendel');
});
