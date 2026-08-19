/* RTG Gebaren: de regels die je aan een scherm niet ziet, machinaal gehandhaafd.

   WAAROM DEZE TOETS BESTAAT. Een gebarenlaag faalt zelden luid. Hij faalt door
   een regel die net iets te breed is (en dan veegt een carrousel niet meer),
   door een knop in een link (en dan hoort een schermlezer iets wat er niet mag
   staan), of doordat de browser de veeg afpakt (en dan dooft hij na twee pixels
   -- lang genoeg om in een demo te werken). Dat zie je niet door te kijken.

   Wat deze toets NIET doet: smaak beoordelen. Alleen dingen die waar of onwaar
   zijn. Bij elke toets staat DE MUTATIE die hem hoort te laten zakken
   (LAT.md regel 2) -- een toets die je niet hebt zien zakken, is geen toets.

   Draai los: node --test test/gebaar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const CSS = lees('public/shared/gebaar.css');
const JS = lees('public/shared/gebaar.js');
// commentaar eruit: dit blad LEGT de regels uit, en die zinnen noemen dus
// precies de dingen waar we hieronder op zoeken.
const CSSKAAL = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const JSKAAL = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('in rust raakt het blad alleen aan wat met naam is toegestaan', () => {
  /* DE MUTATIE: verander `:where(.rtg-knop,.knop,.gb-rij)` in `:where(button)`,
     of zet er een `a` bij. Dan legt deze laag zich over tweehonderdvijftig
     schermen heen die er niets om gevraagd hebben -- precies de fout die een
     gedeelde laag onbruikbaar maakt.

     De lijst hieronder is met opzet EEN LIJST MET NAMEN en geen patroon. Alles
     wat met .gb- begint maakt de laag zelf; daarnaast staan er precies twee
     klassen van het huis op, en elke uitbreiding daarvan is een besluit dat
     hier zichtbaar wordt in plaats van in een diff van een blad.

     WAAROM .knop EROP STAAT. De UI-kit heet .rtg-knop maar wordt op 3 schermen
     gebruikt; de knop van dit huis heet gewoon .knop en staat 1402 keer op 176
     schermen. Gemeten voor het aanzetten: geen enkele pagina gebruikt
     .knop::after en geen enkele zet er position op. Daarom mag hij mee, en
     daarom staat hij in een :where() -- op nul specificiteit, zodat een pagina
     die er morgen wel iets over zegt gewoon wint. */
  const EIGEN = /^\.gb-/;                                  // van de laag zelf
  const GELEEND = new Set(['rtg-knop', 'knop']);           // van het huis, met naam
  const OMHULSEL = /^(html\.rtg-stil|:root|@)/;

  /* DE @MEDIA-OMHULSELS ERAF VOOR HET SPLITSEN, EN DAT IS GEEN DETAIL. Deze
     toets liet eerst een mutatie door die `button` aan de leenlijst toevoegde,
     en dat kwam hier: `@media (...){` maakte van het HELE blok een kiezer die
     met @ begon, waarna de regels erin nooit werden bekeken. Precies de regels
     die over honderdzesenzeventig schermen liggen (het licht) staan in zo'n
     blok. Een toets die het gevaarlijkste deel van zijn onderwerp niet leest,
     keurt niets (LAT.md regel 10) -- en dat is hoe hij gevonden werd: door de
     mutatie te draaien en te zien dat hij NIET beet. */
  const PLAT = CSSKAAL.replace(/@[a-z-]+[^{]*\{/g, '');
  const kiezers = PLAT.split('}').map((brok) => {
    const i = brok.indexOf('{');
    return i < 0 ? [] : brok.slice(0, i).split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  }).flat();
  assert.ok(kiezers.length > 20, 'het blad hoort echt gelezen te zijn');
  assert.ok(kiezers.some((k) => k.includes(':where(')),
    'de kiezers uit de @media-blokken horen meegelezen te zijn -- daar woont het licht');

  for (const k of kiezers) {
    if (OMHULSEL.test(k.replace(/^html\.rtg-stil\s*/, 'html.rtg-stil'))) {
      // een omhulsel telt niet zelf mee, maar wat erin staat wel
    }
    const kaal = k.replace(/^html\.rtg-stil\s+/, '').trim();
    if (OMHULSEL.test(kaal) || !kaal) continue;
    /* Alleen het ANKER telt: het meest linkse stuk van de kiezer. Wat daarbinnen
       staat (`.gb-doe svg`, `.gb-blad menu button`) leeft in een tak die de laag
       zelf heeft neergezet, en daar mag hij alles. Zodra het anker iets is dat
       van een scherm is, ligt de laag eroverheen -- en dat is wat hier niet mag.

       Een :where(...) wordt eerst opengevouwen: de reden dat hij er staat is de
       specificiteit, niet het verbergen van wat erin zit. */
    const anker = kaal.replace(/:where\(([^)]*)\)/, '$1').split(/[\s>+~]+/)[0];
    for (const stuk of anker.split(',')) {
      const naam = stuk.replace(/::?[a-z-]+(\([^)]*\))?/g, '').replace(/\[[^\]]*\]/g, '').trim();
      if (!naam || naam === '*') continue;
      assert.ok(EIGEN.test(naam) || GELEEND.has(naam.replace(/^\./, '')),
        'kiezer "' + k + '" begint bij "' + naam + '", en dat is niet van de gebarenlaag en staat niet ' +
        'met naam op de leenlijst; in rust hoort dit blad alleen te raken wat het zelf maakt');
    }
  }
});

test('de richtingsvergrendeling staat in het blad, niet alleen in de code', () => {
  /* DE MUTATIE: haal `touch-action:pan-y` van .gb-rij weg. De code blijft
     werken op een muis en zakt niet -- maar op een telefoon vecht elke veeg met
     het verticaal scrollen van de pagina en verliest hij. Dat is de soort fout
     die alleen op een echt toestel te zien is, dus hij hoort hier vast te staan. */
  assert.match(CSSKAAL, /\.gb-rij\s*\{[^}]*touch-action\s*:\s*pan-y/,
    '.gb-rij mist touch-action:pan-y -- zonder die regel is de veeg op een telefoon niet te winnen');
});

test('de lade draagt geen enkele echte knop, en de actielade alleen maar', () => {
  /* DE MUTATIE: maak in bouwLade() een <button> in plaats van een <span>.
     Het ziet er identiek uit en werkt met een muis. Maar bijna elke regel in dit
     huis is zelf een <a>, en een knop IN een link is ongeldige HTML: een
     schermlezer kondigt dan een knop aan binnen een link, en de tik erop
     navigeert bovendien.

     De afspraak is daarom: de lade is voor een HAND en is aria-hidden; de
     actielade is voor een TOETS en een schermlezer en heeft echte knoppen. */
  const bouw = JSKAAL.slice(JSKAAL.indexOf('function bouwLade'), JSKAAL.indexOf('function sluit'));
  assert.ok(bouw.length > 100, 'bouwLade() hoort gevonden te zijn');
  assert.ok(!/createElement\('button'\)/.test(bouw),
    'bouwLade() maakt een echte knop; in een <a> is dat ongeldige HTML en een knop-in-een-link voor een schermlezer');
  assert.match(bouw, /setAttribute\('aria-hidden', 'true'\)/,
    'de lade hoort aria-hidden te zijn: hij is het oppervlak voor de hand, niet voor de schermlezer');
  const knop = JSKAAL.slice(JSKAAL.indexOf('function knopVoor'), JSKAAL.indexOf('function groep'));
  assert.match(knop, /createElement\('button'\)/,
    'de actielade hoort WEL echte knoppen te maken -- dat is de weg voor toetsenbord en schermlezer');
});

test('een gebaar is nooit de enige weg naar een actie', () => {
  /* DE MUTATIE: haal de keydown-luisteraar weg. Alles blijft werken zolang je
     een hand hebt. WCAG 2.1.1 en 2.5.7 gaan precies over de mensen die dat niet
     hebben: geen enkele handeling mag alleen met slepen of alleen met een
     aanwijzer te doen zijn. Vier wegen horen te bestaan, en alle vier komen ze
     uit bij opendActielade(). */
  for (const weg of ['keydown', 'contextmenu', 'pointerdown', 'focusin']) {
    assert.match(JSKAAL, new RegExp("addEventListener\\('" + weg + "'"),
      'de weg via ' + weg + ' is weg; dan is het gebaar de enige ingang geworden');
  }
  assert.match(JSKAAL, /ArrowLeft[\s\S]{0,200}opendActielade/,
    'pijl links hoort de actielade te openen');
  assert.match(JSKAAL, /ContextMenu[\s\S]{0,120}opendActielade/,
    'de menutoets hoort de actielade te openen');
});

test('de browser mag de veeg niet afpakken met een sleeplink', () => {
  /* DIT IS EEN GEMETEN FOUT EN GEEN VOORZORG. Zonder deze regel stuurt Chromium
     na twee pixels een dragstart over de <a>, kaapt de aanwijzer en levert een
     pointercancel: de lade opende 10 pixels en bevroor. Gemeten in een echte
     browser, niet beredeneerd.

     DE MUTATIE: haal de dragstart-luisteraar weg. Op een telefoon merk je niets
     (daar bestaat geen sleeplink) en op een muis dooft elke veeg. */
  assert.match(JSKAAL, /addEventListener\('dragstart'[\s\S]{0,200}preventDefault/,
    'dragstart wordt niet meer tegengehouden -- dan pakt de browser elke muisveeg over een link af');
});

test('doorvegen raakt nooit een actie die vasthouden vraagt', () => {
  /* DE MUTATIE: haal `&& !g.acties[g.kant][0].borg` uit de drempeltoets. Dan
     kan een onomkeerbare actie op een misveeg gebeuren -- en dat is precies wat
     'borg' hoort te verhinderen. */
  assert.match(JSKAAL, /breedte\s*>=\s*g\.drempel\s*&&\s*!g\.acties\[g\.kant\]\[0\]\.borg/,
    'de drempel sluit borg-acties niet meer uit; dan voert een misveeg iets uit dat niet terug kan');
});

test('de drempel ligt voorbij de volle lade en voorbij de halve regel', () => {
  /* DE MUTATIE: zet de drempel op g.breed. Dan voert elke veeg die de lade net
     helemaal opent meteen de eerste actie uit, en is "even kijken wat er staat"
     onmogelijk geworden. */
  assert.match(JSKAAL, /g\.drempel\s*=\s*Math\.max\(g\.breed\s*\+\s*\d+,\s*g\.rij\.offsetWidth\s*\*\s*0?\.\d+\)/,
    'de drempel is geen maximum van (volle lade + marge) en (deel van de regel) meer');
});

test('minder beweging betekent geen beweging, niet minder bediening', () => {
  /* DE MUTATIE: laat de laag onder prefers-reduced-motion de gebaren helemaal
     uitzetten. Dat lijkt netjes en is het niet: wie beweging uitzet, vraagt om
     rust en niet om minder functies. Alleen de OVERGANGEN gaan uit. */
  assert.match(CSSKAAL, /@media \(prefers-reduced-motion:reduce\)[\s\S]{0,220}transition:none/,
    'de overgangen gaan niet uit bij prefers-reduced-motion');
  assert.match(CSSKAAL, /html\.rtg-stil[\s\S]{0,240}transition:none/,
    'de eigen rust-instelling van een lid (html.rtg-stil) zet de overgangen niet uit');
  assert.ok(!/prefers-reduced-motion[\s\S]{0,200}display\s*:\s*none\s*;?\s*\}[\s\S]{0,40}\.gb-lade/.test(CSSKAAL),
    'de lade zelf hoort niet te verdwijnen als iemand minder beweging vraagt');
});

test('de tijdlijn links van een regel schuift niet mee', () => {
  /* DE MUTATIE: haal de data-gb-vast-lus weg, of zet --gb-inzet op .reis terug
     naar nul. De regel veegt dan zijn eigen tijdlijn weg: de stip verdwijnt
     onder de lade en de doorlopende lijn breekt bij precies die ene regel. */
  assert.match(JS, /pos === 'absolute'[\s\S]{0,120}data-gb-vast/,
    'absoluut gepositioneerde kinderen worden niet meer vastgezet -- de stip veegt mee');
  assert.match(CSSKAAL, /\.gb-lade\[data-kant="links"\]\{left:var\(--gb-inzet/,
    'de linkerlade houdt geen rekening meer met --gb-inzet');
  assert.match(lees('public/shared/rtg-wereld.css'), /--gb-inzet\s*:/,
    '.reis zegt niet meer waar zijn tijdlijn ligt');
  assert.match(lees('public/shared/canvas.css'), /--gb-inzet\s*:[\s\S]{0,40}--gb-marge\s*:/,
    '.cv-wat zegt niet meer waar zijn stip en zijn lijn liggen');
});

test('elk raakvlak in de lade en de actielade haalt de 24 pixels', () => {
  /* De harde poort uit TOEGANKELIJK.md: 0 van 259 schermen mag zakken op een
     raakvlak kleiner dan 24x24 op telefoonformaat.
     DE MUTATIE: zet de min-height van een knop in de actielade op 20px. */
  assert.match(CSSKAAL, /\.gb-blad menu button\{[^}]*min-height:44px/,
    'een knop in de actielade is kleiner dan 44px hoog geworden');
  assert.match(CSSKAAL, /\.gb-greep\{[^}]*width:28px;height:28px/,
    'de greep is onder de 24x24 gezakt');
  assert.match(CSSKAAL, /\.gb-terug button\{[^}]*min-height:24px/,
    'de terugdraai-knop is onder de 24 pixels gezakt');
});

test('de terugdraai-melding wordt voorgelezen', () => {
  /* Doorvegen VOERT UIT. Wie het scherm niet ziet, hoort dan niets gebeuren --
     tenzij de melding een role heeft die een schermlezer oppikt.
     DE MUTATIE: haal role="status" weg. */
  assert.match(JSKAAL, /gb-terug[\s\S]{0,160}setAttribute\('role', 'status'\)/,
    'de terugdraai-melding draagt geen role=status meer');
});

test('het licht landt op de knop die dit huis echt gebruikt', () => {
  /* DE MUTATIE: haal .knop uit de kiezer van het licht. Alles blijft groen en
     het licht valt terug op .rtg-knop -- drie schermen. Dat is precies de fout
     die hier gemaakt is en pas bij het NATELLEN bleek: de UI-kit ligt op 233
     pagina's, maar zijn knopklasse wordt op 3 gebruikt. De knop van dit huis
     heet gewoon .knop, 1402 keer op 176 schermen.

     DEZE TOETS IS TWEE KEER AANGESCHERPT omdat de mutatie hem twee keer NIET
     liet zakken, en allebei die keren zeggen iets. Eerst las hij de rauwe tekst
     mee, en zijn eigen toelichting noemt .knop. Daarna zocht hij .knop ergens
     in het blad -- en vond hem in de uitgeschakeld-regel, terwijl het LICHT hem
     kwijt was. Nu wijst hij precies de regels aan die het licht maken. */
  const rules = CSSKAAL.replace(/@[a-z-]+[^{]*\{/g, '').split('}')
    .map((brok) => {
      const i = brok.indexOf('{');
      return i < 0 ? null : { kiezer: brok.slice(0, i).trim(), inhoud: brok.slice(i + 1) };
    }).filter(Boolean);

  const licht = rules.filter((r) => /radial-gradient/.test(r.inhoud));
  assert.equal(licht.length, 1, 'er hoort precies EEN regel te zijn die het lichtpunt tekent');
  assert.match(licht[0].kiezer, /:where\([^)]*\.knop[,)]/,
    'de lichtregel leent .knop niet; dan bereikt het licht 3 schermen in plaats van 176');

  const aan = rules.filter((r) => /::after/.test(r.kiezer) && /opacity:\s*1/.test(r.inhoud));
  assert.ok(aan.length && aan.every((r) => /\.knop[,)]/.test(r.kiezer)),
    'het licht gaat op hover nergens AAN voor .knop; de regel staat er dan wel maar doet niets');

  /* En hij hoort in een :where() te staan. Zonder die nul-specificiteit wint
     dit blad -- dat op het laatst aan de <head> wordt gehangen -- van elke
     pagina die zelf iets over de positie van zijn knop zegt. */
  assert.ok(!/(^|[^:(\w-])\.knop\s*[,{]/m.test(CSSKAAL.replace(/:where\([^)]*\)/g, 'W')),
    '.knop wordt buiten een :where() gepakt; dan wint dit blad van de pagina in plaats van andersom');
});

test('de regel draagt zelf een plaatsanker, ook zonder muis', () => {
  /* DE FOUT DIE HIER ONDER LIGT IS DE ERGSTE VAN DEZE LAAG, en hij stond er
     vanaf dag een. `position:relative` op .gb-rij stond alleen in de
     mediaquery van het AANWIJSLICHT -- `(hover:hover) and (pointer:fine)`.
     Op een telefoon is die onwaar, dus was de regel `position:static` en zocht
     de lade (position:absolute) een andere voorouder: de pagina.

     Gemeten in een echte browser met aanraakemulatie, voordat dit gerepareerd
     werd: regel 350x62 op y=80, lade 97x844 op y=0. Een balk van de bovenkant
     tot de onderkant van het scherm, NAAST de regel in plaats van erin. De veeg
     heeft dus nooit op een telefoon gewerkt -- het apparaat waar hij voor is.

     Waarom geen enkele toets dat zag: ze draaiden allemaal in een context met
     een muis, en daar zette de lichtregel de positie er per ongeluk bij. Een
     eigenschap die je nodig hebt, mag geen bijwerking van een andere regel zijn.

     DE MUTATIE: haal position:relative uit de .gb-rij-regel bovenaan het blad.
     Deze toets zakt; alles daarboven blijft groen, want die meten met een muis. */
  const buitenMedia = CSSKAAL.split('@media')[0];
  const regel = buitenMedia.split('}').map((brok) => {
    const i = brok.indexOf('{');
    return i < 0 ? null : { kiezer: brok.slice(0, i).trim(), inhoud: brok.slice(i + 1) };
  }).filter(Boolean).filter((r) => /(^|,)\s*\.gb-rij\s*(,|$)/.test(r.kiezer));

  assert.ok(regel.length, '.gb-rij hoort een regel te hebben BUITEN elke @media');
  assert.ok(regel.some((r) => /position\s*:\s*relative/.test(r.inhoud)),
    '.gb-rij krijgt position:relative alleen binnen een @media; op een telefoon valt de lade dan buiten de regel');
});

test('de drie wereldregisters delen EEN bouwer', () => {
  /* Kantoor, Sociaal en Reizen tekenen dezelfde .reis-regel. De eerste versie
     had de actiebouwer in kantoor.html staan; bij het tweede scherm was dat al
     een kopie, en bij het derde een patroon.
     DE MUTATIE: schrijf in sociaal.html weer een eigen RTGGebaar.lijst met een
     eigen actielijst. Beide schermen blijven werken -- tot iemand er in EEN van
     de twee een actie bij zet (LAT.md regel 4). */
  for (const scherm of ['kantoor', 'sociaal', 'reizen']) {
    const bron = lees('public/apps/' + scherm + '.html');
    assert.match(bron, /RTGGebaar\.wereldregister\(/,
      scherm + '.html hangt zijn register niet meer aan de gedeelde bouwer');
    assert.ok(!/RTGGebaar\.lijst\([^)]*\.reis/.test(bron),
      scherm + '.html bouwt zijn .reis-acties weer zelf; dat hoort in de laag te staan');
  }
  assert.match(JSKAAL, /function wereldregister\(wortel\)/,
    'de gedeelde bouwer is uit de laag verdwenen');
});

test('de klik na een veeg wordt eenmalig geslikt, niet op een klok', () => {
  /* DIT KOMT UIT EEN FOUT DIE TWEE DAGEN LANG ALLEEN AAN EEN WISPELTURIGE TOETS
     te zien was. De laag onderdrukte de klik die op een veeg volgt met een
     vlag plus `setTimeout(..., 60)`. Twee dingen daaraan waren mis, en allebei
     zie je ze niet door te kijken:

       1. zolang die vlag aanstond, slikte de laag ELKE klik op de pagina -- ook
          de knop Terugdraaien van zijn eigen melding, die nergens in de buurt
          van de geveegde regel staat;
       2. 60 ms is geen 60 ms. Een tabblad dat niet zichtbaar is krijgt zijn
          timers vertraagd; gemeten in een schermtoets duurde dat ruim een
          seconde, en precies in dat gat viel de klik die het gebaar moest
          kunnen terugdraaien.

     DE MUTATIE: zet er weer een vlag met een setTimeout neer. De schermtoets
     zakt dan de ene keer wel en de andere keer niet -- en juist daarom staat de
     regel hier ook statisch vast: een toets die maar de helft van de keren
     bijt, is geen poort. */
  /* Het ANKER is de luisteraar op het document, niet de eerste de beste
     klik-luisteraar: de eerste in het bestand is de knop van de melding, en die
     heeft een eigen (terechte) timer. Deze toets zakte daarop, en dat is een
     nuttige les over ankers -- indexOf pakt wat er het eerst staat, niet wat je
     bedoelt. */
  const vang = JSKAAL.slice(JSKAAL.indexOf("d.addEventListener('click', function (e) {"), JSKAAL.indexOf('function interactief'));
  assert.ok(vang.length > 100, 'de vangfase-luisteraar hoort gevonden te zijn');
  assert.ok(!/setTimeout/.test(vang),
    'er zit weer een timer in de klikonderdrukking; die is op een traag of onzichtbaar tabblad niet wat hij zegt');
  assert.match(vang, /slikRij\s*=\s*null/,
    'de onderdrukking is niet meer eenmalig -- zonder dat blijft hij klikken slikken die niets met het gebaar te maken hebben');
  assert.match(vang, /closest\('\.gb-rij'\)\s*===\s*slikRij/,
    'de onderdrukking kijkt niet meer of de klik OP de geveegde regel valt; dan slikt hij ook knoppen elders op het scherm');
});
