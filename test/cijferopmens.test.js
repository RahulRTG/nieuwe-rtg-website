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
const { WOORDEN, VERBODEN_ONDERWERP, UITZONDERINGEN, keurUitzonderingen, grensScan, mensVrij } =
  require('../scripts/lib/cijferopmens');

/* De hele kant van het huis waar een mens die van zijn talent leeft woont, plus
   de Foundation, School en sinds 14 september de twee mappen die er met een
   MEETRESULTAAT naast bewust buiten stonden. Wie er een map bij bouwt, zet hem
   hier bij -- toets 3 zakt als een bestaande map verdwijnt, maar hij kan niet
   weten dat er een is BIJGEKOMEN.

   DE FOUNDATION EN SCHOOL STAAN ER SINDS 14 SEPTEMBER BIJ, en dat is geen
   uitbreiding van de grens maar het uitvoeren ervan. De kop van
   scripts/lib/cijferopmens.js noemt vier documenten; FOUNDATION.md par. 5 en
   HDI.md par. 5 zeggen hetzelfde in nog twee, en SCHOOL.md par. 11.1 verbiedt
   met zoveel woorden een risicoscore, een uitvalkans en een ranglijst. De grens
   gold daar dus al en werd er door niets tegengehouden -- exact de vorm waarin
   deze toets zelf is ontstaan ("de grens had vier documenten en een handhaver,
   en die ene dekte precies een map").

   EN LET OP HOE DIE LIJST TOT STAND KWAM. De eerste poging zette er `leven` en
   `gezin` in, want een losse scan meldde daar 0 treffers. Die mappen BESTAAN
   NIET: `grensScan` geeft een onbestaande map terug in `ontbreekt` en niet in
   `gevonden`, en wie alleen `gevonden.length` afdrukt leest "0" als "schoon".
   Toets 3 viel er meteen over -- precies waarvoor de `ontbreekt`-helft is
   gebouwd. De echte Foundation-mappen heten levensband, levensbeleid,
   levensdossier, levensgraaf, levenslijn en socialegraaf, en die staan alle zes
   op nul.

   RTFOS EN COMMAND ZIJN ER OP 14 SEPTEMBER BIJ GEKOMEN, met drie BENOEMDE
   uitzonderingen in plaats van stilzwijgen. De overweging stond hier eerder als
   "dat is een besluit van de eigenaar", en het besluit is genomen: liever een
   map die je bij elke wijziging opnieuw leest dan een map die niemand bewaakt.
   De veertig treffers vallen alle veertig onder rtfos-risicoweging,
   command-handelingsrisico of command-zoekrelevantie; zie
   scripts/lib/cijferopmens.js voor het onderwerp en het bewijs per stuk. */
const MAPPEN = [
  ...['vertegenwoordiging', 'rugdekking', 'carriereledger',
    'levensband', 'levensbeleid', 'levensdossier', 'levensgraaf', 'levenslijn', 'socialegraaf',
    'rtfos', 'command']
    .map(n => path.join(__dirname, '..', 'server', 'kern', n)),
  path.join(__dirname, '..', 'server', 'school'),
];
const WORTEL = path.join(__dirname, '..');

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

test('3. geen cijfer op een mens in de carrierekant, de Foundation, School, rtfos en command', () => {
  const { gevonden, ontbreekt, onbenut, bezwaren } =
    grensScan(MAPPEN, { uitzonderingen: UITZONDERINGEN, wortel: WORTEL });
  assert.deepStrictEqual(bezwaren, [],
    'de verklaring komt niet door haar eigen keuring, en dan dekt zij niets -- zie toets 6');
  assert.deepStrictEqual(ontbreekt, [],
    'een bewaakte map is weg of hernoemd; een grens die over een verdwenen map zwijgt, ' +
    'staat groen zonder iets te bewaken');
  assert.deepStrictEqual(onbenut, [],
    'een uitzondering dekt niets meer. Haal hem weg in plaats van hem te laten staan: een dode ' +
    'uitzondering is een gat dat eruitziet als beleid');
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

/* ============================================================================
   DE UITZONDERINGEN ZELF -- want een mechanisme dat uitzonderingen toestaat, is
   precies zo sterk als wat het WEIGERT toe te staan.

   rtfos en command kwamen onder de grens met drie benoemde uitzonderingen. Dat
   is alleen beter dan ze eruit laten als niemand er een score op een mens door
   kan schuiven. Deze drie toetsen zijn die belofte. */

/* MUTATIE GEZIEN ZAKKEN: het onderwerp van rtfos-risicoweging veranderd in
   'een lid van de stichting'; toets 6 zakte met het woord "lid" erbij, en
   toets 3 zakte OOK omdat een afgekeurde verklaring niets meer dekt. */
test('6. de verklaring komt door haar eigen keuring, en een verboden onderwerp is geen geval maar de regel', () => {
  assert.deepStrictEqual(keurUitzonderingen(UITZONDERINGEN, WORTEL), [],
    'de echte verklaring hoort door haar eigen keuring te komen');
  assert.ok(UITZONDERINGEN.length >= 1, 'zonder uitzonderingen bewijst deze toets niets');
  assert.ok(VERBODEN_ONDERWERP.includes('mens') && VERBODEN_ONDERWERP.includes('leerling'),
    'de lijst verboden onderwerpen mist juist de woorden waar de grens over gaat');

  const echt = UITZONDERINGEN[0];
  const met = (extra) => keurUitzonderingen([Object.assign({}, echt, extra)], WORTEL);

  /* Eigenschap 1: het onderwerp mag nooit een mens zijn. Dit is de belangrijkste
     bewering van het hele mechanisme -- hij maakt "een uitzondering voor een
     cijfer op een mens" onmogelijk in plaats van ongebruikelijk. */
  for (const woord of ['mens', 'lid', 'medewerker', 'leerling', 'kandidaat']) {
    const bezwaren = met({ onderwerp: 'een ' + woord + ' van de stichting' });
    assert.ok(bezwaren.some(b => b.includes(woord)),
      'een uitzondering met onderwerp "' + woord + '" hoort te worden geweigerd; CAR-05 kent geen ' +
      'uitzondering voor een cijfer op een mens');
  }

  /* Eigenschap 2: het bewijsfragment moet nog in de bron staan. */
  assert.ok(met({ bewijs: { bestand: echt.bewijs.bestand, bevat: 'dit staat er niet' } })
    .some(b => b.includes('bewijsfragment')),
    'een uitzondering waarvan de constructie is veranderd, hoort te vervallen in plaats van te blijven gelden');
  assert.ok(met({ bewijs: { bestand: 'server/kern/bestaatniet.js', bevat: 'x' } })
    .some(b => b.includes('bestaat niet')),
    'een bewijsbestand dat weg is, is geen bewijs');

  /* En de vorm: geen onderwerp, geen reden, geen naam. */
  assert.ok(met({ onderwerp: '' }).some(b => b.includes('geen onderwerp')));
  assert.ok(met({ reden: 'kort' }).some(b => b.includes('te kort')));
  assert.ok(keurUitzonderingen([echt, echt], WORTEL).some(b => b.includes('dezelfde naam')),
    'twee uitzonderingen met dezelfde naam maken het spoor onleesbaar');
});

/* MUTATIE GEZIEN ZAKKEN: in grensScan `const geldig = bezwaren.length ? [] : uitz`
   vervangen door `const geldig = uitz`; toets 7 zakte -- de scan poetste toen
   treffers weg op grond van een verklaring die hij zelf had afgekeurd. */
test('7. een afgekeurde verklaring dekt NIETS, en een dode uitzondering is een fout', () => {
  const tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-car05c-'));
  try {
    fs.writeFileSync(path.join(tijdelijk, 'a.js'), 'const score = weeg(risico);\nmodule.exports = { score };\n');
    const rel = path.relative(tijdelijk, path.join(tijdelijk, 'a.js')).split(path.sep).join('/');
    const goed = {
      id: 'proef', onderwerp: 'een risico', woorden: ['score'], bestanden: [rel],
      bewijs: { bestand: 'a.js', bevat: 'const score = weeg(risico);' },
      reden: 'een proefuitzondering met een reden die lang genoeg is om een besluit te dragen'
    };
    const opt = (u) => ({ uitzonderingen: [u], wortel: tijdelijk });

    assert.deepStrictEqual(grensScan([tijdelijk], opt(goed)).gevonden, [],
      'een geldige uitzondering hoort zijn eigen treffer te dekken, anders bewijst de rest niets');

    /* Fail-closed: afgekeurd betekent dat er NIETS wordt weggepoetst. Een grens
       die klaagt terwijl hij toegeeft, is geen grens. */
    const fout = grensScan([tijdelijk], opt(Object.assign({}, goed, { onderwerp: 'een mens' })));
    assert.ok(fout.bezwaren.length, 'een verboden onderwerp hoort een bezwaar op te leveren');
    assert.equal(fout.gevonden.length, 1,
      'en zolang er een bezwaar staat, dekt de verklaring niets -- anders klaagt de grens terwijl hij toegeeft');

    /* Eigenschap 3: een uitzondering die niets dekt, wordt gemeld. */
    const dood = grensScan([tijdelijk], opt(Object.assign({}, goed, { bestanden: ['elders/b.js'] })));
    assert.deepStrictEqual(dood.onbenut, ['proef'],
      'een uitzondering die nul treffers dekt, spreekt over een verleden dat niet meer bestaat');
  } finally { fs.rmSync(tijdelijk, { recursive: true, force: true }); }
});

/* MUTATIE GEZIEN ZAKKEN: in grensScan de `continue` na een gedekte treffer
   vervangen door `break`; toets 8 zakte meteen -- de toegestane score op regel
   1 verborg de verboden score op regel 2.

   DIT IS DEZELFDE FOUT DIE DIT BESTAND AL EEN KEER HEEFT GEMAAKT, een laag
   dieper: "een bestand dat vroeg 'geen score' schrijft en laat een ECHTE score
   bouwt, meldde de onschuldige". Met uitzonderingen erbij komt die vorm terug,
   want nu is er een treffer die je LEGITIEM overslaat. */
test('8. een uitgezonderde treffer verbergt geen verboden treffer in hetzelfde bestand', () => {
  const tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-car05d-'));
  try {
    fs.writeFileSync(path.join(tijdelijk, 'a.js'),
      'const score = kans * impact;\nconst zwaar = score >= 40;\nconst rating = weegDeMens(lid);\n' +
      'module.exports = { zwaar, rating };\n');
    const uitz = {
      id: 'proef', onderwerp: 'een risico', woorden: ['score'], bestanden: ['a.js'],
      bewijs: { bestand: 'a.js', bevat: 'const score = kans * impact;' },
      reden: 'alleen het woord score is uitgezonderd, en uitsluitend omdat het over een risico gaat'
    };
    const r = grensScan([tijdelijk], { uitzonderingen: [uitz], wortel: tijdelijk });
    assert.equal(r.uitgezonderd.length, 2, 'de twee keer `score` horen gedekt te zijn');
    assert.equal(r.gevonden.length, 1,
      'en `rating` op een mens hoort er gewoon uit te komen; een uitzondering dekt een WOORD en ' +
      'niet de rest van het bestand');
    assert.match(r.gevonden[0], /rating/);
  } finally { fs.rmSync(tijdelijk, { recursive: true, force: true }); }
});
