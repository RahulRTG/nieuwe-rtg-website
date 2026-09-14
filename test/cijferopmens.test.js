/* CAR-05 OVER DE HELE CARRIEREKANT -- er komt geen cijfer op een mens.

   DEZE TOETS BESTAAT OMDAT DE GRENS VIER DOCUMENTEN HAD EN EEN HANDHAVER, en die
   ene dekte precies EEN map. CARRIERE.md par. 4.1 zegt er met zoveel woorden bij
   wanneer hij hoort te komen: *als toets VOOR de eerste carrieremeter, niet
   erna*. Toen kern/rugdekking erbij kwam, gold de grens daar even hard en hield
   hem niets tegen; met het ledger erbij zou dat de derde map zijn.

   DE WOORDENLIJST STAAT OP EEN PLEK (scripts/lib/cijferopmens.js). Drie kopieen
   van een regexp zijn binnen een maand drie verschillende regexps (LAT.md regel
   4), en dan is de strengste de enige die iets zegt terwijl niemand weet welke
   dat is.

   TOETS 1 IS EEN ZELFIJKING EN GEEN FORMALITEIT. Een scan die niets KAN vinden,
   staat groen om dezelfde reden als een scan die niets vindt -- en die twee zijn
   van buiten niet te onderscheiden. Dezelfde vorm als test/getallen.test.js.

   Draai los: node --test test/cijferopmens.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WOORDEN, grensScan, mensVrij } = require('../scripts/lib/cijferopmens');

/* De hele kant van het huis waar een mens die van zijn talent leeft woont. Wie
   er een map bij bouwt, zet hem hier bij -- toets 3 zakt als een bestaande map
   verdwijnt, maar hij kan niet weten dat er een is BIJGEKOMEN.

   DE FOUNDATION EN SCHOOL STAAN ER SINDS 14 SEPTEMBER BIJ, en dat is geen
   uitbreiding van de grens maar het uitvoeren ervan. De kop van
   scripts/lib/cijferopmens.js noemt vier documenten; FOUNDATION.md par. 5 en
   HDI.md par. 5 zeggen hetzelfde in nog twee, en SCHOOL.md par. 11.1 verbiedt
   met zoveel woorden een risicoscore, een uitvalkans en een ranglijst. De grens
   gold daar dus al en werd er door niets tegengehouden -- exact de vorm waarin
   deze toets zelf is ontstaan ("de grens had vier documenten en een handhaver,
   en die ene dekte precies een map").

   WAT ER MET OPZET NOG NIET BIJ STAAT, met de meting erbij, want een map
   weglaten zonder reden is een stille uitzondering:

   EN LET OP HOE DIE LIJST TOT STAND KWAM. De eerste poging zette er `leven` en
   `gezin` in, want een losse scan meldde daar 0 treffers. Die mappen BESTAAN
   NIET: `grensScan` geeft een onbestaande map terug in `ontbreekt` en niet in
   `gevonden`, en wie alleen `gevonden.length` afdrukt leest "0" als "schoon".
   Toets 3 viel er meteen over -- precies waarvoor de `ontbreekt`-helft is
   gebouwd. De echte Foundation-mappen heten levensband, levensbeleid,
   levensdossier, levensgraaf, levenslijn en socialegraaf, en die staan alle zes
   op nul.

     server/kern/rtfos    1 treffer: risico.js rekent `kans x impact` op een
                          RISICO en niet op een mens. Een cijfer over een
                          organisatierisico valt niet onder deze grens, maar het
                          hoort een BENOEMDE uitzondering te zijn en geen
                          stilzwijgen -- dat is een besluit van de eigenaar.
     server/kern/command  9 treffers, alle negen op een DING: risicodrempels
                          waarboven alleen een mens mag beslissen (beleid.js),
                          zoekrelevantie (zoek.js) en het oordeel van een
                          runbook (werkbesparing.js, simulatie.js). Ook die
                          vragen negen benoemde uitzonderingen. */
const MAPPEN = [
  ...['vertegenwoordiging', 'rugdekking', 'carriereledger',
    'levensband', 'levensbeleid', 'levensdossier', 'levensgraaf', 'levenslijn', 'socialegraaf']
    .map(n => path.join(__dirname, '..', 'server', 'kern', n)),
  path.join(__dirname, '..', 'server', 'school'),
];

test('1. zelfijking: de scan vindt een woord dat er met opzet in wordt gezet', () => {
  const tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-car05-'));
  try {
    /* In CODE, niet in commentaar -- dat is precies het onderscheid dat de
       handhaver maakt, en dus ook wat de ijking moet aantonen. */
    fs.writeFileSync(path.join(tijdelijk, 'stiekem.js'), 'const score = 87;\nmodule.exports = { score };\n');
    const { gevonden } = grensScan([tijdelijk]);
    assert.equal(gevonden.length, 1, 'de scan hoort een score in code te vinden; doet hij dat niet, ' +
      'dan zegt zijn groen op de echte mappen niets');
    assert.match(gevonden[0], /score/);

    /* En de andere kant: hetzelfde woord in COMMENTAAR mag juist wel, want deze
       lagen moeten kunnen uitleggen waarom er geen score is. */
    fs.writeFileSync(path.join(tijdelijk, 'stiekem.js'), '/* hier komt geen score, zie CAR-05 */\nmodule.exports = {};\n');
    assert.deepStrictEqual(grensScan([tijdelijk]).gevonden, [],
      'een woord in commentaar is geen score; anders kan de laag zijn eigen grens niet opschrijven');
  } finally { fs.rmSync(tijdelijk, { recursive: true, force: true }); }
});

test('2. elk verboden woord draagt een reden', () => {
  assert.ok(WOORDEN.length >= 6, 'een lijst van een paar woorden dekt de vormen niet');
  for (const [woord, reden] of WOORDEN) {
    assert.ok(String(reden || '').trim().length > 10,
      'het woord "' + woord + '" staat op de lijst zonder reden; dan groeit hij met wat iemand ooit ' +
      'verdacht vond en krimpt hij bij de eerste valse treffer');
  }
});

test('3. geen cijfer op een mens in de carrierekant, de Foundation en School', () => {
  const { gevonden, ontbreekt } = grensScan(MAPPEN);
  assert.deepStrictEqual(ontbreekt, [],
    'een bewaakte map is weg of hernoemd; een grens die over een verdwenen map zwijgt, ' +
    'staat groen zonder iets te bewaken');
  assert.deepStrictEqual(gevonden, [],
    'CAR-05: een score op een mens wordt nooit een veld en nooit een sorteersleutel ' +
    '(KANTOORMACHT.md, HDI.md, ONTMOETEN.md, LIFE.md, FOUNDATION.md par. 5, SCHOOL.md par. 11.1)');
});

/* MUTATIE GEZIEN ZAKKEN: de ontkenningsregel uit scripts/lib/cijferopmens.js
   gehaald; toets 5 zakte met school/hr-verlof.js erbij.

   DEZE TOETS IS DE PRIJS VAN DE UITBREIDING. School kon pas onder de grens
   doordat de scan leerde dat een ONTKENNING geen score is -- twee schoolmodules
   schrijven "bewust geen score" en "bewust geen cijfer of ranglijst" in hun
   ANTWOORD, waar een lid het leest, en werden daarvoor gemeld. Zonder deze
   toets sluipt die versoepeling terug of juist te ver door, en in beide
   gevallen merkt niemand het. */
test('5. een ontkenning is geen score, en een aankondiging wel', () => {
  const tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-car05b-'));
  try {
    const schrijf = (inhoud) => fs.writeFileSync(path.join(tijdelijk, 'a.js'), inhoud);

    schrijf("module.exports = { uitleg: 'Er is bewust geen score en geen volgorde op zwaarte.' };\n");
    assert.deepStrictEqual(grensScan([tijdelijk]).gevonden, [],
      'een module die in zijn eigen antwoord zegt dat er GEEN score is, wordt gemeld; ' +
      'dan leert de grens je om de uitleg weg te laten in plaats van de score');

    schrijf("module.exports = { let: 'Er staat bewust geen cijfer of ranglijst in.' };\n");
    assert.deepStrictEqual(grensScan([tijdelijk]).gevonden, [],
      'de ontkenning loopt over een lijstje ("geen cijfer of ranglijst") en hoort ook het TWEEDE woord te dekken');

    /* En de andere kant, want een ontkenningsregel die alles wegpoetst is erger
       dan geen regel: deze drie MOETEN blijven zakken. */
    schrijf("const score = weeg(mens);\nmodule.exports = { score };\n");
    assert.equal(grensScan([tijdelijk]).gevonden.length, 1, 'een kale score op een mens hoort gewoon gemeld te worden');

    schrijf("module.exports = { uitleg: 'geen oordeel', score: 9 };\n");
    assert.equal(grensScan([tijdelijk]).gevonden.length, 1,
      'de ontkenning gaat over `oordeel`; tussen haar en `score` staat een komma, dus zij dekt hem niet');

    schrijf("module.exports = { uitleg: 'geen aparte weging maar wel een echte score op de kandidaat' };\n");
    assert.equal(grensScan([tijdelijk]).gevonden.length, 1,
      'een bijzin die een score AANKONDIGT is geen ontkenning; een venster op TEKENS liet deze door, ' +
      'een venster op twee WOORDEN niet');
  } finally { fs.rmSync(tijdelijk, { recursive: true, force: true }); }
});

test('4. de gedragshelft weigert een uitzondering zonder reden', () => {
  assert.throws(() => mensVrij([{ gewicht: 1 }], { gewicht: '' }),
    /geen reden/, 'een naamloze uitzondering is een achterdeur met een vinkje ervoor');
  assert.deepStrictEqual(mensVrij([{ naam: 'x', plafondCenten: 5 }], { plafondCenten: 'een grens op een BEDRAG' }), []);
  assert.deepStrictEqual(mensVrij([{ naam: 'x', gewicht: 0.87 }], {}), ['gewicht = 0.87'],
    'een getal op een mens dat geen `score` heet, is nog steeds een getal op een mens');
});
