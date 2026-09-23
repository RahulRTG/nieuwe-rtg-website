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

test('een tik draait direct precies dan als het werkelijke gewicht niets vraagt', () => {
  /* Dit was directMag(), en die gaf een onbekende trap LICHT terwijl effectief()
     hem ZWAAR maakt: twee antwoorden op een vraag, en de ene had geen aanroeper
     (EDGE.md par. 11, ronde 1). De belofte wordt nu gemeten waar hij wordt
     waargemaakt: in de uitvoerder.

     DE MUTATIES: laat gewicht.js `bewust` via draai() uitvoeren (zakt op
     bewust), zet `vraagt: false` bij zwaar in grammatica.js (tabel en uitvoerder
     lopen uiteen), of laat effectief() een onbekende trap licht geven (de
     absolute regel over 'onzin' zakt -- de relatieve beweegt mee en kan dat niet
     zien, daarom staan ze er allebei). */
  const vm = require('vm');
  assert.equal('directMag' in gram, false, 'directMag hoort weg te zijn: effectief() is het ene antwoord');
  const bron = lees('public/shared/adaptief/gewicht.js');
  for (const t of [...gram.TRAPPEN, undefined, 'onzin']) {
    for (const terug of [false, true]) {
      let gedraaid = 0;
      const window = { RTGGrammatica: gram, console: { warn() {}, error() {} }, RTGLagen: { lade() {}, taak() {}, sluit() {} } };
      vm.runInNewContext(bron, { window, document: {} });
      window.RTGGewicht.voer({ id: 'h', naam: 'H', gewicht: t, doe: () => { gedraaid++; }, ongedaan: terug ? () => {} : undefined });
      const direct = !gram.GEWICHT[gram.effectief(t, terug)].vraagt;
      assert.equal(gedraaid, direct ? 1 : 0, String(t) + (terug ? ' met' : ' zonder') + ' weg terug');
      if (t === 'onzin') assert.equal(gedraaid, 0, 'een onbekende trap draait nooit direct');
    }
  }
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

     De regel woont sinds EDGE.md ronde 0 op EEN plek (grammatica.effectief),
     omdat hij er twee keer stond: in gewicht.js, dat uitvoert, en in
     edge/actiestaat.js, dat toont. Twee kopieen van een regel lopen op een dag
     uit elkaar, en dan toont de Edge iets anders dan er gebeurt.

     DE MUTATIES: laat effectief() `terug` altijd doorlaten (de gedragshelft
     zakt), of laat gewicht.js zijn eigen trap lezen in plaats van effectief()
     aan te roepen (de bronhelft zakt). */
  assert.equal(gram.effectief('terug', false), 'bewust');
  assert.equal(gram.effectief('terug', true), 'terug');
  assert.equal(gram.effectief(undefined, false), 'licht');
  assert.equal(gram.effectief('plechtig', false), 'plechtig');
  assert.equal(gram.effectief('zwaarr', true), 'zwaar', 'een onbekende trap is dicht, nooit licht');
  const bron = lees('public/shared/adaptief/gewicht.js');
  assert.ok(/gram\.effectief\(it\.gewicht, typeof it\.ongedaan === 'function'\)/.test(bron),
    'gewicht.js hoort het werkelijke gewicht uit grammatica.effectief te halen');
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

test('zonder gewichtlaag gaat alleen licht door, in de balk EN in de orb', () => {
  /* Twee ingangen naar dezelfde handeling, en ze faalden tegengesteld: de balk
     weigerde een zware handeling als gewicht.js ontbrak, de orb voerde hem uit
     (EDGEKAART.json, verantwoordelijkheid `gewicht`). Latent -- alleen app.html
     laadt de orb, en die laadt de gewichtlaag ook -- maar een script dat niet
     laadt is precies het moment waarop dit ertoe doet.

     DE MUTATIE: haal in orb.js de regel `if ((it.gewicht || 'licht') !== 'licht')
     return;` weg. */
  for (const [p, doe] of [['public/shared/adaptief/balkknop.js', 'A.doe(it.id)'],
    ['public/shared/adaptief/orb.js', 'w.RTGAdaptief.doe(it.id)']]) {
    const bron = lees(p).replace(/\/\*[\s\S]*?\*\//g, '');
    const van = bron.indexOf('RTGGewicht.voer(it)');
    const tot = bron.indexOf(doe, van);
    assert.ok(van > 0 && tot > van, p + ': de weg zonder gewichtlaag hoort na RTGGewicht.voer te komen');
    assert.match(bron.slice(van, tot), /\(it\.gewicht \|\| 'licht'\) !== 'licht'/,
      p + ': zonder gewichtlaag hoort alleen een lichte handeling door te gaan');
  }
});

test('de Second Screen voert uit langs het gewicht, niet eromheen', () => {
  /* "Nu relevant" in de Second Screen toonde de handelingen van de context en
     riep bij een tik RTGAdaptief.doe() rechtstreeks aan. Dat register kijkt
     alleen of iets verhinderd is, niet wat het weegt -- dus een `bewust`-
     handeling ging zonder lade door en een `plechtig` zonder vasthouden
     (inventaris van EDGE.md, bevestigd in de bron). Nu gaat die ingang langs
     RTGGewicht.voerId, dezelfde weg als een tik in het dock.

     DE MUTATIES: laat second-screen-modules.js weer A.doe aanroepen (de
     bronhelft zakt), of laat voerId() het item overslaan en rechtstreeks doen
     (de gedragshelft zakt). */
  const vm = require('vm');
  const gedaan = [], laden = [];
  const items = [{ id: 'deel', naam: 'Delen', gewicht: 'bewust' }, { id: 'vet', naam: 'Vet', gewicht: 'licht' }];
  const window = { RTGGrammatica: gram, console: { warn() {}, error() {} },
    RTGAdaptief: { voorNu: () => items.map((x) => Object.assign({}, x)), doe: (id) => { gedaan.push(id); return true; } },
    RTGLagen: { lade: (o) => laden.push(o.titel), sluit() {} } };
  vm.runInNewContext(lees('public/shared/adaptief/gewicht.js'), { window, document: {} });
  const G = window.RTGGewicht;
  assert.equal(G.voerId('deel'), true);
  assert.deepEqual([gedaan, laden], [[], ['Delen']], 'een bewuste handeling opent de lade en voert niets direct uit');
  assert.equal(G.voerId('vet'), true);
  assert.deepEqual(gedaan, ['vet'], 'een lichte handeling gaat gewoon door');
  assert.equal(G.voerId('speelt-niet'), false, 'een handeling die nu niet speelt, draait niet');
  assert.deepEqual(gedaan, ['vet']);
  const modules = lees('public/shared/interface/second-screen-modules.js');
  assert.match(modules, /'context\.execute': \{ run: function \(p\) \{ return !!w\.RTGGewicht && w\.RTGGewicht\.voerId\(/);
  assert.doesNotMatch(modules, /A\.doe\(/, 'de Second Screen hoort RTGAdaptief.doe niet rechtstreeks aan te roepen');
});

test('de uitvoerder: compensatie is nooit "Ongedaan maken", en zonder lade gaat bewust dicht', () => {
  /* Twee regels die eerst alleen bij het TONEN golden (edge/actiestaat.js) of in
     de verkeerde richting faalden:

     - een handeling die alleen met een tegenboeking te herstellen is
       (herstel: 'compensatie') werd door gewicht.js toch met "Ongedaan maken"
       uitgevoerd zodra het scherm een ongedaan-functie meegaf;
     - `bewust` zonder RTGLagen voerde direct uit, waar `zwaar` dichtging.

     DE MUTATIES: haal in gewicht.js de compensatieregel weg (de eerste helft
     zakt: `terug` voert dan direct uit), of zet `bewust` zonder lade terug op
     draai() (de tweede helft zakt). */
  const vm = require('vm');
  const bron = lees('public/shared/adaptief/gewicht.js');
  function laad(metLagen, herstel) {
    const log = { gedaan: [], laden: [] };
    const window = { RTGGrammatica: gram, console: { warn() {}, error() {} },
      RTGAdaptief: { capability: () => ({ herstel }), voorNu: () => [], doe: (id) => { log.gedaan.push(id); return true; } } };
    if (metLagen) window.RTGLagen = { lade: (o) => log.laden.push(o.titel), sluit() {} };
    vm.runInNewContext(bron, { window, document: {} });
    return { G: window.RTGGewicht, log };
  }
  const terug = { id: 'boek', naam: 'Boeken', gewicht: 'terug', ongedaan: () => {} };
  let r = laad(true, 'exact');
  r.G.voer(terug);
  assert.deepEqual(r.log.gedaan, ['boek'], 'exact herstel met een weg terug gaat direct, met Ongedaan maken erna');
  r = laad(true, 'compensatie');
  r.G.voer(terug);
  assert.deepEqual([r.log.gedaan, r.log.laden], [[], ['Boeken']], 'compensatie wordt bewust: eerst de lade');
  r = laad(false, undefined);
  assert.equal(r.G.voer({ id: 'deel', naam: 'Delen', gewicht: 'bewust' }), false);
  assert.deepEqual(r.log.gedaan, [], 'zonder lade gaat een bewuste handeling dicht');
  /* Een grammatica van VOOR effectief() (een verouderde cache naast een nieuwe
     gewicht.js) levert geen uitvoerder, en dan gaan balk en orb dicht voor alles
     wat niet licht is -- in plaats van een TypeError bij elke tik. DE MUTATIE:
     haal in gewicht.js `|| !gram.effectief` weg (dan bestaat RTGGewicht wel). */
  const oud = Object.assign({}, gram); delete oud.effectief;
  const window = { RTGGrammatica: oud, console: { warn() {}, error() {} } };
  vm.runInNewContext(bron, { window, document: {} });
  assert.equal(window.RTGGewicht, undefined, 'een grammatica zonder effectief() levert geen uitvoerder');
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

/* ============================================ een antwoord op "wat weegt dit" ==
   Ronde 1 (EDGE.md par. 11): drie plekken beslisten zelf wat een handeling
   weegt, en ze liepen uiteen met de uitvoerder. Een kleine nep-DOM laat de echte
   modules in een vm draaien, zodat de toetsen hun GEDRAG lezen en niet hun bron. */
function wereld(metGrammatica) {
  const vm = require('vm');
  const leer = require('../public/shared/adaptief.js');
  const el = (tag) => ({ tag, className: '', textContent: '', kinderen: [], attrs: {}, style: {}, dataset: {},
    appendChild(k) { this.kinderen.push(k); return k; }, prepend(k) { this.kinderen.unshift(k); },
    setAttribute(n, v) { this.attrs[n] = v; }, removeAttribute() {}, addEventListener() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
  const document = { createElement: el, createTextNode: (t) => ({ textContent: t, kinderen: [] }), getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, documentElement: el('html'), body: el('body') };
  const bladen = [];
  const laag = (o) => { const lijf = el('div'); if (o.inhoud) o.inhoud(lijf); bladen.push(lijf); };
  const window = { RTGAdaptiefLeer: leer, console: { warn() {}, error() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout: (f) => f(), addEventListener() {}, RTGLagen: { lade: laag, taak: laag, sluit() {} } };
  if (metGrammatica) window.RTGGrammatica = gram;
  for (const f of ['vorm.js', 'register.js', 'waarom.js', 'balkknop.js', 'orb.js', 'diepte.js']) {
    vm.runInNewContext(lees('public/shared/adaptief/' + f), { window, document, navigator: {} });
  }
  const alles = (n, uit = []) => { uit.push(n); (n.kinderen || []).forEach((k) => alles(k, uit)); return uit; };
  return { window, bladen, alles };
}
const VORM = { telefoon: ['balk'], tablet: ['balk'], bureau: ['werkbalk'] };

test('zonder grammatica blijft een gedeclareerd gewicht staan, en gaat zwaar dicht in balk EN werkmodus', () => {
  /* register.js zette zonder grammatica elk gewicht op licht, dus een zware
     handeling kwam als lichte uit voorNu en draaide met een tik; de tweede trap
     van de werkmodus (diepte.js) voerde zonder gewichtlaag bovendien alles uit.
     DE MUTATIES: zet `c.gewicht = 'licht';` terug in register.js (de zware wordt
     uitgevoerd), of laat de rij in diepte.js weer `A.doe(it.id)` aanroepen. */
  const w = wereld(false), A = w.window.RTGAdaptief, gedaan = [];
  A.declareer(Object.assign({ id: 'proef.zwaar', naam: 'Zwaar', gewicht: 'zwaar', doe: () => gedaan.push('zwaar') }, VORM));
  A.declareer(Object.assign({ id: 'proef.licht', naam: 'Licht', doe: () => gedaan.push('licht') }, VORM));
  A.context({ bron: 'proef', titel: 'Proef', acties: ['proef.zwaar', 'proef.licht'] });
  const items = A.voorNu();
  assert.equal(items.find((x) => x.id === 'proef.zwaar').gewicht, 'zwaar', 'het gedeclareerde gewicht hoort te blijven staan');
  assert.ok(A.gebreken().some((g) => g.soort === 'gewichtloos' && g.id === 'proef.zwaar'), 'en het gebrek hoort gemeld');
  const k = w.window.RTGAdaptiefBalkKnoppen({ items: () => A.voorNu(), titel: () => 'Proef' });
  items.forEach((it) => k.voer(it));
  assert.deepEqual(gedaan, ['licht'], 'de balk voert zonder gewichtlaag alleen licht uit');
  gedaan.length = 0;
  w.window.RTGDiepte.tweede();
  const rijen = w.alles(w.bladen[w.bladen.length - 1]).filter((n) => n.tag === 'button' && typeof n.onclick === 'function');
  assert.equal(rijen.length, 2, 'de werkmodus toont beide handelingen');
  rijen.forEach((r) => r.onclick());
  assert.deepEqual(gedaan, ['licht'], 'de werkmodus voert zonder gewichtlaag alleen licht uit');
});

test('de uitleg en de orb beloven wat de uitvoerder doet', () => {
  /* waarom.js las het RUWE gewicht: bij 'zwaarr' (een tikfout) beloofde de uitleg
     "Gebeurt meteen." terwijl de uitvoerder hem als zwaar behandelt, en bij
     `terug` zonder weg terug beloofde hij een Ongedaan maken dat niet kwam. De orb
     zei in dat laatste geval "terug te draaien".
     DE MUTATIES: zet in waarom.js `BELOFTE[it.gewicht || 'licht'] || BELOFTE.licht`
     terug, of laat orb.js het label weer uit `it.gewicht` lezen. */
  const w = wereld(true), W = w.window;
  const belofte = (gewicht, terug) => {
    W.RTGWaarom.leguit({ id: 'h', naam: 'H', gewicht, ongedaan: terug ? () => {} : undefined });
    const p = w.alles(w.bladen[w.bladen.length - 1]).find((n) => n.className === 'wm-belofte');
    return p ? p.textContent : null;
  };
  for (const t of [...gram.TRAPPEN, 'onzin']) {
    for (const terug of [false, true]) {
      const eff = gram.effectief(t, terug);
      assert.equal(belofte(t, terug), belofte(eff, eff === 'terug'), t + (terug ? ' met' : ' zonder') + ' weg terug');
    }
  }
  assert.notEqual(belofte('onzin', false), belofte('licht', false), 'een onbekende trap belooft nooit "meteen"');
  assert.notEqual(belofte('terug', false), belofte('terug', true), 'zonder weg terug geen belofte van ongedaan maken');

  const A = W.RTGAdaptief;
  A.declareer(Object.assign({ id: 'proef.terug', naam: 'Terug', gewicht: 'terug', doe() {} }, VORM));
  const label = (staat) => {
    A.context({ bron: 'orb', titel: 'Orb', acties: ['proef.terug'], staat });
    W.RTGOrb.open();
    const s = w.alles(w.bladen[w.bladen.length - 1]).find((n) => n.className === 'orb-weegt');
    return s ? s.textContent : null;
  };
  assert.equal(label({}), 'vraagt bevestiging', '`terug` zonder weg terug vraagt bevestiging, zoals de uitvoerder doet');
  assert.equal(label({ 'proef.terug': { ongedaan: () => {} } }), 'terug te draaien');
});
