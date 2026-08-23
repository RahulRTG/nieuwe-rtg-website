/* EEN KAS DIE KAN LIEGEN IS ERGER DAN GEEN KAS.

   server/lib/bronkas.js bewaart de uitkomst van dure broncodescanners tussen
   serverstarts door. Dat scheelt 1,3 seconde op een boot van 3,3 -- en de suite
   start 647 servers. Maar een cache is alleen iets waard als hij aantoonbaar
   niet achter kan lopen, en een van de afnemers is een VEILIGHEIDSregister:
   lib/ui-bronnen.js bepaalt welke tekst naar een modelaanbieder mag. Een stille
   verouderde uitkomst is daar geen traagheid maar een gat.

   Vier beweringen, en alle vier met een mutatie nagelopen:

     1. wat eruit komt is gelijk aan vers uitrekenen
     2. EEN gewijzigde byte in de bron maakt de kas ongeldig
     3. een kapotte kas valt terug op rekenen, hij dient nooit rommel op
     4. de kas wordt ook echt geraakt (anders is het dode code die je wel
        elke start betaalt -- LAT-regel 10)

   IN EEN KINDPROCES, en dat is geen omweg. manifestVan() onthoudt zijn uitkomst
   PER PROCES: binnen een draaiende server hoort de broncodestand van de start te
   gelden en niet die van halverwege. Een invalidatietoets die in hetzelfde
   proces een bestand aanpast zou dus altijd slagen om de verkeerde reden. Een
   verse start is precies wat er in het echt gebeurt.

   Draai los: node --experimental-sqlite --test test/bronkas.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const kas = require('../server/lib/bronkas');
const KASBRON = path.join(WORTEL, 'server', 'lib', 'bronkas.js');

/* Een piepklein nepboompje plus een teller, in een eigen proces. Geeft terug
   hoe vaak er ECHT gerekend is en wat eruit kwam. TMPDIR wijst naar een eigen
   map, zodat deze proef nooit de kas van een echte serverstart aanraakt. */
/* De paden gaan als ARGUMENT mee en niet ingebakken in de codetekst. Dat is
   niet alleen netter: check.js scant op een require met iets anders dan een
   lokaal pad erin, en een samengeplakte string ziet er precies zo uit. Een
   regel die op een toets vals alarm slaat, leert niemand meer iets. */
const KINDCODE = [
  'const [kasbron, boom] = process.argv.slice(1);',
  'const kas = require(kasbron);',
  'const fs = require("fs");',
  'let gerekend = 0;',
  'const sleutel = kas.sleutelUit([kas.manifestVan(boom, p => p.endsWith(".txt"), "proef"), "v1"]);',
  'const uit = kas.geheugen({',
  '  wortel: boom, naam: "proef", sleutel,',
  '  bereken: () => { gerekend++; return fs.readdirSync(boom).sort().join(","); },',
  '  naarTekst: (s) => s, vanTekst: (t) => t',
  '});',
  'console.log(JSON.stringify({ uit, gerekend, sleutel: sleutel.slice(0, 12), tellers: kas.tellers }));'
].join('\n');

function draaiInKind(boom, kasHome) {
  const uit = execFileSync(process.execPath, ['-e', KINDCODE, KASBRON, boom], {
    encoding: 'utf8', env: Object.assign({}, process.env, { TMPDIR: kasHome })
  });
  return JSON.parse(uit.trim().split('\n').pop());
}

function metBoom(doe) {
  const boom = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kasproef-'));
  const kasHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kashome-'));
  try { return doe(boom, kasHome); }
  finally { for (const d of [boom, kasHome]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } }
}

test('1+4: de eerste start rekent, de tweede haalt hem uit de kas met dezelfde uitkomst', () => {
  metBoom((boom, kasHome) => {
    fs.writeFileSync(path.join(boom, 'a.txt'), 'aaa');
    fs.writeFileSync(path.join(boom, 'b.txt'), 'bbb');
    const een = draaiInKind(boom, kasHome);
    const twee = draaiInKind(boom, kasHome);
    assert.equal(een.gerekend, 1, 'de eerste start hoort echt te rekenen');
    assert.equal(twee.gerekend, 0, 'de tweede start hoort NIETS te rekenen; anders is de kas dode code');
    assert.equal(twee.uit, een.uit, 'uit de kas komt een andere uitkomst dan vers uitgerekend');
    assert.equal(twee.tellers.raak, 1, 'de tweede start telt een treffer');
    assert.equal(een.tellers.raak, 0, 'de eerste start kan geen treffer hebben');
  });
});

test('2: EEN gewijzigde byte in de bron maakt de kas ongeldig, ook met dezelfde mtime', () => {
  metBoom((boom, kasHome) => {
    fs.writeFileSync(path.join(boom, 'a.txt'), 'aaa');
    const een = draaiInKind(boom, kasHome);
    assert.equal(draaiInKind(boom, kasHome).gerekend, 0, 'onveranderd hoort hij uit de kas te komen');

    /* Een byte, en de mtime bewust TERUGGEZET naar die van voor de wijziging.
       Dat is de proef op de som: een kas die op mtime vertrouwt zou hier de
       oude uitkomst opdienen. Deze hangt aan de inhoud, dus hij hoort te
       rekenen -- en dat is precies waarom die 112 ms hashen er zijn. */
    const p = path.join(boom, 'a.txt');
    const oudeTijd = fs.statSync(p).mtime;
    fs.writeFileSync(p, 'aab');
    fs.utimesSync(p, oudeTijd, oudeTijd);
    assert.equal(fs.statSync(p).mtime.getTime(), oudeTijd.getTime(), 'de mtime staat echt terug');

    const na = draaiInKind(boom, kasHome);
    assert.equal(na.gerekend, 1, 'een gewijzigde byte MOET opnieuw laten rekenen, ook met dezelfde mtime');
    assert.notEqual(na.sleutel, een.sleutel, 'de sleutel hoort mee te veranderen met de inhoud');
  });
});

test('2b: een bestand erbij of eraf maakt de kas ook ongeldig', () => {
  metBoom((boom, kasHome) => {
    fs.writeFileSync(path.join(boom, 'a.txt'), 'aaa');
    draaiInKind(boom, kasHome);
    fs.writeFileSync(path.join(boom, 'c.txt'), 'ccc');
    assert.equal(draaiInKind(boom, kasHome).gerekend, 1, 'een bestand erbij hoort de sleutel te veranderen');
    fs.unlinkSync(path.join(boom, 'c.txt'));
    assert.equal(draaiInKind(boom, kasHome).gerekend, 0, 'en terug naar de oude stand vindt de oude kas weer');
  });
});

/* Twee soorten kapot, en ze worden door twee verschillende dingen gepakt.

   De eerste versie van deze toets schreef er alleen ' half geschreven ' in. Dat
   ziet de kas al aan de VORM -- er staat geen regeleinde op plek 64 -- en de
   integriteitskop komt er niet eens aan te pas. Dat bleek toen ik die kop met
   een mutatie weghaalde en de toets gewoon groen bleef: AFGESLAGEN, en dus een
   toets die zijn eigen bewering niet dekte (LAT-regel 9).

   De tweede soort is de gevaarlijke: een kasbestand met een PERFECT geldige
   vorm waarvan alleen de inhoud niet meer klopt. Een halve schrijfactie op een
   volle schijf ziet er zo uit, en zonder de sha op de eerste regel komt daar
   een antwoord uit dat er goed uitziet en het niet is. */
test('3: een kapotte kas valt terug op rekenen en dient geen rommel op', () => {
  metBoom((boom, kasHome) => {
    fs.writeFileSync(path.join(boom, 'a.txt'), 'aaa');
    const een = draaiInKind(boom, kasHome);
    const map = path.join(kasHome, path.basename(kas.kasMap(boom)));
    const bestanden = fs.readdirSync(map).filter(n => n.endsWith('.kas'));
    assert.equal(bestanden.length, 1, 'er hoort precies een kasbestand te staan, gevonden: ' + bestanden.join(', '));
    const kasBestand = path.join(map, bestanden[0]);
    const echt = fs.readFileSync(kasBestand, 'utf8');

    // (a) onherkenbare vorm: dit hoort de vormcontrole al te pakken
    fs.writeFileSync(kasBestand, ' half geschreven ');
    assert.equal(draaiInKind(boom, kasHome).uit, een.uit, 'een vormloze kas mag geen andere uitkomst geven');

    // (b) GELDIGE vorm, verkeerde inhoud -- alleen de sha op regel een ziet dit
    const kop = echt.slice(0, echt.indexOf('\n'));
    assert.equal(kop.length, 64, 'de kop hoort een sha256 in hex te zijn');
    fs.writeFileSync(kasBestand, kop + '\n' + 'zzz-heel-iets-anders');
    const na = draaiInKind(boom, kasHome);
    assert.equal(na.uit, een.uit,
      'een kasbestand met een geldige kop maar verkeerde inhoud werd opgediend: de kas controleert zijn eigen inhoud niet');
    assert.equal(na.gerekend, 1, 'en hij hoort dat opnieuw uit te rekenen in plaats van iets te verzinnen');
  });
});

/* En de echte afnemer, want de proef hierboven gaat over het mechanisme en niet
   over het register dat ermee beschermd wordt. Koud en warm moeten precies
   dezelfde deur open en dicht doen -- ook voor tekst die er NIET in hoort. */
test('het UI-register geeft koud en warm hetzelfde antwoord, ook op wat NIET mag', () => {
  const kasHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uikas-'));
  try {
    const code = [
      'const [uibron, kasbron, publicDir] = process.argv.slice(1);',
      'const { maakUiBronnen } = require(uibron);',
      'const kas = require(kasbron);',
      'const u = maakUiBronnen(publicDir, []);',
      'const monsters = ["Opslaan", "Annuleren", "zzdit-is-geen-ui-tekst-" + "a".repeat(40)];',
      'console.log(JSON.stringify({ aantal: u.aantal, oordeel: monsters.map(m => u.toegestaan(m)), raak: kas.tellers.raak }));'
    ].join('\n');
    const argumenten = [path.join(WORTEL, 'server', 'lib', 'ui-bronnen.js'), KASBRON, path.join(WORTEL, 'public')];
    const proef = () => JSON.parse(execFileSync(process.execPath, ['-e', code].concat(argumenten), {
      encoding: 'utf8', env: Object.assign({}, process.env, { TMPDIR: kasHome })
    }).trim().split('\n').pop());

    const koud = proef();
    const warm = proef();
    assert.equal(koud.raak, 0, 'de eerste start kan geen treffer hebben');
    assert.equal(warm.raak, 1, 'de tweede start hoort het register uit de kas te halen');
    assert.equal(warm.aantal, koud.aantal, 'het register verandert van omvang tussen koud en warm');
    assert.deepEqual(warm.oordeel, koud.oordeel, 'het register oordeelt anders na een kastreffer');
    assert.equal(koud.oordeel[2], false,
      'een verzonnen tekst hoort NIET toegestaan te zijn -- zonder deze regel bewijst de vergelijking hierboven niets');
    assert.ok(koud.aantal > 1000, 'het register hoort echt gevuld te zijn (' + koud.aantal + ')');
  } finally { try { fs.rmSync(kasHome, { recursive: true, force: true }); } catch (e) {} }
});

test('5: de kas groeit niet onbeperkt -- hoogstens drie standen per soort', () => {
  metBoom((boom, kasHome) => {
    /* Zes verschillende broncodestanden achter elkaar. Zonder opruimen staan er
       daarna zes kasbestanden; een broncodestand kost in het echt 16 MB, dus
       dat is geen netheid maar het verschil tussen een versnelling en een lek. */
    for (let i = 0; i < 6; i++) {
      fs.writeFileSync(path.join(boom, 'a.txt'), 'stand-' + i);
      draaiInKind(boom, kasHome);
    }
    const map = path.join(kasHome, path.basename(kas.kasMap(boom)));
    const over = fs.readdirSync(map).filter(n => n.endsWith('.kas'));
    assert.equal(over.length, 3, 'na zes standen horen er drie te staan, gevonden: ' + over.length);

    /* En de NIEUWSTE hoort erbij te zitten: opruimen dat de verkeerde weggooit
       maakt de kas per saldo trager in plaats van kleiner. */
    fs.writeFileSync(path.join(boom, 'a.txt'), 'stand-5');
    assert.equal(draaiInKind(boom, kasHome).gerekend, 0,
      'de laatste stand hoort bewaard te zijn gebleven; anders ruimt hij de verkeerde op');
  });
});

test('de kas schrijft nooit in de repository', () => {
  assert.ok(!kas.kasMap(WORTEL).startsWith(path.resolve(WORTEL) + path.sep),
    'de kas hoort in os.tmpdir() te staan en niet in de broncodeboom (check.js regel 51)');
  assert.ok(kas.kasMap(WORTEL).startsWith(os.tmpdir()), 'de kas hoort onder de tijdelijke map te vallen');
});
