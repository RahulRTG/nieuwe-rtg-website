/* DE RTG MOBILE INTERACTION GRAMMAR, machinaal gehandhaafd. De regels staan in
   GRAMMATICA.md; test/adaptief.test.js meet de laag eronder.

   WAAROM DEZE TOETS BESTAAT. Een taal breekt niet met een knal. Hij breekt
   doordat iemand op een drukke dag lang drukken in zijn ene scherm iets laat
   verwijderen, of een handeling "terug" noemt zonder weg terug, of een knop grijs
   maakt zonder reden. Alle drie zien er op dat ene scherm prima uit. Pas als een
   lid van scherm wisselt, merkt hij dat hij niets meer durft vast te houden.

   Wat hier gemeten wordt zijn precies de dingen die je op één scherm niet ziet.
   Wat NIET gemeten wordt is of een handeling het JUISTE gewicht heeft -- dat is
   een oordeel, en dat staat als zodanig in GRAMMATICA.md.

   Bij elke toets staat de mutatie die hem hoort te laten zakken (LAT.md regel 2).
   Alle mutaties hieronder zijn gedraaid; ze zakten op precies één toets. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const gram = require('../public/shared/adaptief/grammatica.js');
const CSS = lees('public/shared/grammatica.css');

/* ============================================================ de gebaren == */

test('er zijn precies vijf gebaren, en alleen tikken verandert iets', () => {
  /* DIT IS DE KERN VAN DE TAAL. Een gebaar dat alleen laat zien, hoeft nooit
     bevestigd te worden -- en omgekeerd: zodra een tweede gebaar iets kan
     veranderen, moet ELK gebaar afgewogen worden op gewicht, en dan is de
     grammatica geen grammatica meer maar een verzameling gevallen.

     DE MUTATIE: zet `verandert: true` op `lang` in grammatica.js. Lang drukken
     op een knop waarvan je niet weet wat hij doet, is precies het moment waarop
     je NIET wilt dat er iets gebeurt. */
  const namen = Object.keys(gram.GEBAREN);
  assert.deepEqual(namen.sort(), ['lang', 'omhoog', 'orb', 'selectie', 'tik']);
  const veranderen = namen.filter((n) => gram.GEBAREN[n].verandert);
  assert.deepEqual(veranderen, ['tik'], 'alleen tikken hoort iets te veranderen');
});

test('een gebaar dat niet bestaat, wordt gemeld', () => {
  /* DE MUTATIE: laat keur() onbekende gebaren overslaan. Een typefout
     ("longpress") levert dan een declaratie op die er goed uitziet en niets
     doet. */
  const bev = gram.keur([{ id: 'a.b', gebaren: ['dubbeltik'] }]);
  assert.equal(bev.filter((x) => x.soort === 'gebaar').length, 1);
});

test('geen enkele module bindt lang drukken aan een handeling', () => {
  /* DE REGEL DIE TIJDENS HET BOUWEN AL EEN KEER IS GESNEUVELD. Lang drukken op
     een handeling opende eerst de uitgebreide lade -- een tweede betekenis naast
     "meer gereedschap" bij omhoog trekken. Zo verliest een taal zijn woorden.

     Deze toets leest de bron: waar een lange druk wordt afgehandeld, hoort daar
     een uitleg te volgen en geen uitvoering.

     DE MUTATIE: zet in balkknop.js de lange druk terug op openLade(). */
    const bron = lees('public/shared/adaptief/balkknop.js');
    const naDruk = bron.slice(bron.indexOf('pointerdown'));
    assert.ok(/uitleg\(/.test(naDruk),
      'lang drukken hoort uit te leggen (waarom.js), niet uit te voeren');
    assert.ok(!/klok = w\.setTimeout\(function \(\) \{ klok = null; (voer|openLade)\(/.test(naDruk),
      'lang drukken mag geen handeling uitvoeren of gereedschap openen');
});

/* ============================================================ het gewicht == */

test('de vijf trappen lopen van niets vragen naar een mens vragen', () => {
  /* DE MUTATIE: zet `vraagt: false` op `zwaar`. Dan gaat tienduizend salarissen
     exporteren met één tik, en is het verschil tussen licht en zwaar alleen nog
     een woord in een declaratie. */
  assert.deepEqual(gram.TRAPPEN, ['licht', 'terug', 'bewust', 'zwaar', 'plechtig']);
  assert.equal(gram.GEWICHT.licht.vraagt, false);
  assert.equal(gram.GEWICHT.terug.vraagt, false);
  for (const t of ['bewust', 'zwaar', 'plechtig']) {
    assert.equal(gram.GEWICHT[t].vraagt, true, t + ' hoort iets te vragen');
  }
  assert.equal(gram.GEWICHT.terug.ongedaan, true, '"terug" hoort een weg terug te beloven');
  assert.equal(gram.GEWICHT.plechtig.mens, true, 'alleen een mens maakt "plechtig" af');
  // de trappen lopen op en er zitten geen twee op dezelfde hoogte
  const trappen = gram.TRAPPEN.map((t) => gram.GEWICHT[t].trap);
  assert.deepEqual(trappen, [0, 1, 2, 3, 4]);
});

test('alleen de twee lichtste trappen gaan zonder meer door', () => {
  /* DE MUTATIE: laat directMag() altijd true teruggeven. Elke tik in het dock
     zou dan meteen doorgaan, en het hele gewicht wordt decor. */
  assert.equal(gram.directMag('licht'), true);
  assert.equal(gram.directMag('terug'), true);
  for (const t of ['bewust', 'zwaar', 'plechtig']) {
    assert.equal(gram.directMag(t), false, t + ' hoort niet zomaar door te gaan');
  }
  assert.equal(gram.directMag('onzin'), true, 'een onbekend gewicht valt terug op licht');
});

test('vasthouden bestaat alleen bij de twee zwaarste trappen', () => {
  /* DE MUTATIE: zet VASTHOUD.licht op 900. Dan moet je vet maken vasthouden, en
     dat is de andere kant van dezelfde fout: wrijving waar hij niets bewijst
     leert een mens dat wrijving nergens iets betekent. */
  assert.deepEqual(Object.keys(gram.VASTHOUD).sort(), ['plechtig', 'zwaar']);
  assert.ok(gram.VASTHOUD.zwaar >= 600, 'korter dan dit gebeurt per ongeluk');
  assert.ok(gram.VASTHOUD.plechtig >= gram.VASTHOUD.zwaar, 'plechtig hoort niet sneller te gaan dan zwaar');
});

test('een zware trap zonder reden EN zonder weg terug wordt afgekeurd', () => {
  /* Dan is er niets: geen herstel en geen spoor.

     DE MUTATIE: zet `reden: false` op `zwaar` in GEWICHT. Deze toets hoort dan
     te zakken, want zwaar heeft ook geen `ongedaan`. */
  const bev = gram.keur([{ id: 'a.b', gewicht: 'zwaar' }]);
  assert.deepEqual(bev.filter((x) => x.soort === 'zwaarzonder'), [],
    'zwaar hoort in de tabel al een reden te vragen');
  const onzin = gram.keur([{ id: 'a.b', gewicht: 'bestaatniet' }]);
  assert.equal(onzin.filter((x) => x.soort === 'gewicht').length, 1);
});

test('de gewichtlaag zet "terug" zonder weg terug een trap hoger', () => {
  /* WIE `terug` DECLAREERT EN GEEN ONGEDAAN MEELEVERT, BELOOFT IETS WAT ER NIET
     IS. Dat mag geen stille tik worden: dan verdwijnt de weg terug zonder dat
     iemand het merkt. Hij wordt `bewust` -- dan maar vooraf vragen.

     DE MUTATIE: haal het blok `if (g === 'terug' && typeof it.ongedaan !==
     'function')` uit gewicht.js. */
  const bron = lees('public/shared/adaptief/gewicht.js');
  assert.ok(/g === 'terug' && typeof it\.ongedaan !== 'function'/.test(bron),
    'gewicht.js hoort een lege terug-belofte op te vangen');
  assert.ok(/g = 'bewust'/.test(bron), 'en hem een trap hoger te zetten');
});

/* ========================================================== verhinderd == */

test('een verhindering zonder reden wordt afgekeurd', () => {
  /* DIT IS DE GRIJZE KNOP DIE DIT HELE STUK MOET UITBANNEN.

     DE MUTATIE: haal de `redenloos`-tak uit keur(). Dan mag een handeling weer
     stil grijs worden, en is "waarom kan ik dit niet?" een tekst zonder
     handhaver. */
  const zonder = gram.keur([{ id: 'a.b', verhinderd: { bron: 'beleid' } }]);
  assert.equal(zonder.filter((x) => x.soort === 'redenloos').length, 1);
  const met = gram.keur([{ id: 'a.b', verhinderd: { reden: 'Het beleid verbiedt dit.', bron: 'beleid' } }]);
  assert.deepEqual(met, []);
});

test('elke verhindering draagt een bron, en die bron zegt of je er zelf iets aan kunt doen', () => {
  /* Een reden zonder bron is een mening; met bron is het een verwijzing die
     iemand kan natrekken.

     DE MUTATIE: laat verhindering() de bron weglaten. Dan staat er in de uitleg
     geen "waardoor" meer, en is de volgende stap niet af te leiden. */
  const h = gram.verhindering({ reden: 'Nee.', bron: 'classificatie' });
  assert.equal(h.bron, 'classificatie');
  assert.equal(h.los, false, 'een classificatie los je niet zelf op');
  assert.equal(gram.verhindering({ reden: 'Nee.', bron: 'bevoegdheid' }).los, true);
  // een onbekende bron valt terug op de enige die zonder uitleg te begrijpen is
  assert.equal(gram.verhindering({ reden: 'Nee.', bron: 'ruimtevaart' }).bron, 'toestand');
  // en een kale string is een reden, geen bron
  assert.equal(gram.verhindering('Kan nu even niet.').reden, 'Kan nu even niet.');
});

test('de uitleg neemt de reden van de aanroeper en niet de algemene zin', () => {
  /* "Extern delen is uitgeschakeld omdat dit document als Vertrouwelijk is
     geclassificeerd" is beter dan welke algemene zin ook. De algemene zin is het
     vangnet, niet het antwoord.

     DE MUTATIE: laat uitleg() altijd BRONNEN[bron].zin teruggeven. */
  const eigen = gram.uitleg({ reden: 'Delen kan niet: dit stuk is Strikt.', bron: 'classificatie' });
  assert.equal(eigen, 'Delen kan niet: dit stuk is Strikt.');
  assert.ok(gram.uitleg({ reden: '', bron: 'beleid' }).length > 0, 'zonder reden is er een vangnet');
});

test('een verhinderde handeling wordt geweigerd en niet alleen grijs getekend', () => {
  /* EEN KNOP DIE ER UITGESCHAKELD UITZIET MAAR VIA EEN TOETS OF DE ORB ALSNOG
     DRAAIT, IS GEEN BEPERKING MAAR EEN LEK.

     DE MUTATIE: haal `if (!mag(id)) return false;` uit doe() in register.js. */
  const bron = lees('public/shared/adaptief/register.js');
  assert.ok(/function mag\(id\)/.test(bron), 'het register hoort een mag() te hebben');
  assert.ok(/if \(!mag\(id\)\) return false;/.test(bron), 'en doe() hoort erop te stuiten');
});

test('verhinderd is niet uitgeschakeld: de knop blijft bedienbaar en zegt het in zijn naam', () => {
  /* Hier stond aria-disabled, en dat is precies verkeerd: dan slaat een
     schermlezer de knop over, en is de uitleg onbereikbaar voor wie hem het
     hardst nodig heeft.

     DE MUTATIE: zet in balkknop.js aria-disabled terug in plaats van de naam. */
  for (const p of ['public/shared/adaptief/balkknop.js', 'public/shared/adaptief/orb.js',
    'public/shared/adaptief/diepte.js']) {
    /* Commentaar eerst weg: in balkknop.js staat met zoveel woorden UITGELEGD
       waarom hier geen aria-disabled staat, en die uitleg is precies het stuk
       dat een volgende ronde tegenhoudt. Hem laten meetellen zou betekenen dat
       de toets de documentatie van zijn eigen regel afkeurt. */
    const bron = lees(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/aria-disabled/.test(bron), p + ' hoort geen aria-disabled te zetten');
    assert.ok(/niet beschikbaar\. Tik voor de reden\./.test(bron),
      p + ' hoort de stand in de toegankelijke naam te zetten');
  }
});

/* =========================================================== de vorm == */

test('de streep door een verhinderde knop is een VORM en niet alleen een kleur', () => {
  /* ONTWERP.md par. 5: status nooit op kleur alleen. Een lichtere knop is een
     kleursignaal; de streep zegt hetzelfde in een vorm.

     DE MUTATIE: haal de ::after-regel met de streep weg. */
  const blok = blokVan('.cmd-actie.verhinderd::after');
  assert.ok(blok, 'een verhinderde knop hoort een streep te dragen');
  assert.ok(/rotate/.test(blok), 'en die streep hoort schuin te staan');
});

test('het raakvlak in de Trust Rail haalt de aanraakmaat, ook al is de inkt kleiner', () => {
  /* De strook is 30px hoog om rustig te zijn; een duim heeft 44 nodig. Dat gaat
     samen door het raakvlak buiten de inkt te laten lopen.

     DE MUTATIE: haal de ::after met de negatieve inset weg. Dan is de rail een
     rij knoppen van 30px, en dat is onder de ontwerpmaat. */
  const rail = blokVan('.cmd-rail');
  const hoogte = Number((rail.match(/min-height:\s*(\d+)px/) || [])[1]);
  const na = blokVan('.rail-deel::after');
  assert.ok(na, 'de rail-onderdelen horen hun raakvlak uit te breiden');
  const boven = Number((na.match(/top:\s*-(\d+)px/) || [])[1]);
  const onder = Number((na.match(/bottom:\s*-(\d+)px/) || [])[1]);
  assert.ok(hoogte + boven + onder >= 44,
    'raakvlak is ' + (hoogte + boven + onder) + 'px, en dat is onder de 44');
});

test('het dock zakt niet weg tijdens het werk; alleen de chrome wijkt', () => {
  /* De eerste zin van deze grammatica is dat je duim zijn werk onderaan vindt.
     Een dock dat verdwijnt zodra je leest, breekt precies die zin.

     DE MUTATIE: zet in grammatica.css een regel die .cmd-balk zelf verbergt of
     wegschuift bij [data-bezig="1"]. */
  const regels = REGELS.filter((r) => r.kiezers.some((k) => /data-bezig/.test(k)));
  assert.ok(regels.length, 'er hoort iets te gebeuren als er gewerkt wordt');
  /* WAT EEN REGEL RAAKT, IS ZIJN LAATSTE STUK. `.cmd-balk[data-bezig] ~ .cmd-rail`
     raakt de RAIL, niet het dock -- en `:has(...)` bevat een kiezer die er alleen
     als voorwaarde in staat. De eerste versie van deze toets keek naar het hele
     kiezerpad en vlagde daardoor de regel aan die de rail laat wijken: precies de
     regel die hier hoort te staan. */
  const raaktDock = (k) => /\.cmd-balk\[data-bezig[^\s]*\]?$/.test(
    k.replace(/:has\([^)]*\)/g, '').trim());
  for (const r of regels) {
    if (!r.kiezers.some(raaktDock)) continue;
    assert.ok(!/display:\s*none|transform:|opacity:\s*0/.test(r.inhoud),
      'het dock zelf hoort te blijven staan: ' + r.kiezers.join(', '));
  }
  // en er hoort wél iets te wijken, anders meet deze toets niets
  assert.ok(regels.some((r) => r.kiezers.some((k) => /cmd-rail|cmd-anker/.test(k))),
    'de chrome hoort te wijken als er gewerkt wordt');
});

test('de grammatica bestaat alleen op een klein scherm, en zegt dat zelf', () => {
  /* Op een breed scherm doen de werkbalk, het contextvlak en de console van het
     scherm zelf dit werk. Een tweede strook onderin zou een tweede bediening
     naast een bestaande zijn.

     DE MUTATIE: haal het @media (min-width:1000px)-blok uit grammatica.css. */
  const leer = require('../public/shared/adaptief.js');
  const staart = CSS.slice(CSS.indexOf('@media (min-width:' + leer.MAAT.bureau + 'px)'));
  assert.ok(staart.length, 'grammatica.css hoort een bureau-blok te hebben op ' + leer.MAAT.bureau + 'px');
  assert.ok(/\.cmd-rail\{display:none!important\}/.test(staart.replace(/\s+/g, '')),
    'de rail hoort op een breed scherm niet te bestaan');
});

/* ============================================== over de hele broncode == */

test('elke gedeclareerde gewichtstrap bestaat echt', () => {
  /* keur() vangt wat er langskomt; deze toets vangt wat er GESCHREVEN is, ook
     als dat stuk code vandaag op geen enkel scherm draait.

     DE MUTATIE: zet in apps/bestanden/adaptief.js een gewicht 'middel'. Deze
     toets hoort het bestand bij naam te noemen. */
  const fout = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      for (const m of bron.matchAll(/gewicht:\s*'([a-z]+)'/g)) {
        if (!gram.GEWICHT[m[1]]) fout.push(path.relative(WORTEL, p) + ': ' + m[1]);
      }
    }
  };
  loop(path.join(WORTEL, 'public'));
  assert.deepEqual(fout, []);
});

test('elke verhindering in de bron noemt een reden', () => {
  /* DE MUTATIE: haal `reden:` weg uit de verhindering in
     apps/office/adaptief-staat.js. Die knop wordt dan grijs zonder uitleg -- de
     fout waar dit hele hoofdstuk tegen is. */
  const fout = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      let i = 0;
      for (;;) {
        const start = bron.indexOf('verhinderd:', i);
        if (start < 0) break;
        i = start + 11;
        const rest = bron.slice(start, start + 400);
        // een doorgegeven variabele of een null is geen declaratie ter plekke
        if (!/verhinderd:\s*(dicht \?\s*)?\{/.test(rest)) continue;
        if (!/reden:/.test(rest.slice(0, rest.indexOf('}') + 1) + rest.slice(0, 300))) {
          fout.push(path.relative(WORTEL, p));
        }
      }
    }
  };
  loop(path.join(WORTEL, 'public'));
  assert.deepEqual(fout, []);
});

/* De regels uit het blad, als (kiezers, inhoud); commentaar eerst weg, want dat
   staat vol komma's en accolades. Zelfde stap als in test/ontwerp.test.js. */
const REGELS = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}')
  .map((brok) => {
    const i = brok.indexOf('{');
    if (i < 0) return null;
    return { kiezers: brok.slice(0, i).split(',').map((s) => s.trim()).filter(Boolean), inhoud: brok.slice(i + 1) };
  })
  .filter(Boolean);
function blokVan(kies) {
  const t = REGELS.filter((r) => r.kiezers.includes(kies));
  return t.length ? t.map((r) => r.inhoud).join('\n') : null;
}
