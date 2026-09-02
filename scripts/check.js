/* Bewaakt de afspraken van de codebase in een keer (npm run check):
   - alle server-bestanden compileren (node --check);
   - geen inline on-handlers in de HTML (die zouden de strenge nonce-CSP breken);
   - geen brede streepjes (em/en/figure/horizontal bar) in de bron (huistijl);
   - elke service-worker verwijst alleen naar bestanden die bestaan.
   Zo blijft de frontend zonder zwaar buildsysteem toch gedisciplineerd. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
let fouten = 0;
const fout = m => { console.error('  ✗ ' + m); fouten++; };
const ok = m => console.log('  ✓ ' + m);
const regexVeilig = (waarde) => String(waarde).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Commentaar eruit halen (regel- en blokcommentaar), zodat een uitleg als
   "// require('x') -> 'x'" niet als echte require wordt gelezen. Strings blijven
   staan; voor deze keuringen is dat genoeg. Staat in scripts/lib/bron.js omdat
   scripts/keuring.js hem ook gebruikt. */
const { zonderCommentaar, zonderTekst } = require('./lib/bron');
const { paginaDraagt } = require('./lib/hulpcss');

function loop(dir, filter, fn) {
  for (const naam of fs.readdirSync(dir)) {
    const vol = path.join(dir, naam);
    /* De meterijk-toets maakt expres kortlevende bronbestanden. Als de volle
       suite tegelijk met deze keuring draait, kan zo'n bestand tussen readdir
       en stat verdwijnen. Dat is geen syntaxfout; sla uitsluitend ENOENT over
       en laat elke echte lees-/rechtenfout nog steeds hard vallen. */
    let st;
    try { st = fs.statSync(vol); }
    catch (e) { if (e && e.code === 'ENOENT') continue; throw e; }
    /* De overslaglijst matcht op de HELE mapnaam en niet op een deelstring.
       Stond hier `/data/`, en daardoor sloeg elke regel in dit bestand stilletjes
       server/kern/appgids-data, server/kern/initdata, server/kern/leerstof-data
       en server/foundation/buddy/coachdata over -- vier mappen met echte
       productcode. Niet gemeld, niet geteld: de keuring vond er wel bestanden
       over de 10 kB die check.js nooit had gezien.

       Dit is regel 10 van de lat op de handhaver zelf. Een meter die een deel
       van zijn invoer niet eens BEKIJKT, zegt niet "in orde" maar "ik heb niet
       gekeken", en dat verschil was hier onzichtbaar. */
    if (st.isDirectory()) { if (!/^(node_modules|\.git|data|dist)$/.test(naam)) loop(vol, filter, fn); }
    else if (filter.test(naam)) fn(vol);
  }
}

/* DE BROWSERSCRIPTS STONDEN HIER NIET BIJ, en dat is de gevaarlijkste helft.

   Deze regel keurde alleen server/. Een kapotte servermodule merk je meteen --
   de server start niet -- maar een kapot bestand in public/shared laadt gewoon,
   valt stil in de console van de bezoeker, en neemt elke app-pagina mee die het
   nodig heeft. Er is geen foutmelding waar iemand naar kijkt.

   Gevonden door het per ongeluk te doen: een snede in shared/ios.js viel midden
   in een commentaarblok, ios.js was daarmee geen geldige JS meer, en deze
   keuring meldde "Alles in orde". Elke app-pagina had toen zijn navigatiebalk,
   grote titel, home-indicator en app-menu verloren.

   Bundels (public/apps/leverancier.js en broers) doen mee: dat is wat er
   uitgeserveerd wordt. De losse delen NIET -- die zijn per stuk geen geldig
   programma (deel 2 begint midden in een functie), en dat is precies de opzet.
   public/dist is bouwuitvoer. */
console.log('1) server-, browser- en testbestanden compileren');
const { bundels: BUNDELLIJST } = require('./bundel');
const DEELMAPPEN = new Set(Object.values(BUNDELLIJST).map((d) => 'public/' + d + '/'));
function compileerbaar(rel) {
  if (rel.startsWith('public/dist/') || rel.includes('/data/')) return false;
  for (const map of DEELMAPPEN) if (rel.startsWith(map)) return false;
  return true;
}

/* Deze regel startte 4823 processen (`spawnSync(node --check)` per bestand) en
   deed daar 127.619 ms over -- vrijwel allemaal procesopstart. In-proces kost
   hetzelfde werk 1.188 ms, en daarmee ging de VOLLE keuring van ongeveer 160
   naar 34 seconden. Waarom dat meer is dan ongeduld, en waarom er een
   CommonJS-wikkel omheen MOET: de kop van scripts/lib/syntaxproef.js.
   test/syntaxproef.test.js legt de twee wegen op elk geval naast elkaar. */
const { syntaxfout } = require('./lib/syntaxproef');
for (const map of ['server', 'public', 'test']) {
  loop(path.join(ROOT, map), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (!compileerbaar(rel)) return;
    /* Zelfde ENOENT-uitzondering als in loop(): de meterijk-toets maakt
       kortlevende bestanden, en die mogen tussen readdir en read verdwijnen. */
    let bron;
    try { bron = fs.readFileSync(f, 'utf8'); }
    catch (e) { if (e && e.code === 'ENOENT') return; throw e; }
    const m = syntaxfout(bron, f);
    if (m) fout('syntaxfout in ' + rel + '\n  ' + m);
  });
}
if (!fouten) ok('alle server-, browser- en testbestanden compileren');

/* Deze regel kijkt alleen in de .html-bestanden, want dat is de snelle
   keuring. De volledige variant staat in test/blindevlek.test.js (toets 6): die
   kijkt ook in de JS die HTML opbouwt, en juist daar zat het geval dat hier
   jarenlang doorheen glipte. */
console.log('2) geen inline on-handlers in de HTML (nonce-CSP)');
let inline = 0;
loop(path.join(ROOT, 'public'), /\.html$/, f => {
  const s = fs.readFileSync(f, 'utf8');
  const m = s.match(/\son(click|change|input|submit|load|error|keydown|keyup|mouseover|mouseout|focus|blur|touchstart)\s*=/gi);
  if (m) { inline += m.length; fout(m.length + ' inline handler(s) in ' + path.relative(ROOT, f)); }
});
if (!inline) ok('geen inline handlers');

console.log('3) geen brede streepjes in de bron (huistijl; de min-knop mag)');
// regex uit codepunten opbouwen, zodat dit bestand zelf geen streepjes bevat
const STREEP = new RegExp('[' + [0x2012, 0x2013, 0x2014, 0x2015].map(c => String.fromCharCode(c)).join('') + ']', 'g');
let streep = 0;
for (const map of ['server', 'public', 'test', 'scripts']) {
  loop(path.join(ROOT, map), /\.(js|html|css|md)$/, f => {
    const m = fs.readFileSync(f, 'utf8').match(STREEP);
    if (m) { streep += m.length; fout(m.length + ' streepje(s) in ' + path.relative(ROOT, f)); }
  });
}
if (!streep) ok('geen brede streepjes');

/* Emoji horen niet in de bron van server/ en public/: het beeld komt uit de
   eigen glyfenset (public/shared/glyf.js), niet uit de emoji-font van het
   besturingssysteem. Een tegel die een onbekende glyfnaam krijgt valt netjes
   terug op een Bodoni-monogram, dus een naam is altijd veiliger dan een
   plaatje dat er op elk toestel anders uitziet.

   test/ en scripts/ vallen er bewust BUITEN: die voeren emoji juist als INVOER
   aan de server (onnozel.test.js, beproeving.js). Daar zijn ze een test, geen
   huisstijl. */
console.log('3b) geen emoji in server/ en public/ (het beeld komt uit glyf.js)');
const EMOJI = new RegExp(
  '[\\u{1F000}-\\u{1FAFF}]' +
  '|[\\u{2190}-\\u{27BF}]\\u{FE0F}' +
  '|[\\u{231A}-\\u{231B}\\u{23E9}-\\u{23F3}\\u{25FD}-\\u{25FE}\\u{2614}-\\u{2615}' +
  '\\u{26A1}\\u{26AA}-\\u{26AB}\\u{26BD}-\\u{26BE}\\u{26C4}-\\u{26C5}\\u{26D4}' +
  '\\u{26EA}\\u{26F2}-\\u{26F3}\\u{26F5}\\u{26FA}\\u{26FD}\\u{2705}\\u{270A}-\\u{270B}' +
  '\\u{2728}\\u{274C}\\u{274E}\\u{2753}-\\u{2755}\\u{2757}\\u{2795}-\\u{2797}' +
  '\\u{27B0}\\u{27BF}]', 'gu');
let emo = 0;
for (const map of ['server', 'public']) {
  loop(path.join(ROOT, map), /\.(js|html|css|json|webmanifest)$/, f => {
    if (/[\\/](dist|min|data|campagne)[\\/]/.test(f)) return; // gegenereerd of runtime
    const m = fs.readFileSync(f, 'utf8').match(EMOJI);
    if (m) { emo += m.length; fout(m.length + ' emoji in ' + path.relative(ROOT, f) + ' (' + [...new Set(m)].slice(0, 6).join('') + ')'); }
  });
}
if (!emo) ok('geen emoji in de bron');

console.log('4) service-workers verwijzen naar bestaande bestanden');
let shellFout = 0;
loop(path.join(ROOT, 'public'), /^sw\.js$/, f => {
  const s = fs.readFileSync(f, 'utf8');
  const m = s.match(/'\/[^']+\.(html|js|css|svg|webmanifest)'/g) || [];
  for (const ruw of m) {
    const rel = ruw.slice(2, -1); // '/apps/..' -> apps/..
    if (rel.includes('manifest')) continue; // manifests kunnen elders staan
    if (!fs.existsSync(path.join(ROOT, 'public', rel))) { shellFout++; fout('ontbrekend shell-bestand ' + rel + ' in ' + path.relative(ROOT, f)); }
  }
});
if (!shellFout) ok('service-worker-shells kloppen');

console.log('5) statische toegankelijkheid (altijd, ook zonder browser)');
// a) elke pagina heeft een taal; b) elke <img> heeft alt; deze gelden overal.
let a11y = 0;
loop(path.join(ROOT, 'public'), /\.html$/, f => {
  const s = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);
  const htmlTag = s.match(/<html\b[^>]*>/i);
  if (htmlTag && !/\blang\s*=/.test(htmlTag[0])) { a11y++; fout('ontbrekend lang-attribuut op <html> in ' + rel); }
  const imgs = s.match(/<img\b[^>]*>/gi) || [];
  for (const img of imgs) if (!/\balt\s*=/.test(img)) { a11y++; fout('<img> zonder alt in ' + rel); }
});
// c) de vlaggenschip-schermen moeten een sla-over-link en een main-landmark hebben.
const VLAGGENSCHIP = ['apps/index.html', 'apps/app.html',
  'apps/foundation/index.html', 'apps/foundation/vrienden.html'];
for (const rel of VLAGGENSCHIP) {
  const p = path.join(ROOT, 'public', rel);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  if (!/class="skip"/.test(s)) { a11y++; fout('geen sla-over-link (class="skip") in ' + rel); }
  if (!/<main\b/i.test(s) && !/role="main"/.test(s)) { a11y++; fout('geen main-landmark in ' + rel); }
}
if (!a11y) ok('taal, alt-teksten, skip-links en landmarks aanwezig');

console.log('\n6) gebundelde app-scripts gelijk aan hun losse delen');
try { require('./bundel').controleer(); ok('leverancier.js en app-main.js komen overeen met public/apps/<naam>/'); }
catch (e) { fout(e.message); }

/* 7) Elke letterlijke, relatieve require() moet naar een bestaande module wijzen.
   node --check ziet dit NIET (require draait pas op runtime), dus een kapot pad
   dat door een verplaatsing ontstaat (./rahul terwijl het ../rahul moet zijn)
   blijft anders onopgemerkt tot precies dat pad draait -- vaak alleen met een
   echte AI-sleutel, dus buiten de tests om. Deze scan vangt die klasse meteen. */
console.log('\n7) alle relatieve requires (server/ + scripts/) verwijzen naar bestaande modules');
let reqFout = 0;
for (const map of ['server', 'scripts']) {
  loop(path.join(ROOT, map), /\.js$/, f => {
    const maker = require('module').createRequire(f);
    /* COMMENTAAR ERUIT MET DE GEDEELDE WRINGER, en niet met een eigen zeef.

       Hier stond een regel-heuristiek: sla een regel over als hij getrimd
       begint met `//`, `*` of `/*`. Die klopt voor blokcommentaar dat elke
       vervolgregel met een asterisk begint -- en dit huis schrijft zijn
       blokcommentaar juist ZONDER die asterisk (zie de kop van dit bestand, en
       elke meter in scripts/). Een vervolgregel begint dus gewoon met een woord,
       en de scan las hem als code.

       Gevolg: elke uitleg die een pad NOEMT werd een kapotte require. Gevonden
       toen scripts/magnaatlab.js in zijn kop uitlegde waarom de wringer van
       objectmodel.js daar niet deugt -- die uitleg citeert een require, en rule
       7 verklaarde het bestand stuk terwijl er niets stuk was.

       Dat is precies wat lib/bron.js bestaat om te voorkomen (LAT.md regel 4:
       twee plekken die dezelfde waarheid vasthouden). check.js gebruikt hem al
       op dertien andere plekken; deze regel was de uitzondering. De regelnummers
       gaan bij het wringen verloren en dat kost hier niets: deze melding noemt
       het bestand en het pad, geen regel. */
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    const re = /require\((["'])(\.[^"']*)\1\)/g; let m;
    while ((m = re.exec(bron))) {
      try { maker.resolve(m[2]); }
      catch (e) { reqFout++; fout("kapotte require('" + m[2] + "') in " + path.relative(ROOT, f)); }
    }
  });
}
if (!reqFout) ok('alle relatieve requires resolven');

/* 8) Geen achtergebleven .only in de tests: een enkele test.only/describe.only
   laat de rest van de suite stilletjes NIET draaien -- dan is groen een leugen. */
console.log('\n8) geen .only in de tests (anders draait de suite maar deels)');
let onlyFout = 0;
loop(path.join(ROOT, 'test'), /\.js$/, f => {
  const m = fs.readFileSync(f, 'utf8').match(/\b(?:describe|test|it|suite)\.only\s*\(/g);
  if (m) { onlyFout += m.length; fout(m.length + ' achtergebleven .only in ' + path.relative(ROOT, f)); }
});
if (!onlyFout) ok('geen .only in de tests');

/* 9) Geen kruis-slice variabele-referenties in opgesplitste modules. Na het opknippen
   van een monoliet in X/index.js + zusjes woont een gedeelde top-level local nog maar in
   EEN slice; verwijst een ander slice er kaal naar, dan is dat een ReferenceError die pas
   op runtime knalt (vaak op een AI-pad dat de tests niet raken). node --check ziet het
   niet. De scan zelf staat in scripts/kruisscan.js (met eigen tests). */
console.log('\n9) geen kruis-slice variabele-referenties in opgesplitste modules');
const kruis = require('./kruisscan').scan(path.join(ROOT, 'server'));
for (const b of kruis) fout('kruis-slice: ' + b.bestand + " gebruikt \"" + b.naam + "\" (top-level in zuster " + b.zuster + ')');
if (!kruis.length) ok('geen slice raakt een top-level naam van een zuster-slice kaal');

/* 10) De 9+-keuring: elke app-pagina (leden-OS en RTFoundation) houdt de
   basiskwaliteit vast: taal, viewport, titel, favicon, een main-landmark en
   de gedeelde basis-laag (offline, reduced-motion, invoerbegrenzing en de
   uitleg-gids). De app-gids op de server dekt bovendien elke pagina met een
   eigen uitleg, zodat het ?-knopje nooit een lege dop is. */
console.log('\n10) de 9+-keuring op alle app-pagina\'s');
{
  const appgids = require('../server/kern/appgids');
  let np = 0;
  const paginas = [];
  loop(path.join(ROOT, 'public/apps'), /\.html$/, f => paginas.push(f));
  for (const f of paginas) {
    const rel = path.relative(path.join(ROOT, 'public'), f).replace(/\\/g, '/');
    const s = fs.readFileSync(f, 'utf8');
    /* EEN OMLEIDING IS GEEN SCHERM. Een pad dat is opgegaan in een ander blijft
       bestaan -- er kan van buiten naar gelinkt zijn, en een dood pad is erger
       dan een omleiding -- maar het is een briefje van drie regels en geen app.
       Een main-landmark, de basis-laag en de metgezel-laag eisen van zo'n
       briefje betekent: drie scripts laden op een pagina die er 0 ms staat, en
       een <main> om een zin die niemand leest.

       Streng afgebakend, zodat dit geen achterdeur wordt: er moet een
       meta-refresh IN staan, hij moet naar een pagina van onszelf wijzen, en er
       mag geen <script src> op staan. Een pagina die iets DOET valt er dus
       buiten, ook als er toevallig een refresh in staat. */
    const omleiding = /<meta[^>]+http-equiv=["']refresh["'][^>]+url=\/[^"'>]+/i.test(s) &&
      !/<script[^>]+src=/i.test(s);
    if (omleiding) continue;
    const htmlTag = s.match(/<html[^>]*>/i);
    if (!htmlTag || !/\blang\s*=/.test(htmlTag[0])) { np++; fout('9+: geen lang op <html> in ' + rel); }
    if (!/name="viewport"/.test(s)) { np++; fout('9+: geen viewport in ' + rel); }
    if (!/<title>[^<]+<\/title>/.test(s)) { np++; fout('9+: lege of ontbrekende titel in ' + rel); }
    if (!/rel="icon"/.test(s)) { np++; fout('9+: geen favicon in ' + rel); }
    if (!/<main\b/i.test(s) && !/role="main"/.test(s)) { np++; fout('9+: geen main-landmark in ' + rel); }
    if (!s.includes('/shared/basis.js')) { np++; fout('9+: basis-laag (shared/basis.js) ontbreekt in ' + rel); }
    if (!s.includes('/shared/metgezel.js')) { np++; fout('9+: metgezel-laag (Rahul + wauw + palet) ontbreekt in ' + rel); }
    const gids = appgids.gidsVan('/' + rel);
    if (!gids || gids.algemeen) { np++; fout('9+: geen eigen app-gids voor /' + rel + ' (vul kern/appgids.js aan)'); }
  }
  if (!np) ok(paginas.length + ' app-pagina\'s voldoen aan de 9+-basis (taal, viewport, titel, favicon, landmark, basis-laag, metgezel/wauw, eigen gids)');
}

/* 11) bedradings-contract: elke `accounts.<methode>(` die de server aanroept,
   moet ook echt een export zijn. Zo glipt een crash-bij-opstart (aangeroepen
   functie bestaat niet in module.exports) nooit meer langs de groene tests. */
console.log('\n11) bedradings-contract: aangeroepen accounts.<methode> bestaat als export');
{
  let contractFout = 0;
  try {
    const accounts = require('../server/accounts');
    const bekend = new Set(Object.keys(accounts));
    const bestanden = [];
    loop(path.join(ROOT, 'server'), /\.js$/, f => bestanden.push(f));
    for (const f of bestanden) {
      const bron = fs.readFileSync(f, 'utf8');
      const re = /\baccounts\.([A-Za-z_$][\w$]*)\s*\(/g;
      let m;
      while ((m = re.exec(bron))) {
        if (!bekend.has(m[1])) { contractFout++; fout('accounts.' + m[1] + '() aangeroepen in ' + path.relative(ROOT, f) + ', maar niet geëxporteerd'); }
      }
    }
  } catch (e) { contractFout++; fout('kon het accounts-contract niet controleren: ' + e.message); }
  if (!contractFout) ok('alle aangeroepen accounts-methoden bestaan als export');
}

/* 12) elk inline script op een pagina is geldige JS.

   Deze regel bestaat door twee echte fouten die maandenlang meeliepen zonder
   dat iets ze zag:

   - kantoren.html: een eerdere ronde plakte de link- en scriptregel van het
     desktopframe MIDDEN IN een JS-string. Het sluitende scripttag-teken in die
     regel beëindigde het inline script van de pagina, waarna de rest van het
     bestand als platte tekst in beeld kwam.
   - hangar.html: een ternair zonder dubbele punt. Het hele script draaide
     nooit; de pagina bleef eeuwig op "Laden...".

   Beide gevallen kwamen door geen enkele toets: de suite draait op de server,
   en dit is stuk in de browser. We knippen het blok op precies de manier waarop
   een HTML-lezer dat doet (tot het EERSTE sluitende scripttag-teken) en laten
   de JS-lezer erover. new Function() ontleedt zonder uit te voeren. */
const { parse: ontleed } = require('./ast/parser');
console.log('\n12) inline scripts op pagina\'s zijn geldige JS');
{
  let stuk = 0;
  const paginas2 = [];
  loop(path.join(ROOT, 'public'), /\.html$/, f => paginas2.push(f));
  const OPEN = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  for (const f of paginas2) {
    const t = fs.readFileSync(f, 'utf8');
    const laag = t.toLowerCase();
    OPEN.lastIndex = 0;
    let m;
    while ((m = OPEN.exec(t))) {
      const start = m.index + m[0].length;
      const eind = laag.indexOf('</scr' + 'ipt>', start);
      const regel = t.slice(0, start).split('\n').length;
      if (eind < 0) { stuk++; fout(path.relative(ROOT, f) + ' regel ' + regel + ': inline script wordt nooit gesloten'); break; }
      /* Ontleden met de EIGEN parser (scripts/ast/parser.js), niet met
         new Function(). Dat laatste stond er eerst, en de AST-scanner keurde het
         terecht af: new Function() bouwt code uit een string. Voor een
         keuringsscript is dat extra ongelukkig -- het is precies de regel die
         wij zelf handhaven. De eigen parser doet hetzelfde werk zonder ook maar
         iets uit te voeren. */
      try { ontleed(t.slice(start, eind)); }
      catch (e) { stuk++; fout(path.relative(ROOT, f) + ' regel ' + regel + ': inline script is geen geldige JS -- ' + String(e.message).slice(0, 80)); }
      OPEN.lastIndex = eind;
    }
  }
  if (!stuk) ok(paginas2.length + ' pagina\'s: elk inline script ontleedt zonder fout');
}

/* 13) modulegrootte: productcode blijft onder de 10 KB per bestand.

   De norm bestond al, maar niets hield hem vast -- en dus was hij weggezakt:
   63 bestanden stonden erboven, tot 162 KB. Met deze regel kan dat niet meer
   sluipen. De grens is een dakpan, geen wet: een bestand dat er net boven komt
   is een teken dat er een tweede onderwerp in zit.

   Wat NIET meetelt:
   - bundels (apps/leverancier.js en broers): dat is bouwuitvoer, de bron staat
     opgeknipt in de delen-map en regel 6 bewaakt dat ze gelijk zijn;
   - tests: een toetsbestand is een samenhangend scenario. In stukken hakken
     maakt de suite slechter leesbaar, niet beter;
   - public/dist: geminificeerde uitvoer.

   De uitzonderingen hieronder staan MET naam en reden. Dat is bewust: zo zie je
   ze en kan de lijst krimpen. Hij hoort niet te groeien. */
console.log('\n13) modulegrootte: productcode onder de 10 KB per bestand');
{
  const MAX = 10 * 1024;
  const { bundels } = require('./bundel');
  const bundelPaden = new Set(Object.keys(bundels).map(k => 'public/' + k));
  /* Uitzonderingen, met reden. Dit zijn allemaal EEN ondeelbaar stuk: een
     tabeldefinitie of een enkele lange opbouwfunctie. Er zit geen sectiegrens
     in, en er middenin knippen levert twee onleesbare helften op. */
  const MAG = new Map([
    ['public/apps/leverancier/leverancier-01.js', 'tabeldefinitie van de tabs (TABDEF), een tabel'],
    ['public/apps/leverancier/leverancier-03.js', 'een opbouwfunctie zonder binnengrens'],
    ['public/apps/leverancier/leverancier-10.js', 'de stationsweergave: een keten if/else per werkplek'],
    ['public/apps/leverancier/leverancier-14.js', 'een opbouwfunctie zonder binnengrens'],
    ['public/apps/app-main/app-main-52.js', 'een HTML-opbouw in een string, in een keer'],
    ['public/apps/personeel/personeel-17.js', 'een opbouwfunctie zonder binnengrens'],
    ['public/apps/backoffice/backoffice-03.js', 'een opbouwfunctie zonder binnengrens'],
    ['public/apps/chauffeur.js', 'de chauffeurs-PDA is een gesloten browser-state-machine: API-waarheid, ritfasen, apparaatmeldingen en locatiedeling delen dezelfde levenscyclus en worden samen afgebroken bij rit-einde'],
    ['public/shared/glyf/glyf-02.js', 'de glyfentabel: elk icoon een pad, hoort bij elkaar'],
    ['public/shared/klok3d/klok3d-01.js', 'de 3D-klok: een aaneengesloten tekenlus'],
    ['public/shared/metgezel/metgezel-01.js', 'de metgezel-laag in een IIFE zonder binnengrens'],
    ['server/kern/livinglab/kader.js', 'de tabellen van het Living Lab (cyclus, soorten, methoden, rollen, bewijsgraden, risicoklassen): één tabelset zonder logica, en juist het bestand dat NIET op twee plekken mag staan'],
    /* Dezelfde reden als kader.js hierboven, en scherper. Dit is het
       genre-register: 73 regels data, geen logica (die staat in ./genres.js).
       Het ging over de grens toen elk genre een toegangsstand kreeg -- dus door
       de DATA en niet door een tweede onderwerp. En opknippen is hier niet
       neutraal: dit bestand bestaat juist omdat de 73 genres verspreid stonden
       over tien initdata-delen en zes kernmodules. Het in tweeën hakken zet die
       verspreiding weer in gang, en test/genreregister.test.js bewaakt precies
       dat het EEN plek blijft. */
    ['server/seed/genres-lijst.js', 'het genre-register: 73 regels pure data zonder logica, en juist het bestand dat NIET op twee plekken mag staan'],
    ['server/kern/werkplek-kantoren.js', 'de enterprise-kantoorcatalogus: zestien afdelingen met rollen en bestaande app-ingangen, een pure definitietabel die opknippen weer twee bronnen van waarheid maakt'],
    ['public/shared/i18n/i18n-01.js', 'de taaltabel + kiezer, een geheel'],
    ['public/shared/i18n/i18n-03.js', 'de taaltabel + kiezer, een geheel'],
    ['server/server.js', 'de bedrading van de hele app; wordt per ronde verder verdund'],
    /* De vijfenvijftig bureau-routes staan sinds regel 45 VOLUIT: een pad dat
       met een plus wordt gebouwd ziet de schakelkast niet, en dan is de route
       vanuit de boardroom niet te sturen. Dat maakt dit bestand langer dan de
       maat, maar niet ingewikkelder: het is een aaneengesloten registratielijst
       van zes bureaus, met het werk zelf in EEN handler-fabriek erboven.

       Opknippen is geprobeerd en teruggedraaid. De drie bureaus die meegingen
       namen ook de plank-route mee, die op db en op de werkplekcode leunt; wat
       ontstond was geen tweede bestand maar een half bestand, en de toetsen
       lieten dat meteen zien. Een lijst hoort bij elkaar te blijven. */
    ['server/routes/werkplek-bureaus.js', 'de registratielijst van zes bureaus, voluit sinds regel 45; het werk staat in EEN handler erboven'],
    ['server/opzet/kernlaag4.js', 'een ophanglijst, geen module: elke regel hangt een kern op aan de vorige laag. Dezelfde reden als server.js hierboven -- er zit geen naad in, alleen volgorde, en die volgorde IS de inhoud'],
    /* Deze twee zijn HETZELFDE SOORT BESTAND als kernlaag4.js hierboven, en ze
       gingen erover toen kern/concern werd opgehangen (CONCERN.md). Dat is een
       regel die erbij moest: een kern die nergens hangt, draait niet.

       Ze horen in MAG en niet in NOG, want er valt niets te knippen dat het
       beter maakt. Een ophanglijst in tweeën hakken levert twee halve lijsten
       op waarvan de volgorde tussen de helften niet meer te lezen is -- en die
       volgorde is precies de inhoud: kernlaag4b hangt het concern op NA de
       onderneming, omdat het er een bestaande onderneming in aanwijst. */
    ['server/opzet/kernlaag4b.js', 'een ophanglijst, geen module; zie kernlaag4.js hierboven -- de volgorde IS de inhoud'],
    /* kernlaag1 en kernlaag2 zijn dezelfde soort lijst en stonden er alleen nog
       niet op omdat ze er nog net onder bleven -- kernlaag2 met 118 bytes
       speling. Een grens die je haalt door niets meer toe te voegen, is geen
       grens maar een rem, en dat is niet wat regel 13 wil zeggen. Ze horen in
       MAG om precies dezelfde reden als hun twee broers hierboven: een
       ophanglijst in tweeën hakken levert twee halve lijsten op waarvan de
       volgorde tussen de helften niet meer te lezen is.

       LET OP WAT DIT NIET IS: een uitzondering voor "het paste net niet". De
       reden staat erbij en geldt voor dit SOORT bestand; een gewone module die
       erover gaat, hoort nog steeds geknipt te worden. */
    ['server/opzet/kernlaag1.js', 'een ophanglijst, geen module; zie kernlaag4.js hierboven -- de volgorde IS de inhoud'],
    ['server/opzet/kernlaag2.js', 'een ophanglijst, geen module; zie kernlaag4.js hierboven -- de volgorde IS de inhoud'],
    ['server/opzet/routes.js', 'de mountlijst van alle routers: geen naad, alleen volgorde, net als de kernlagen'],
    ['public/apps/boardroom-eigenaar.js', 'de eigenaarszetel: vier panelen op een gedeelde api/el-kern in een IIFE'],

    /* DEZE TWEE ZIJN GEMETEN VOOR ZE HIER KWAMEN, en dat getal hoort erbij te
       staan. Een uitzondering met alleen een verhaal is niet na te rekenen.

         server/bewaarbeleid.js   10,3 KB waarvan 5,2 KB code
         server/lib/keten.js      10,4 KB waarvan 2,9 KB code

       Bij allebei zit de helft of meer in de kop, en dat is hier geen luxe maar
       de inhoud: het bewaarbeleid is een TABEL waarin elke regel een termijn
       met een grondslag is (dezelfde soort als livinglab/kader.js hierboven),
       en keten.js legt in zijn kop uit wat een hashketen NIET tegenhoudt --
       precies het stuk dat je moet lezen voor je erop vertrouwt.

       En let op wat hier NIET is gebeurd: de maat is niet verzet naar "alleen
       codebytes". Dat is nagerekend en het zou 21 van de 23 bestaande
       uitzonderingen in een klap laten slagen, ook server/db/index.js van 23 KB.
       Een ratel die je losdraait omdat je er zelf tegenaan loopt, is geen
       ratel. */
    ['server/bewaarbeleid.js', 'de bewaartabel: een regel per tak met termijn en grondslag, geen logica -- 5,2 KB code van 10,3 KB'],
    ['server/lib/keten.js', 'een ketenprimitief van 2,9 KB code; de rest is de kop die uitlegt wat het middel NIET tegenhoudt, en dat hoort bij de code die het beweert']
  ]);
  /* NOG TE DOEN. Deze staan net boven de grens en moeten opgeknipt worden, maar
     dat is bij een servermodule geen byte-knip: het vraagt echte bedrading
     (require/export), en dat doe je een voor een met de toetsen ernaast. Ze
     WAARSCHUWEN hier dus, ze breken de keuring niet -- anders staat het licht
     voor iedereen op rood voor iets wat gepland is. De lijst hoort te krimpen. */
  const NOG = new Set([
    /* Deze zeven kwamen bij de brede PR-integratie net over de lat. De naden zijn
       benoemd, maar horen met hun gerichte toetsen in een aparte onderhoudsronde
       te worden geknipt en niet tijdens het samenvoegen van twintig releases. */
    'server/accounts/users.js',
    'server/kern/fiscaal/index.js',
    'server/kern/vergeten.js',
    'server/opzet/diensten2.js',
    'server/opzet/leverancierpoort.js',
    'public/apps/app-main/app-main-09a.js',
    'public/shared/teamcall/teamcall-01.js',
    /* DRIE UIT DE IDEM- EN UITROLRONDE. Ze staan hier en niet in MAG, want bij
       alle drie is de naad aan te wijzen -- en een naad die je kunt benoemen
       hoort geknipt te worden, niet vrijgesteld.

         server/lib/idem-poort.js          11,3 KB / 4,1 KB code
           de bewaarkast IS eruit (./idem-kast.js, 4,3 KB): de ring, het venster
           en de regel dat alleen een geslaagd antwoord erin mag, staan nu los
           en zonder een enkel begrip uit het web erin. Wat hier over is, is het
           http-deel -- en dat ligt nog boven de maat. De volgende naad is de
           SLEUTELBEPALING (welke sleutel geldt, en van wie) los van wat de
           poort met een herhaling doet.

         server/kern/command/uitrolregie.js  12,7 KB / 7,6 KB code
           naad: het METEN (5xx over al het verkeer sinds de sport) los van het
           BESLUIT (klimmen, zakken, wachten op een mens). Nu deelt het een
           bestand omdat het meten er ooit bij hoorde.

         server/functies/register/index.js  12,8 KB / 5,8 KB code
           naad: de FASES-ladder los van het register zelf. Ze hangen aan elkaar
           via een controle bij het laden, en die controle hoort mee te
           verhuizen -- anders valt de ladder stil naast het register. */
    'server/lib/idem-poort.js',
    'server/kern/command/uitrolregie.js',
    'server/functies/register/index.js',
    /* Drie van de vier NOG-gevallen uit de samenvoeging van 24 augustus
       (state.js, functieschakelaars.js, poortwachters.js) staan er niet meer:
       op 26 augustus zijn ze onder de grens teruggebracht door het proza in te
       dichten zonder een redenering te schrappen -- de groei zat in toelichting,
       niet in code. De naden die hier beschreven stonden blijven de juiste
       knipplekken zodra ze WEL weer groeien.
       (verkoop.js stond hier ook en is al geknipt: ./inwissel.js) */
    /* TWEE UIT DE SAMENVOEGING VAN 25 AUGUSTUS (main +50). Zelfde patroon als de
       vier hierboven: main breidde ze uit terwijl wij er aan de andere kant bij
       kwamen, en bij allebei is de naad te benoemen -- dus NOG en niet MAG.

         server/kern/pay/index.js   10,3 KB
           naad: de KERN van het grootboek (pasToe, boek, boekAsync -- wat een
           boeking DOET met de saldi) los van de BEDRADING (welke deelmodule er
           aan de api wordt geschroefd: verzoeken, kassa, tegoed, zaakbetaling,
           verkoop). Ze delen een bestand omdat het grootboek er ooit het enige
           was; de regels van dubbel boekhouden in de kop horen met de kern mee
           te verhuizen, niet bij de bedrading achter te blijven.
         (server/web/routing.js stond hier ook en is op 26 augustus onder de
          grens teruggebracht via het proza; de naad -- dispatch-index los van
          afhandelen -- blijft de knipplek zodra hij weer groeit.) */
    /* public/shared/media.js stond op 10238 bytes -- TWEE onder de grens -- en
       ging erover zodra er een gemeten oorzaak bij de foutentabel kwam
       (NotSupportedError). Hij hoort in NOG en niet in MAG: hij is GEEN ondeelbaar
       stuk, er zit een duidelijke naad tussen de diagnose (reden/NAMEN/vraag) en
       de zichtbare melding. Opknippen is wel echte bedrading: 21 pagina's laden
       nu een module en een blad, en keuringsregel 38 rekent dat na, dus er komt
       een tweede script bij dat overal mee moet. Dat doe je een voor een met de
       toetsen ernaast en niet in de staart van een ronde. */
    'public/shared/media.js',
    /* public/shared/media.js STOND HIER en is er weer af, en de reden waarom hij
       bleef staan bleek geen reden. Er stond: opknippen kost 26 pagina's een
       TWEEDE script, voor een module wiens hele werk is om te WERKEN als er iets
       stuk is. Dat klopt voor een gewone snede -- maar niet voor een BUNDEL. Dit
       huis serveert er al vijftig als een bestand en bewerkt ze als delen
       (scripts/bundel.js), dus de deur is nu shared/media/media-01.js (de
       diagnose en de teksten) en -02.js (de melding en de vraag), byte voor byte
       samen het origineel. Geen pagina verandert. */
    /* server/kern/eenaccount.js en public/apps/app-main/app-main-25.js STONDEN
       HIER en zijn er weer af: de naden die erbij benoemd stonden, zijn geknipt.
       De sleutelbos en het MUNTEN van een sessie staan nu apart
       (./eenaccount/starten.js), en de algemene pin is los van de Werk-kiezer
       (app-main-25b.js). Zo hoort deze lijst te krimpen. */
    /* server/kern/aanmeldingen.js STOND HIER en is er weer af: de knip die hier
       met naam op de lijst stond, is gemaakt. Het klaarzetten van de zaak
       (provisioning plus de bewijsstap voor de gereguleerde genres) woont nu in
       ./aanmeldingen/klaarzetten.js, en het bestand past weer onder de maat.
       Zo hoort deze lijst te krimpen: niet door de grens te verzetten. */
    // server/accounts/users.js is opgeknipt: het ledendossier, de verificatie, de
    // kantoorlijsten en de vergetelheid staan nu in server/accounts/dossier.js
    /* server/kern/pay/index.js STOND HIER en is er weer af. Drie onderwerpen
       eruit: de stand van de laag (de drie schakelaars uit de omgeving en de
       zes bedragen, ./stand.js), alles wat eruit komt zonder dat er geld
       beweegt (./kijken.js), en sinds 24 augustus ook de drie functies die een
       cent verplaatsen (./boeken.js).
       Die laatste bleven twee rondes staan omdat WETTEN.json de wet
       geld-conservatie hier handhaafde en zijn sabotagerecept EEN REGEL uit
       pasToe() aanwijst, met bestandsnaam erbij. Bij de knip zijn de
       bestandsnaam en de handhaverlijst meeverhuisd naar boeken.js en is de
       regel zelf letterlijk gelijk gebleven -- anders wijst de wet naar een
       verplaatste regel en toetst ze niets meer. */
    /* DERTIEN REGELS STONDEN HIER EN ZIJN ER WEER AF, en ze stonden er te lang.
       De communicatiekern en wat eraan vastzit (comm/index, comm/wie, de twee
       comm-deuren, auth, vergeten), de zes van de werkplaats-ronde
       (journalistiek, rtmail, werkplaats, lokaal-tls, techniek, trio) en het
       eerste deel van de app-gids: allemaal geknipt in een eerdere ronde,
       allemaal onder de grens, en allemaal nog op de lijst.

       De maten die erbij stonden waren daardoor onwaar geworden -- er stond
       "15,1 KB" bij een bestand van 9,1. En erger: zolang de regel er staat mag
       datzelfde bestand ongemerkt weer over de grens groeien, want de
       uitzondering geldt nog.

       Regel 13 rekent dat nu na: een NOG-regel waarvan het bestand al onder de
       grens zit, is een harde fout. Zo kan deze lijst alleen nog krimpen door
       werk, en niet groeien door vergeetachtigheid. */

    /* server/mail.js STOND HIER en is er weer af: de naad die er met naam bij
       stond -- "tussen het opstellen en het afleveren" -- is geknipt, en er
       bleken er drie te zitten. Het opstellen van het bericht (RFC-koppen,
       codering, DKIM) staat in mail-opstellen.js, de SMS-kant met de
       sandbox-zekering in mail-lokaal.js, en het vangnet met zijn pad in
       mail-outbox.js. Wat overblijft is de keuze tussen de drie standen. */
    /* server/db/index.js en server/db/ledengids.js STONDEN HIER en zijn er weer
       af: de twee snedes die er met naam bij stonden, zijn gemaakt. Het
       zoek-deel van de ledengids staat in db/ledengids-zoek.js, en db/index.js
       is langs vier naden geknipt -- ./starten.js, ./bijeen.js (de save-bundel
       naast de save() die hij bewaakt, precies zoals het hier stond),
       ./duurzaam.js en ./afsluiten.js. Van 23911 naar 9260 byte. */
    /* server/pg/sync.js STOND HIER en is er weer af: de snede die er met naam
       bij stond -- "schrijfEen + de twee schrijflanen naar een eigen deel" --
       is gemaakt. Het slot, de merge, het versienummer, de NOTIFY en de twee
       lanen wonen nu in server/pg/schrijflanen.js; wat in sync.js overblijft is
       het beleid (wat gaat mee, in welke volgorde). Zo hoort deze lijst te
       krimpen: niet door de grens te verzetten. */
    // De geïmporteerde enterprise-motoren hebben benoemde sneden, maar hun
    // opslag- en migratiebedrading wordt pas na deze release afzonderlijk
    // geknipt met de integratietoetsen ernaast.
    'server/kern/rtgone.js',
    'server/kern/magnaat-controle.js',
    'server/kern/magnaat-economie.js',
    'server/kern/magnaatwereld.js'
  ]);
  let teGroot = 0, uitz = 0, nog = [];
  for (const map of ['server', 'public']) {
    loop(path.join(ROOT, map), /\.js$/, f => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      if (rel.startsWith('public/dist/') || rel.includes('/data/')) return;
      if (bundelPaden.has(rel)) return;
      const kb = fs.statSync(f).size;
      if (kb <= MAX) return;
      if (MAG.has(rel)) { uitz++; return; }
      if (NOG.has(rel)) { nog.push(rel + ' (' + (kb / 1024).toFixed(1) + ' KB)'); return; }
      teGroot++;
      fout('te groot (' + (kb / 1024).toFixed(1) + ' KB): ' + rel + ' -- knip hem op, of zet hem met reden in de lijst');
    });
  }
  if (nog.length) {
    console.log('  ! nog op te knippen (' + nog.length + '): ' + nog.join(', '));
  }
  /* EEN LIJST DIE NIETS MEER BEWAAKT, LEEST ALS DEKKING DIE ER NIET IS.
     Dezelfde controle als bij regel 47, en om dezelfde reden. Twee vormen:

     SPOKEN -- een regel die een bestand noemt dat niet meer bestaat. Die
     beschermt niets en houdt de reden erbij levend alsof hij ergens over gaat.
     Er stond er een: public/shared/flagship/flagship-02.js.

     AFGERONDE REGELS in NOG -- NOG betekent "moet nog geknipt worden". Staat het
     bestand inmiddels onder de grens, dan is dat werk KLAAR en hoort de regel
     eruit. Doe je dat niet, dan mag datzelfde bestand ongemerkt weer over de
     grens groeien: de uitzondering staat er nog. Precies het gat waar een lijst
     die alleen maar aangroeit voor bedoeld is.

     MAG is met opzet NIET zo streng. Dat is een BESLUIT ("dit bestand mag groot
     zijn, en waarom"), geen taak. Een besluit dat vandaag niet bijt, hoort te
     blijven staan met zijn redenering -- anders moet die opnieuw worden gevoerd
     zodra het bestand weer groeit. Wel telt het spookbestand ook daar. */
  const bestaat = (r) => fs.existsSync(path.join(ROOT, r));
  const spoken = [...MAG.keys(), ...NOG].filter(r => !bestaat(r));
  const afgerond = [...NOG].filter(r => bestaat(r) && fs.statSync(path.join(ROOT, r)).size <= MAX);
  if (spoken.length) {
    fout('de lijst noemt bestanden die niet meer bestaan: ' + spoken.join(', ') +
      ' -- haal ze eruit, anders belooft de lijst dekking die er niet is');
  }
  if (afgerond.length) {
    fout('deze staan in NOG maar zijn al onder de grens: ' + afgerond.join(', ') +
      ' -- haal ze van de lijst, anders mogen ze ongemerkt weer overheen groeien');
  }
  if (!teGroot && !spoken.length && !afgerond.length) {
    ok('geen onverwacht groot productbestand (' + uitz + ' benoemde uitzonderingen, ' + nog.length + ' op de lijst)');
  }
}


/* 14) zero dependencies: geen enkele externe module, en de belofte in
   package.json moet daarmee kloppen. De AST-scan heeft al een verbodslijst van
   pakketten die we zelf gebouwd hebben, maar dat is een NAAMLIJST: require van
   iets nieuws (lodash, dayjs, wat dan ook) glipt daar zo langs. Deze regel doet
   het omgekeerd: alles wat geen ingebouwde Node-module en geen eigen pad is, is
   fout tenzij het bij naam als uitzondering staat.

   De twee uitzonderingen zijn dev-hulp, nooit productie: 'playwright' (met onze
   eigen browser-driver als terugval) en 'redis' (een kruiscontrole van onze
   eigen client tegen de npm-client, die zichzelf overslaat als hij er niet is).
   Beide staan in een try/catch en zijn dus nooit nodig om te draaien. */
console.log('\n14) zero dependencies: geen externe modules, package.json klopt');
{
  const INGEBOUWD = new Set(require('module').builtinModules.concat(['sqlite', 'test', 'test/reporters']));
  const MAG_DEV = new Set(['playwright', 'redis']);
  /* Dit bestand VOEDT de AST-scan met verboden pakketnamen ("keurt require van
     web-push af?"). Die namen staan daar in een string, niet in een echte
     require -- maar een tekstscan ziet het verschil niet. */
  const MAG_BESTAND = new Set(['test/ast-scan.test.js']);
  const RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const vondsten = [];
  for (const map of ['server', 'scripts', 'test', 'public']) {
    loop(path.join(ROOT, map), /\.(js|mjs|cjs)$/, f => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      if (rel.startsWith('public/dist/') || rel.includes('/data/')) return;
      const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
      let m;
      while ((m = RE.exec(bron))) {
        const naam = m[1];
        if (naam.startsWith('.') || naam.startsWith('/')) continue;
        const kaal = naam.replace(/^node:/, '');
        if (INGEBOUWD.has(kaal) || INGEBOUWD.has(kaal.split('/')[0])) continue;
        if (MAG_DEV.has(naam) && (rel.startsWith('test/') || rel.startsWith('scripts/'))) continue;
        if (MAG_BESTAND.has(rel)) continue;
        vondsten.push(rel + ':' + bron.slice(0, m.index).split('\n').length + ' -> ' + naam);
      }
    });
  }
  for (const v of vondsten) fout('externe module: ' + v + ' -- bouw het zelf of zet het met reden in de lijst');
  if (!vondsten.length) ok('geen externe module in server/, scripts/, test/ en public/');

  /* DE RUNTIME BLIJFT ZONDER PAKKETTEN. Dat is de belofte, en die verandert
     niet: `dependencies` moet leeg zijn, want wat de server draait hoort van
     ons te zijn.

     EEN UITZONDERING, MET REDEN, EN ALLEEN VOOR HET TOETSEN. De schermtoetsen
     hebben een browser nodig. Zonder browser sloegen ze zichzelf over -- 114
     van de 119 bestanden -- en node --test meldt dat als GROEN. De suite
     bewees daarmee over vrijwel geen enkel scherm dat het werkt, en dat is een
     duurdere prijs dan een ontwikkelpakket. Sinds 11 augustus 2026 is
     overslaan rood (test/skipwacht.test.js) en hoort de browser er dus te
     zijn.

     De uitzondering is smal gehouden: alleen playwright, alleen in
     devDependencies, en de lijst hieronder is de enige plek waar hij staat.
     Een pakket dat in de RUNTIME belandt zakt nog steeds, en dat is de regel
     die er echt toe doet. */
  const TOEGESTAAN_DEV = new Set(['playwright']);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const beloofd = [];
  for (const veld of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const namen = Object.keys(pkg[veld] || {});
    if (namen.length) beloofd.push(veld + ': ' + namen.join(', '));
  }
  const devVreemd = Object.keys(pkg.devDependencies || {}).filter((n) => !TOEGESTAAN_DEV.has(n));
  if (devVreemd.length) beloofd.push('devDependencies: ' + devVreemd.join(', '));
  if (beloofd.length) fout('package.json noemt toch pakketten (' + beloofd.join(' | ') + ')');
  else ok('de runtime noemt geen enkel pakket' +
    (Object.keys(pkg.devDependencies || {}).length ? ' (alleen de toetsbrowser als devDependency)' : ''));

  const lock = path.join(ROOT, 'package-lock.json');
  if (fs.existsSync(lock)) {
    /* In het slot staan ook de afhankelijkheden VAN de toegestane devDependency
       (playwright-core, en fsevents op een Mac). Ze meetellen zou betekenen dat
       de uitzondering hierboven alsnog niet kan; wat telt is dat er niets
       binnenkomt dat NIET onder een toegestane naam hangt. */
    const pakketten = Object.keys(JSON.parse(fs.readFileSync(lock, 'utf8')).packages || {}).filter((k) => k);
    const vreemd = pakketten.filter((k) => {
      const naam = k.replace(/^node_modules\//, '').split('/node_modules/').pop();
      return !TOEGESTAAN_DEV.has(naam) && !['playwright-core', 'fsevents'].includes(naam);
    });
    if (vreemd.length) fout('package-lock.json bevat pakketten buiten de toetsbrowser: ' + vreemd.slice(0, 5).join(', '));
    else ok(pakketten.length ? pakketten.length + ' pakketten, alle van de toetsbrowser' : 'package-lock.json is leeg');
  }
}

/* 15) id's in de client komen uit de CSPRNG, niet uit de klok of Math.random.

   Een id hoort UNIEK te zijn, want de app gebruikt hem als opzoeksleutel. Twee
   dingen met hetzelfde id zijn voor de app EEN ding, en dan gaat er stil iets
   fout: bij een idem-sleutel houdt de server de tweede geld-actie voor een
   herhaling van de eerste en antwoordt "gelukt" zonder te boeken; bij een
   menu-item of een kanban-kaart bewerk je er ineens twee tegelijk.

   Date.now() is milliseconde-grof (twee acties in dezelfde ms krijgen hetzelfde
   id) en Math.random().toString(36).slice(...) levert een handvol bits, waar de
   botsingskans bij honderden id's al merkbaar is. Gebruik RTGId('voorvoegsel')
   uit shared/basis.js; die staat op elke app-pagina (zie regel 10).

   Twee signaturen zijn hier hard, want die bestaan ALLEEN om een id te maken:
   `Math.random().toString(` en `Date.now().toString(36)`. Cosmetische willekeur
   (ruis in een audiobuffer, een sterrenveld, jitter op een grafiekpunt) matcht
   daar niet op en blijft dus gewoon Math.random gebruiken -- dat hoort ook.

   Uitgezonderd: id's die BEWUST vastliggen aan iets wat al uniek is (een
   betaalverzoek-ref). Die horen deterministisch te zijn, anders wordt een
   dubbeltik een tweede betaling in plaats van een herhaling. Ze staan hieronder
   met naam, want ze zijn een keuze en geen vergissing. */
console.log('\n15) id\'s in de client uit de CSPRNG, niet uit de klok of Math.random');
{
  const MAG_VAST = new Map([
    ["idem: 'bv-' + v.ref", 'vast aan de betaalverzoek-ref: een dubbeltik moet een herhaling zijn, geen tweede betaling']
  ]);
  const vast = [...MAG_VAST.keys()];
  let zwak = 0;
  const gebruikers = new Set();   // bestanden die RTGId/RTGIdem aanroepen
  loop(path.join(ROOT, 'public'), /\.(js|html)$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/') || rel === 'public/shared/id.js') return;
    const bron = fs.readFileSync(f, 'utf8');
    if (/\bRTGId(em)?\s*\(/.test(bron)) gebruikers.add(rel.replace(/^public\//, ''));
    bron.split('\n').forEach((regel, i) => {
      if (/RTGId\b|RTGIdem\b/.test(regel)) return;          // gebruikt de CSPRNG-helper al
      if (vast.some(k => regel.includes(k))) return;         // benoemde vaste sleutel
      const idemZwak = /\bidem\b\s*[:=]/.test(regel) && /Date\.now|Math\.random/.test(regel);
      const idVorm = /Math\.random\(\)\.toString\(|Date\.now\(\)\.toString\(36\)/.test(regel);
      if (!idemZwak && !idVorm) return;
      zwak++;
      fout('zwak id: ' + rel + ':' + (i + 1) + " -- gebruik RTGId('voorvoegsel')");
    });
  });
  if (!zwak) ok('geen id uit de klok of Math.random (' + MAG_VAST.size + ' benoemde vaste sleutel)');

  /* En de andere helft: wie RTGId gebruikt, moet shared/id.js ook inladen. Dat is
     geen formaliteit -- de helper zat eerst in shared/basis.js, dat deferred laadt,
     terwijl de documenteditors hun eerste blokken al TIJDENS het parsen aanmaken.
     Die kregen daardoor een ReferenceError op een pad dat geen test raakte. Deze
     controle sluit dat gat: per pagina kijken we of zij (of een script dat zij
     laadt) RTGId gebruikt, en zo ja of /shared/id.js erin staat. */
  let mist = 0, pag = 0;
  loop(path.join(ROOT, 'public'), /\.html$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/')) return;
    const bron = fs.readFileSync(f, 'utf8');
    const eigen = rel.replace(/^public\//, '');
    const map = path.posix.dirname(eigen);
    let nodig = gebruikers.has(eigen);
    for (const m of bron.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      const src = m[1];
      const doel = src.startsWith('/') ? src.slice(1) : path.posix.normalize(path.posix.join(map, src));
      if (gebruikers.has(doel)) nodig = true;
    }
    if (!nodig) return;
    pag++;
    if (!/<script[^>]*\ssrc="\/shared\/id\.js"/.test(bron)) {
      mist++;
      fout('RTGId zonder /shared/id.js: ' + rel + ' -- laad hem in (zonder defer, vooraan)');
    } else if (/<script[^>]*\ssrc="\/shared\/id\.js"[^>]*\sdefer/.test(bron)) {
      mist++;
      fout('id.js met defer: ' + rel + ' -- dan is RTGId er nog niet tijdens het parsen');
    }
  });
  if (!mist) ok(pag + ' pagina\'s die RTGId gebruiken laden shared/id.js (zonder defer)');
}

/* 16) een pad met een DERDE PARTIJ gaat langs de gegevenspoort.

   De afspraak: een gratis RTG-account vraagt vier dingen (naam, geboortedatum,
   e-mail, wachtwoord). Wie alleen rondkijkt hoeft nooit meer te geven. Maar zodra
   er een zaak, een koerier of een professional in beeld komt, moet die iemand
   kunnen bereiken -- en dan vraagt Rahul de rest, in een gesprek
   (kern/gegevenspoort.js + kern/gegevensgesprek.js).

   Die afspraak leeft in een regel per route: `if (gegevensStop(req, res, ...))
   return;`. Een regel die je moet ONTHOUDEN wordt vroeg of laat vergeten, en dan
   staat er ineens een koerier voor de deur van een lid van wie we geen
   telefoonnummer hebben -- of erger: dan vraagt een nieuw pad wel alles vast,
   "voor de zekerheid", en is de belofte weg.

   Daarom kijkt de keuring mee. Elke route achter de leden-poort (`auth`) die in
   zijn pad een handeling met een derde noemt -- bestellen, boeken, reserveren,
   bezorgen, huren, kopen -- heeft die regel, of staat hieronder met naam en
   reden. De namenlijst is het punt: een NIEUW pad staat er per definitie niet in
   en valt dus op, en wie er een in zet, zet zijn reden erbij.

   De scan kijkt naar HEEL server/routes, niet alleen naar routes/member. Dat is
   met schade geleerd: vluchten boeken, een clubticket kopen en een verblijf
   boeken staan in luchthaven.js, sportclub.js en thuis.js, en die gleden er
   allemaal langs toen de regel alleen naar routes/member keek.

   Uitgezonderd is niet hetzelfde als vergeten: kijken kost niets, en een
   vervolgstap binnen iets wat al loopt (de deur van je eigen hotelkamer, een
   foto bij de huurauto die voor je klaarstaat) vraagt niet opnieuw.

   En de regel leest namen, dus hij ziet wat er als een handeling KLINKT. Twee
   kanten daarvan staan hieronder: /api/boeken/* is de bibliotheek (boeken zijn
   daar dingen met bladzijden) en gaat op de prefix-lijst, en omgekeerd zegt
   /api/member/vluchten/charter niets over bestellen of boeken terwijl er wel
   degelijk een derde partij aan te pas komt -- die heeft zijn poort omdat een
   mens ernaar keek. Een namenlijst haalt de vergeetachtigheid eruit, niet het
   nadenken. */
console.log('\n16) elk leden-pad met een derde partij gaat langs de gegevenspoort');
{
  /* `\/mob\/` staat er sinds het Mobility OS, en om een reden die het noteren
     waard is: de hoofdroute daar heet /api/mob/vraag, en die glipte langs elk
     woord in deze lijst. Een taxi bestellen bij een ANDER bedrijf is precies
     waar deze regel over gaat, en hij zag hem niet -- niet omdat de route veilig
     was, maar omdat hij toevallig geen van deze woorden in zijn pad had. Een
     regel die op woordkeus afgaat, mist alles wat anders heet. */
  const DERDE = /bestel|order|reserve|boek|booking|bezorg|leveri|koerier|courier|afhaal|ophaal|verblijf|proefrit|koop|huur|ticket|vervoer|taxi|\brit\b|\/mob\//i;
  // alleen kijken/opvragen: geen handeling, dus niets te vragen
  const KIJKEN = /\/(mijn|mine|status|volg|slots|annuleer|betaal|pay|partners|overzicht|lijst|list|historie|history|zoek|markt|advies|check|info)\b/i;
  /* Hele domeinen waar het woord toevallig valt maar geen derde partij staat:
     de bibliotheek (boeken = boeken) en de eigen bank. */
  const NIET_DERDE = [
    ['/api/boeken/', 'de RTG-bibliotheek: "boeken" zijn hier dingen met bladzijden'],
    ['/api/bank/', 'de eigen bank van RTG; een overboeking gaat niet langs een derde']
  ];
  const MAG_ZONDER = new Map([
    ['/api/member/sport/tickets', 'je eigen ticketlijst opvragen'],
    ['/api/member/boardroom/logboek', 'je eigen boardroom-journaal ("logboek" bevat toevallig "boek"); geen derde partij'],
    /* Dezelfde valse vriend, nu bij De Rechterhand. Het REISBOEK is uw eigen
       reisdagboek en het LOGBOEK het onderhoudsboek van uw eigen jacht of
       oldtimer: eigen dossiers, geen bestelling en geen partij tegenover u.
       Ze werden zichtbaar toen de rechterhand-paden voluit kwamen te staan
       (regel 45); daarvoor zag ook deze regel ze niet. */
    ['/api/member/rechterhand/reisboek', 'uw eigen reisdagboek ("reisboek" bevat toevallig "boek"); geen derde partij'],
    ['/api/member/rechterhand/logboek', 'het onderhoudsboek van uw eigen bezit; geen derde partij'],
    ['/api/member/rechterhand/logboek/object', 'idem: een eigen object in het eigen logboek'],
    ['/api/member/rechterhand/logboek/object/weg', 'idem'],
    ['/api/member/rechterhand/logboek/regel', 'idem: een onderhoudsregel bij eigen bezit'],
    ['/api/member/rechterhand/logboek/regel/weg', 'idem'],
    ['/api/tickets/aanbod', 'het aanbod bekijken; er gebeurt nog niets'],
    /* De gastkant van de horeca. Bestellen loopt WEL door de poort (zie
       routes/gast/bezorgen.js); deze twee delen niets: een kaart lezen is het
       aanbod bekijken, en je eigen lopende bestelling teruglezen geeft de zaak
       geen gegeven dat hij niet al had. */
    ['/api/gast/bezorg/kaart', 'de kaart van een zaak lezen; er wordt niets gedeeld en er gebeurt nog niets'],
    ['/api/gast/bezorg/rekening', 'je eigen lopende bestelling teruglezen; de zaak krijgt hier niets nieuws'],
    ['/api/verhuur/aanbod', 'het aanbod bekijken; er gebeurt nog niets'],
    ['/api/verkoop/showroom', 'de showroom bekijken; er gebeurt nog niets'],
    ['/api/verblijf/deur', 'je bent al ingecheckt: dit opent je eigen kamerdeur'],
    ['/api/huur/foto', 'vervolgstap in een lopende huur'],
    ['/api/huur/locatie', 'vervolgstap in een lopende huur (vrijwillige positie)'],
    ['/api/huur/sos', 'noodknop tijdens een lopende huur -- hier NOOIT iets vragen'],
    ['/api/verkoop/teken', 'het contract van een deal die al loopt tekenen'],
    ['/api/asset/koop', 'RTG Shared Assets is van RTG zelf; er staat geen derde tegenover'],
    /* Een app kopen in de App Store. Er STAAT een derde tegenover -- de uitgever
       -- en toch hoort deze route niet langs de gegevenspoort, en dat is een
       besluit met een reden.

       De poort bestaat zodat een derde je kan BEREIKEN als er iets misgaat met
       je tafel of je bestelling. Hier is er niets om over te bellen: er komt
       niemand langs, er wordt niets bezorgd, en de uitgever krijgt van deze
       aanschaf niet meer te zien dan een aantal en een bedrag -- APPSTORE.md
       grens 3 verbiedt hem zelfs de codenaam. Een telefoonnummer eisen zou dus
       een gegeven vragen dat NIEMAND leest, en dat is precies de drempel die
       kern/gegevenspoort.js in zijn kop verbiedt.

       Wat deze route WEL vraagt staat er trouwens vlak boven: het land van het
       lid (voor de btw) en, bij een echt account, de paspoortpoort van RTG Pay.
       Er wordt hier dus niet minder gevraagd, er wordt iets ANDERS gevraagd. */
    ['/api/appstore/koop', 'de uitgever krijgt geen naam, geen nummer en zelfs geen codenaam; er is niets om over te bereiken. Wat hier wel wordt gevraagd -- het land voor de btw en de paspoortpoort van RTG Pay -- staat in routes/appstore/kopen.js'],
    /* Een pot is een OORMERK binnen het eigen tegoed en geen reservering bij
       iemand: er beweegt geen geld en er staat geen partij tegenover (GELD.md
       par. 3). Het woord "reserveer" is hier de valse vriend. Deze route werd
       zichtbaar toen de geldpaden voluit kwamen te staan (regel 45); daarvoor
       zag deze regel hem niet, en dat is precies waarom die vorm is verboden. */
    ['/api/geld/pot/reserveer', 'een oormerk in het eigen tegoed; geen derde partij en geen geldbeweging'],
    /* De kraam van het Podium: de verkoper is een ander LID in dezelfde
       uitzending, en het contact loopt over de kanaalchat op codenaam. RTG
       bezorgt hier niets, vraagt geen adres en zet geen koerier in beweging --
       een telefoonnummer eisen zou dus een drempel zijn die niemand leest.
       Gaat RTG de bezorging wel doen (staat in TAKEN.md), dan hoort deze route
       alsnog langs de poort en verdwijnt deze regel. */
    ['/api/podium/koop', 'kopen bij een medelid in de uitzending; RTG bezorgt niet en vraagt geen adres'],
    ['/api/mob/aanbod', 'welk vervoer hier bestaat opvragen; er gebeurt nog niets'],
    ['/api/mob/plekken', 'de bestemmingenlijst opvragen; er gebeurt nog niets'],
    ['/api/mob/favoriet', 'je eigen bewaarde plekken; er staat geen derde tegenover'],
    ['/api/mob/pendel', 'de dienstregeling van je eigen werkgever bekijken'],
    ['/api/mob/pendel/reserveer', 'een stoel in de bus van je eigen werkgever; de werkgever is de klant van de vervoerder, niet het lid, en er gaat op dit moment niets naar een derde'],
    ['/api/mob/kaart/aanbod', 'kijken welke vervoerbewijzen er te koop zijn; er gebeurt nog niets'],
    ['/api/mob/kaart/mijn', 'je eigen kaartjes bekijken'],
    ['/api/mob/reis/plan', 'reisopties naast elkaar zetten; er wordt niets geboekt'],
    ['/api/mob/reis/mijn', 'je eigen reizen bekijken'],
    ['/api/mob/abo/aanbod', 'kijken of er een abonnement te koop is; er gebeurt nog niets'],
    ['/api/mob/abo/mijn', 'je eigen abonnementen bekijken'],
    ['/api/mob/beleid', 'het reisbeleid van je eigen werkgever lezen; er gebeurt niets'],
    /* Je EIGEN lopende bestellingen teruglezen, over de domeinen heen. Er gaat
       geen gegeven naar een derde: de rijen komen uit RTG zelf en gaan naar het
       lid dat ze heeft geplaatst. Er wordt ook niets besteld of betaald -- elke
       regel wijst naar het domeinscherm dat hem beheert. */
    ['/api/mall/bestellingen', 'je eigen lopende bestellingen teruglezen; leeslaag, geen derde partij']
  ]);
  let gaten = 0, poorten = 0;
  loop(path.join(ROOT, 'server/routes'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const bron = fs.readFileSync(f, 'utf8');
    for (const m of bron.matchAll(/app\.post\('(\/api\/[^']+)'([^\n]*)/g)) {
      const pad = m[1];
      if (!DERDE.test(pad) || KIJKEN.test(pad)) continue;
      // alleen de leden-poort: achter supplierAuth/officeAuth zit een zaak of
      // RTG-personeel, en daar is de handeling zelf al van de derde partij.
      if (!/,\s*auth\s*[,)]/.test(m[2])) continue;
      if (NIET_DERDE.some(([p]) => pad.startsWith(p))) continue;
      if (MAG_ZONDER.has(pad)) continue;
      // de body loopt tot de volgende route in hetzelfde bestand
      const volgende = bron.indexOf("app.post('", m.index + 5);
      const body = bron.slice(m.index, volgende < 0 ? bron.length : volgende);
      const regel = bron.slice(0, m.index).split('\n').length;
      if (/gegevensStop\s*\(|gegevensPoort\s*\(/.test(body)) { poorten++; continue; }
      gaten++;
      fout('derde partij zonder gegevenspoort: ' + pad + ' (' + rel + ':' + regel + ')'
        + " -- zet er `if (gegevensStop(req, res, 'bestelling')) return;` bij, of noem hem in MAG_ZONDER");
    }
  });
  if (!gaten) ok(poorten + ' leden-paden met een derde partij gaan langs de poort (' + MAG_ZONDER.size + ' benoemd zonder)');

  /* En de andere kant: de poort moet ook echt iets kunnen vragen. Staat er een
     soort in een route die de poort niet kent, dan valt hij stil terug op "niets
     nodig" en denkt iedereen dat het geregeld is. */
  const NODIG = require(path.join(ROOT, 'server/kern/gegevenspoort')).NODIG;
  let onbekend = 0;
  loop(path.join(ROOT, 'server/routes'), /\.js$/, f => {
    const bron = fs.readFileSync(f, 'utf8');
    for (const m of bron.matchAll(/gegevensStop\s*\(([^)]*)\)/g)) {
      // ook een keuze in de aanroep (`? 'bezorging' : 'bestelling'`) telt mee
      for (const s of m[1].matchAll(/'([a-z]+)'/g)) {
        if (NODIG[s[1]]) continue;
        onbekend++;
        fout('onbekende soort in de gegevenspoort: \'' + s[1] + '\' in ' + path.relative(ROOT, f)
          + ' -- die staat niet in NODIG, dus de poort vraagt niets');
      }
    }
  });
  if (!onbekend) ok('elke soort die een route noemt staat in NODIG (' + Object.keys(NODIG).join(', ') + ')');
}

/* 17) een scherm dat door de poort kan, kan het gesprek ook voeren.

   Regel 16 bewaakt de serverkant: een handeling met een derde partij wordt
   tegengehouden met 428 en zegt wat er mist. Dat is de halve belofte. De andere
   helft staat in de app: Rahul vraagt het in beeld en daarna gaat de handeling
   vanzelf door (public/shared/poortgesprek.js).

   Zonder die module gebeurt er iets ergers dan een foutmelding: het lid krijgt
   "dat vraag ik even" te zien en er wordt vervolgens niets gevraagd. Een melding
   die liegt is slechter dan een die dat niet doet, en dat is precies wat er hier
   stond -- de poort was er wel, het gesprek nergens.

   Dus: kan een pagina bij een pad dat achter de poort staat, dan laadt ze de
   module. De lijst met poortpaden komt uit de code zelf (elke route met
   gegevensStop), niet uit een lijst hier -- zo blijft de keuring vanzelf gelijk
   lopen met wat er echt achter de poort staat. */
console.log('\n17) een scherm dat door de poort kan, kan het gesprek ook voeren');
{
  // welke paden staan achter de poort? uit de routes zelf halen.
  const poortPaden = new Set();
  loop(path.join(ROOT, 'server/routes'), /\.js$/, f => {
    const bron = fs.readFileSync(f, 'utf8');
    for (const m of bron.matchAll(/app\.post\('(\/api\/[^']+)'/g)) {
      const volgende = bron.indexOf("app.post('", m.index + 5);
      const body = bron.slice(m.index, volgende < 0 ? bron.length : volgende);
      if (/gegevensStop\s*\(/.test(body)) poortPaden.add(m[1]);
    }
  });
  /* De client noemt een pad soms zonder /api-prefix (API.call('/order')), dus we
     zoeken op beide vormen -- als quoted string, zodat '/order' niet matcht op
     een los woord in een zin. */
  const vormen = [...poortPaden].flatMap(p => ["'" + p + "'", "'" + p.replace(/^\/api/, '') + "'"]);
  const raakt = (bron) => vormen.some(v => bron.includes(v));

  const { bundels } = require('./bundel');
  const delenVan = new Map();      // 'apps/app-main.js' -> ['apps/app-main/app-main-01.js', ...]
  for (const [bundel, map] of Object.entries(bundels)) {
    const dir = path.join(ROOT, 'public', map);
    if (!fs.existsSync(dir)) continue;
    delenVan.set(bundel, fs.readdirSync(dir).filter(n => n.endsWith('.js')).sort().map(n => map + '/' + n));
  }

  let mist = 0, gedekt = 0;
  loop(path.join(ROOT, 'public'), /\.html$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/')) return;
    const bron = fs.readFileSync(f, 'utf8');
    const map = path.posix.dirname(rel.replace(/^public\//, ''));
    // alles wat deze pagina bereikt: zijzelf, haar scripts, en de delen van een bundel
    const bereik = [bron];
    for (const m of bron.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      const src = m[1].split('?')[0];
      const doel = src.startsWith('/') ? src.slice(1) : path.posix.normalize(path.posix.join(map, src));
      for (const p of [doel, ...(delenVan.get(doel) || [])]) {
        const vol = path.join(ROOT, 'public', p);
        if (fs.existsSync(vol)) { try { bereik.push(fs.readFileSync(vol, 'utf8')); } catch (e) {} }
      }
    }
    if (!bereik.some(raakt)) return;
    if (/<script[^>]*\ssrc="\/shared\/poortgesprek\.js"/.test(bron)) { gedekt++; return; }
    mist++;
    fout('poortpad zonder gegevensgesprek: ' + rel +
      ' -- deze pagina kan een 428 krijgen; laad /shared/poortgesprek.js erbij');
  });
  if (!mist) ok(gedekt + ' pagina\'s die achter de poort kunnen komen laden het gesprek (' + poortPaden.size + ' poortpaden)');
}

/* 18) de kantoordeur staat maar op een plek nagebouwd.

   Dit is met schade geleerd. /api/office/login was op vijf schermen los
   nagebouwd, en toen de backoffice een tweede factor kreeg, kreeg maar EEN van
   die vijf een veld om die code in te typen. De andere vier liepen vast op een
   vraag die ze niet konden stellen: "Tweede factor vereist" zonder plek om hem
   te geven. Niemand had iets verkeerd gedaan; het was gewoon vier keer hetzelfde
   scherm dat niet meebewoog.

   Dus: een pagina praat met de kantoordeur via het gesprek
   (shared/kantoorgesprek.js), of ze staat hieronder met naam en reden. Zo kan er
   geen zesde kopie bijkomen die stilletjes achterloopt.

   personeel is de benoemde uitzondering: dat is de werk-app waar het ene
   RTG-account zijn rollen koppelt, en die heeft de code EN de tweede factor
   allebei al als veld. Daar is de deur dus compleet. */
console.log('\n18) de kantoordeur staat maar op een plek nagebouwd');
{
  const MAG_ZELF = new Map([
    ['public/apps/personeel.js', 'de werk-app koppelt rollen aan het ene account; heeft code en tweede factor allebei'],
    ['public/apps/personeel/personeel-05.js', 'de bron-slice van dezelfde werk-app']
  ]);
  let eigen = 0, viaGesprek = 0;
  loop(path.join(ROOT, 'public'), /\.(js|html)$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/') || rel === 'public/shared/kantoorgesprek.js') return;
    const bron = fs.readFileSync(f, 'utf8');
    if (/RTGKantoorGesprek/.test(bron)) viaGesprek++;
    if (!/['"]\/api\/office\/login['"]/.test(bron)) return;
    if (MAG_ZELF.has(rel)) return;
    eigen++;
    fout('eigen kantoor-inlog: ' + rel +
      ' -- praat met de deur via RTGKantoorGesprek.toon(), of noem hem in MAG_ZELF');
  });
  if (!eigen) ok(viaGesprek + ' plek(ken) doen de kantoor-inlog via het gesprek (' + MAG_ZELF.size + ' benoemd met een eigen veld)');
}

/* 19) TWEE GEDEELDE MODULES DIE DEZELFDE WINDOW-NAAM OPEISEN.

   Dit is de duurste fout van deze maand, twee keer op rij. Twee sessies kozen
   los van elkaar de naam window.RTGPoort -- de een voor de inlogpoort met
   .gesprek(), de ander voor de gegevenspoort met .vang(). Op een pagina waar
   allebei laadden won er een, en de aanroeper riep een functie aan die op dat
   object niet bestond. Geen foutmelding in beeld: de aanroep sneuvelde in een
   async afhandeling en de poort ging simpelweg nooit open.

   Dezelfde vorm zat er nog een tweede keer in, ongemerkt: shared/uitleg.js
   gaf RTGUitleg = { knop, toon, sluit, init } en shared/basis.js gaf er
   RTGUitleg = { open, sluit } overheen. Op apps/spelen.html laden ze allebei.
   Wie netjes vroeg of .knop bestond (shared/osmenu.js doet dat) kreeg nee en
   liet het knopje weg. Een verdwenen knop meldt zichzelf nooit.

   Alleen public/shared/ telt: dat zijn de modules die bedoeld zijn om vrij
   samen geladen te worden. De vorm `X = X || {}` is geen claim maar een
   uitbreiding van een afgesproken naamruimte (RTGRahul, SPart, I18N doen dat
   met opzet) en telt dus niet mee. Bundels blijven buiten beschouwing: dat is
   bouwuitvoer, de bron staat in de losse delen ernaast. */
console.log('\n19) geen twee gedeelde modules die dezelfde window-naam opeisen');
{
  const MAG_SAMEN = new Map([
    // ['public/shared/x.js', 'reden waarom deze naam wel gedeeld mag worden']
  ]);
  const { bundels } = require('./bundel');
  const bundelPaden = new Set(Object.keys(bundels).map(k => 'public/' + k));
  const claims = new Map();   // naam -> Set(bestand)
  loop(path.join(ROOT, 'public', 'shared'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (bundelPaden.has(rel) || MAG_SAMEN.has(rel)) return;
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    const re = /\b(?:w|window|globalThis|self)\.([A-Z][A-Za-z0-9_]{2,})\s*=(?!=)([^\n;]*)/g;
    let m;
    while ((m = re.exec(bron))) {
      const naam = m[1];
      // `X = X || {}` en `X = Object.assign(X, ...)`: uitbreiden, niet opeisen
      if (new RegExp('\\b' + naam + '\\b').test(m[2])) continue;
      if (!claims.has(naam)) claims.set(naam, new Set());
      claims.get(naam).add(rel);
    }
  });
  let bots = 0;
  for (const [naam, waar] of claims) {
    if (waar.size < 2) continue;
    bots++;
    fout('window.' + naam + ' wordt opgeeist door ' + waar.size + ' modules: ' + [...waar].join(', ') +
      ' -- geef ze namen die zeggen wat ze zijn, of noem er een in MAG_SAMEN');
  }
  if (!bots) ok(claims.size + ' gedeelde window-namen, elk van precies een module (' + MAG_SAMEN.size + ' benoemd als gedeeld)');
}

/* 20) EEN PLAATSELIJK PALET MOET DE GLOBALE SCHILDERREGELS BEANTWOORDEN.

   Sommige schermen verven zichzelf om. shared/keukenlicht.js doet dat met het
   werkplekscherm: overdag een licht, functioneel palet, 's nachts een donker,
   en het zet die kleuren als tokens (--bg, --card2, --txt, ...) rechtstreeks
   op #station.

   Dat werkt voor alles wat die tokens leest -- maar niet voor wat er OVERHEEN
   geschilderd wordt door een globale regel die een ANDER token leest. In
   shared/rtg-ui.css staat `body.rtg-stijl select{background:var(--rtg-card2)}`.
   Die selector is specifieker dan de eigen `.st-in` van het scherm, en
   --rtg-card2 is de globale, donkere waarde die keukenlicht.js niet omzet.
   Gevolg: pikzwarte keuzelijsten op een ivoren scherm. Precies dezelfde vorm
   als de naambotsing van regel 19, alleen in CSS: het plaatselijke wint niet
   van het globale, en niemand ziet het tot iemand ernaar kijkt.

   Deze regel eist daarom: elk vlak met een eigen palet moet voor elk GEWOON
   element dat globaal geschilderd wordt (input, select, textarea, button) een
   eigen regel hebben die uit het eigen palet leest. Klassen tellen niet mee --
   die staan in de opmaak en zijn dus een keuze; een <select> komt er vanzelf
   in zodra iemand een formulier neerzet. */
console.log('\n20) een plaatselijk palet beantwoordt de globale schilderregels');
{
  const MAG_GLOBAAL = new Map([
    // ['#station button', 'reden waarom dit vlak deze soort niet zelf hoeft te zetten']
  ]);
  const ELEMENTEN = ['input', 'select', 'textarea', 'button'];
  const TOKENS = ['bg', 'card', 'card2', 'line', 'txt', 'muted', 'soft'];

  // 1. welke vlakken verven zichzelf om? (een gedeelde module die minstens
  //    drie van de oppervlakte-tokens op een eigen selector zet)
  const vlakken = [];
  loop(path.join(ROOT, 'public', 'shared'), /\.js$/, f => {
    const bron = fs.readFileSync(f, 'utf8');
    const gezet = TOKENS.filter(t => bron.includes("'--' + k") || bron.includes("setProperty('--" + t));
    if (!bron.includes("setProperty('--")) return;
    const noemt = TOKENS.filter(t => new RegExp("['\"]" + t + "['\"]").test(bron)).length;
    if (noemt < 3) return;
    const m = bron.match(/var\s+SEL\s*=\s*'([^']+)'/) || bron.match(/querySelector\('(#[a-zA-Z0-9_-]+)'\)/);
    if (m) vlakken.push({ sel: m[1], bestand: path.relative(ROOT, f).replace(/\\/g, '/') });
    void gezet;
  });

  // 2. welke gewone elementen worden globaal geschilderd uit een --rtg-token?
  const globaal = new Set();
  loop(path.join(ROOT, 'public', 'shared'), /\.css$/, f => {
    const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const body = m[2].replace(/\s+/g, ' ');
      if (!/(background|color|border-color)\s*:[^;]*var\(--rtg-/.test(body)) continue;
      for (let deel of m[1].split(',')) {
        deel = deel.trim().replace(/\s+/g, ' ');
        const blad = deel.replace(/^body\.rtg-stijl\s+/, '');
        if (blad === deel) continue;                   // niet globaal geworteld
        const naam = (blad.match(/^([a-z]+)(?::|::|\[|$)/) || [])[1];
        if (naam && ELEMENTEN.includes(naam)) globaal.add(naam);
      }
    }
  });

  // 3. beantwoordt elk vlak ze allemaal?
  let alleCss = '';
  loop(path.join(ROOT, 'public'), /\.(css|html)$/, f => {
    if (path.relative(ROOT, f).replace(/\\/g, '/').startsWith('public/dist/')) return;
    alleCss += fs.readFileSync(f, 'utf8');
  });
  let open = 0;
  for (const v of vlakken) {
    for (const el of globaal) {
      const sleutel = v.sel + ' ' + el;
      if (MAG_GLOBAAL.has(sleutel)) continue;
      const patroon = new RegExp(regexVeilig(v.sel) + '\\s+' + el + '\\b');
      if (patroon.test(alleCss)) continue;
      open++;
      fout('het vlak ' + v.sel + ' (' + v.bestand + ') verft zichzelf om, maar <' + el + '> wordt globaal' +
        ' geschilderd uit een --rtg-token en krijgt daar geen eigen regel -- zet "' + sleutel + '{...}"' +
        ' met de eigen tokens, of noem het in MAG_GLOBAAL');
    }
  }
  if (!open) ok(vlakken.length + ' vlak(ken) met een eigen palet beantwoorden elk ' + globaal.size +
    ' globaal geschilderd element (' + MAG_GLOBAAL.size + ' benoemd als uitzondering)');
}

/* 21) EEN PAGINA MAG GEEN CSS-TOKEN LEZEN DAT NERGENS GEZET WORDT.

   `color: var(--tekst)` waar het huis --txt heet: de browser gooit de hele
   declaratie weg en gaat verder alsof er niets stond. Geen foutmelding, geen
   rode regel in de console -- de hover-kleur verandert alleen nooit. Zo stonden
   er negen van op vijf schermen, jarenlang, en niemand kon het zien.

   Deze regel kijkt per pagina naar de tokens die in haar EIGEN <style> gelezen
   worden, en telt als "gezet" alles wat de pagina zelf, haar stylesheets of
   haar meegeladen scripts neerzetten (ook via setProperty, want zo werkt
   shared/keukenlicht.js). Een var() MET terugval is per definitie in orde:
   `var(--goldop, #0C0C0B)` zegt precies wat er moet gebeuren als het token er
   niet is. */
console.log('\n21) geen pagina leest een css-token dat nergens gezet wordt');
{
  const PUB = path.join(ROOT, 'public');
  const leesVeilig = p2 => { try { return fs.readFileSync(p2, 'utf8'); } catch (e) { return ''; } };
  const zonderCss = t => String(t).replace(/\/\*[\s\S]*?\*\//g, ' ');
  function gezetteTokens(bron) {
    const uit = new Set();
    for (const m of bron.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) uit.add(m[1]);
    for (const m of bron.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9_-]+)['"]/g)) uit.add(m[1]);
    /* De vorm setProperty('--' + k) uit een tabel met namen: dan staan de
       tokennamen als sleutels in een object ernaast (shared/keukenlicht.js). */
    if (/setProperty\(\s*['"]--['"]\s*\+/.test(bron)) {
      for (const m of bron.matchAll(/\[([^\]]*)\]\.forEach/g))
        for (const n of m[1].matchAll(/'([a-zA-Z0-9_-]+)'/g)) uit.add('--' + n[1]);
      for (const m of bron.matchAll(/^\s*([a-z][a-zA-Z0-9_]*)\s*:\s*['"#]/gm)) uit.add('--' + m[1]);
    }
    return uit;
  }
  let losseTokens = 0, bekeken = 0;
  loop(PUB, /\.html$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/')) return;
    bekeken++;
    const html = leesVeilig(f);
    const def = gezetteTokens(html);
    /* @import VOLGEN. Een blad mag een ander blad insluiten, en sinds
       shared/rtg-ui.css het ontwerpsysteem, de materialen en de thema's
       insluit, komt het grootste deel van de tokens langs die weg binnen.
       Keek deze regel alleen naar de <link>-lijst, dan meldde hij een token
       als "ontbreekt" terwijl het er in de browser gewoon staat -- vals alarm
       dus, en vals alarm leert mensen de melding weg te klikken op de dag dat
       hij wel klopt. Gevonden toen apps/kantoor.html erbij kwam. */
    const cssMet = (p2, diep) => {
      const bron = zonderCss(leesVeilig(p2));
      for (const t of gezetteTokens(bron)) def.add(t);
      if (diep > 4) return;
      for (const im of bron.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s]+\.css)/gi)) {
        const q = im[1].startsWith('/') ? path.join(PUB, im[1]) : path.join(path.dirname(p2), im[1]);
        cssMet(q, diep + 1);
      }
    };
    for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/gi)) {
      const p2 = m[1].startsWith('/') ? path.join(PUB, m[1]) : path.join(path.dirname(f), m[1]);
      cssMet(p2, 0);
    }
    for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js)"/gi)) {
      const p2 = m[1].startsWith('/') ? path.join(PUB, m[1]) : path.join(path.dirname(f), m[1]);
      for (const t of gezetteTokens(leesVeilig(p2))) def.add(t);
      const map = p2.replace(/\.js$/, '');
      try {
        if (fs.statSync(map).isDirectory())
          for (const d of fs.readdirSync(map)) for (const t of gezetteTokens(leesVeilig(path.join(map, d)))) def.add(t);
      } catch (e) { /* geen losse delen */ }
    }
    const eigenCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
    const mist = new Set();
    for (const m of zonderCss(eigenCss).matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g)) {
      if (m[2] === ',') continue;               // heeft een terugval
      if (!def.has(m[1])) mist.add(m[1]);
    }
    if (mist.size) {
      losseTokens += mist.size;
      fout(rel + ' leest ' + [...mist].join(', ') + ' maar niets zet dat -- de browser gooit die regel weg' +
        ' zonder iets te melden; gebruik het juiste token of geef een terugval mee');
    }
  });
  if (!losseTokens) ok(bekeken + ' pagina(s) lezen alleen tokens die ergens gezet worden');
}

/* 22) EEN GLYFNAAM IS BEELD, GEEN WOORD.

   De server bewaart bij een categorie of een kaart geen teken maar een NAAM:
   icon: 'paneel', icon: 'stad', icon: 'logboek'. Dat is met opzet -- regel 3b
   hierboven verbiedt emoji in de bron omdat het beeld uit shared/glyf.js komt
   en niet uit de emoji-font van het toestel.

   Een scherm dat zo'n veld rechtstreeks in zijn HTML plakt, zet dus het WOORD
   op het scherm. Zo stond er letterlijk "paneel Apparaten" op de hardware-PDA
   en "stad Chalet Aurelia" bij de architect, op 38 plekken verdeeld over acht
   schermen. Niemand ziet dat in de code; je ziet het pas als je het scherm
   ingelogd met data opent, en dan nog denk je een halve seconde dat het bij de
   naam hoort.

   Wie zo'n veld toont, doet dat via RTGGlyf.tekst(): die maakt er een
   pictogram van als de naam bestaat, en laat anders staan wat er stond. */
console.log('\n22) een glyfnaam wordt getoond als beeld, niet als woord');
{
  const MAG_TEKST = new Map([
    // ['public/apps/x.html', 'reden waarom dit veld hier geen glyfnaam draagt']
  ]);
  // de namen die glyf.js kent, uit de bron (glyf.js zelf is een bundel)
  const glyfBron = fs.readFileSync(path.join(ROOT, 'public', 'shared', 'glyf.js'), 'utf8');
  const namen = new Set();
  for (const m of glyfBron.matchAll(/(?:^|[{,])\s*'?([a-zA-Z0-9_-]+)'?\s*:\s*'</gm)) namen.add(m[1]);

  /* Dragen de icon-velden in de server echt glyfnamen? Zo ja, dan is elk
     scherm dat ze als tekst plakt per definitie fout. Dit is geen aanname
     maar een telling. */
  let dragend = 0;
  loop(path.join(ROOT, 'server'), /\.js$/, f => {
    const bron = fs.readFileSync(f, 'utf8');
    for (const m of bron.matchAll(/\bicon:\s*'([a-zA-Z0-9_-]+)'/g)) if (namen.has(m[1])) dragend++;
  });

  let plak = 0, plekken = 0;
  loop(path.join(ROOT, 'public'), /\.(js|html)$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/') || MAG_TEKST.has(rel)) return;
    // de bundels zijn bouwuitvoer; de bron staat in de losse delen ernaast
    let isBundel = false;
    try { isBundel = new Set(Object.keys(require('./bundel').bundels).map(k => 'public/' + k)).has(rel); } catch (e) { /* geen bundellijst */ }
    if (isBundel) return;
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    const treffers = [...bron.matchAll(/\+\s*(?:esc\()?\s*(\w+)\.icon\b\)?\s*\+/g)];
    if (!treffers.length) return;
    plekken += treffers.length;
    plak++;
    fout(rel + ': ' + treffers.length + ' plek(ken) plakken een icon-veld rechtstreeks in de HTML' +
      ' -- gebruik RTGGlyf.tekst(x.icon), anders staat de glyfNAAM als woord op het scherm');
  });
  if (!plak) ok('geen enkel scherm plakt een glyfnaam als tekst (' + namen.size + ' namen, ' +
    dragend + ' icon-velden in de server dragen er een; ' + MAG_TEKST.size + ' benoemd als uitzondering)');
  void plekken;
}

/* ---------------------------------------------------------------------------
   23) EEN MERKKLEUR HEEFT EEN SPELLING.

   De merkkleuren komen exact uit het logo en staan in CLAUDE.md. Het bordeaux
   is #7F1634. Op twintig plekken in de code stond #7F1734: een groen kanaal
   een stap hoger. Dat verschil is met het blote oog niet te zien -- en juist
   daarom kan niemand het ooit betrapt hebben. Het is een typefout die zich via
   knippen en plakken over vijftien bestanden verspreidde.

   Deze regel kijkt alleen naar een afstand van HOOGSTENS EEN over de drie
   kanalen samen. Dat is de grens tussen een vergissing en een keuze: op een
   stap van vier of vijf kiest iemand bewust een iets lichter zwart voor een
   paneel (public/apps/office.html doet dat, met uitleg erboven). Op een stap
   van een kiest niemand iets. Ruimer meten zou echte designkeuzes gaan
   afkeuren, en dan is dit het soort toets dat mensen uitzetten.

   Wilt u toch een kleur die er een haar naast ligt: zet hem met reden in
   MAG_NAAST. Een uitzondering die je moet opschrijven wordt gelezen. */
console.log('\n23) een merkkleur heeft een spelling');
{
  const MAG_NAAST = new Map([
    // ['#7F1734', 'reden waarom deze bijna-merkkleur hier wel mag']
  ]);
  const MERK = {
    '#FFFFFF': 'wit', '#0C0C0B': 'zwart', '#7F1634': 'bordeaux',
    '#9E1C40': 'bordeaux-bright', '#C23A5E': 'bordeaux-op-donker', '#857007': 'goud',
    '#DEDBD5': 'lijn', '#4D4A45': 'grijs', '#8A8680': 'grijs-zacht'
  };
  const kanalen = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const afstand = (a, b) => kanalen(a).reduce((n, v, i) => n + Math.abs(v - kanalen(b)[i]), 0);

  const naast = new Map();   // '#XXXXXX' -> { merk, naam, plekken: [] }
  const kijk = (map, wortel) => loop(wortel, /\.(js|css|html)$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/')) return;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
      const h = '#' + m[0].slice(1).toUpperCase();
      if (MERK[h] || MAG_NAAST.has(h)) continue;
      for (const [merk, naam] of Object.entries(MERK)) {
        if (afstand(h, merk) > 1) continue;
        if (!naast.has(h)) naast.set(h, { merk, naam, plekken: [] });
        if (naast.get(h).plekken.indexOf(rel) < 0) naast.get(h).plekken.push(rel);
      }
    }
    void map;
  });
  kijk(null, path.join(ROOT, 'public'));
  kijk(null, path.join(ROOT, 'server'));

  if (naast.size) {
    for (const [h, x] of naast)
      fout(h + ' ligt een stap naast ' + x.merk + ' (' + x.naam + ') in ' + x.plekken.length +
        ' bestand(en), o.a. ' + x.plekken.slice(0, 3).join(', ') +
        ' -- dat verschil ziet niemand, dus het is een typefout en geen keuze');
  } else {
    ok('geen enkele kleur ligt een haar naast een merkkleur (' + Object.keys(MERK).length +
      ' merkkleuren; ' + MAG_NAAST.size + ' benoemd als uitzondering)');
  }
}

/* ---------------------------------------------------------------------------
   24) EEN COORDINAAT KOMT NOOIT UIT EEN KALE Number().

   Number(null) is 0, en JSON maakt van een NaN, een undefined of een
   ontbrekend veld precies null. Vijftien plekken in de server lazen een
   positie met Number(req.body.lat) en controleerden hem daarna met
   Number.isFinite() of met een bereikcontrole -- en 0 komt door allebei
   heen. Een half verstuurde positie kwam er dus als 0,0 doorheen: Null
   Island, in de Golf van Guinee.

   Op een bezorgadres is dat vervelend. Op de SOS-routes van charter.js en
   huur.js is het iets anders: dan meldt iemand in nood een positie aan de
   andere kant van de wereld, en niets in het systeem merkt het.

   coord() in kern/util.js doet het in een keer goed en op een plek. Deze
   regel bewaakt dat niemand het opnieuw met de hand doet. 0,0 blijft gewoon
   geldig -- wie daar echt vaart mag zijn positie delen; het gaat erom dat
   NIETS niet stilletjes 0 wordt. */
console.log('\n24) een coordinaat komt nooit uit een kale Number()');
{
  const MAG_KAAL = new Map([
    // ['server/routes/x.js', 'reden waarom hier geen coord() gebruikt wordt']
  ]);
  /* Number(x) EN de unaire plus (+x). Die tweede vorm zat in twee routes en
     glipte langs mijn eerste versie van deze regel: +null is net zo goed 0.
     Een regel die maar een van de twee schrijfwijzen kent, geeft rust die er
     niet is. */
  const PAT = /(?:\bNumber\s*\(\s*|\+\s*)(?:req|body|data|opt|v)\??\.[\w.]*\b(lat|lng|lon|latitude|longitude)\b/g;
  let kaal = 0, plekken = 0;
  loop(path.join(ROOT, 'server'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (MAG_KAAL.has(rel)) return;
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    const treffers = [...bron.matchAll(PAT)];
    if (!treffers.length) return;
    kaal++; plekken += treffers.length;
    fout(rel + ': ' + treffers.length + ' keer een coordinaat uit een kale Number() -- gebruik coord() uit kern/util.js,' +
      ' anders wordt een ontbrekende positie stilletjes 0,0');
  });
  if (!kaal) ok('geen enkele route leest een coordinaat met een kale Number() (' + MAG_KAAL.size + ' benoemd als uitzondering)');
  void plekken;
}

/* 25) een toets die een externe dienst nodig heeft, staat ook in de draaier.

   DE FOUT DIE DIT VANGT. Toetsbestanden die een echte PostgreSQL of Redis nodig
   hebben, poorten zichzelf op DATABASE_URL / REDIS_URL en slaan zich anders
   netjes over. Dat is goed. Maar `npm test` geeft die variabelen bewust NIET
   mee (die bestanden maken en droppen dezelfde tabellen en zouden elkaar bij
   parallel draaien wissen), dus ze draaien uitsluitend via
   scripts/pgtoetsen.js -- en die heeft een met de hand bijgehouden LIJST.

   Twee plekken die een waarheid vasthouden. Wie een nieuw pg-toetsbestand
   schrijft en vergeet het aan die lijst toe te voegen, heeft een bestand dat
   NERGENS draait: niet in de hoofdsuite (poort dicht) en niet in de runner
   (staat er niet in). Het ziet eruit als dekking en is het niet. Precies zo
   hebben er acht maandenlang gestaan zonder ooit uitgevoerd te zijn.

   Andersom telt ook: een bestand dat in de lijst staat maar niet meer bestaat
   laat de runner op een ontbrekend pad draaien. */
console.log('\n25) elk toetsbestand dat een database of Redis vraagt, staat in de pg-draaier');
{
  const POORT = /process\.env\.(DATABASE_URL|PG_URL|REDIS_URL)/;
  /* Bestanden die de variabele wel NOEMEN maar er niet op poorten: ze zetten
     hem juist LEEG om zeker te weten dat ze op de lokale opslag draaien. Die
     horen niet in de runner, en dat is geen omissie maar het punt. */
  const MAG_ERBUITEN = new Map([
    ['test/opslag-voorcheck.test.js', 'zet DATABASE_URL juist leeg: deze toets gaat over de SQLite-opslag'],
    ['test/multi-instance-sqlite.test.js', 'idem: nadrukkelijk de SQLite-stand'],
    ['test/duurzaamheid-kill.test.js', 'draait op de standaardopslag; noemt de variabele alleen om hem uit te zetten'],
    ['test/geld-conservatie-last.test.js', 'idem'],
    ['test/golive.test.js', 'keurt de productie-instellingen, draait zelf geen database']
  ]);
  let contract = 0;
  try {
    const runner = fs.readFileSync(path.join(ROOT, 'scripts/pgtoetsen.js'), 'utf8');
    // de expliciete lijst uit de runner: alles tussen TOETSEN = [ en ]
    const blok = (runner.match(/const TOETSEN\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
    const inLijst = new Set([...blok.matchAll(/'([^']+)'/g)].map(m => m[1]));
    if (!inLijst.size) { contract++; fout('kon de TOETSEN-lijst in scripts/pgtoetsen.js niet lezen'); }

    // 25a) staat elk zelf-poortend bestand in de lijst?
    const testMap = path.join(ROOT, 'test');
    for (const naam of fs.readdirSync(testMap).filter(n => /\.test\.js$/.test(n)).sort()) {
      const rel = 'test/' + naam;
      const bron = fs.readFileSync(path.join(testMap, naam), 'utf8');
      /* Alleen bestanden die er ECHT op poorten: de variabele moet in dezelfde
         regel staan als de skip-beslissing of de constante die hem draagt.
         Alleen "noemt de naam ergens" zou elk bestand met een uitleg in het
         commentaar meetellen. */
      /* TEKENREEKSEN ERUIT, en dat is een reparatie en geen verfijning.
         test/deltapoort.test.js draagt als bekend-foute invoer de letterlijke
         tekst `test('a', { skip: !process.env.DATABASE_URL }, f)` -- een string,
         geen poort. Deze keuring las hem als code en meldde dat bestand als een
         toets die Postgres nodig heeft en nergens draait. Dat is de vierde keer
         in dit huis dat een teller tekst voor code aanziet (zie de kop van
         zonderTekst in scripts/lib/bron.js); vandaar dezelfde functie en niet
         een uitzondering voor dit ene bestand. Een uitzonderingenlijst zou de
         volgende keer weer moeten groeien. */
      const poort = zonderTekst(zonderCommentaar(bron)).split('\n').some(r =>
        POORT.test(r) && /\b(OVERSLAAN|HEEFT_PG|HEEFT_REDIS|skip|BRON|URL)\b/.test(r));
      if (!poort) continue;
      if (MAG_ERBUITEN.has(rel)) continue;
      if (!inLijst.has(rel)) {
        contract++;
        fout(rel + ' poort zichzelf op een externe dienst maar staat niet in de TOETSEN-lijst van' +
          ' scripts/pgtoetsen.js -- dan draait hij NERGENS (npm test geeft die variabele bewust niet mee)');
      }
    }
    // 25b) en verwijst de lijst alleen naar bestanden die bestaan?
    for (const rel of inLijst) {
      if (!fs.existsSync(path.join(ROOT, rel))) {
        contract++;
        fout('scripts/pgtoetsen.js noemt ' + rel + ', maar dat bestand bestaat niet');
      }
    }
    if (!contract) ok(inLijst.size + ' bestanden in de pg-draaier, en elk zelf-poortend toetsbestand staat erin (' +
      MAG_ERBUITEN.size + ' benoemd als uitzondering)');
  } catch (e) { fout('kon het draaier-contract niet controleren: ' + e.message); }
}

/* 26) bedradings-contract, breed: wat je uit een module PAKT, moet erin zitten.

   DE FOUT DIE DIT VANGT, EN DIE ECHT IS GEBEURD.

     const { ..., ledenGidsWeg, ... } = <require van ./db>;

   `ledenGidsWeg` stond NIET in de exportlijst van db/index.js, terwijl
   ledengids.js hem exporteerde en gidsen.js hem doorreikte. Een ontbrekende
   regel in een lijst, en niets dat erover klaagde: de naam werd stilzwijgend
   `undefined`, en in kern/gids.js sloeg `if (ledenGidsWeg)` daar overheen --
   inclusief de `return` erachter, zodat OOK het lokale pad werd overgeslagen.
   Uitkomst: in Postgres-stand haalde het recht op vergetelheid (AVG art. 17)
   het lid nergens uit de gids.

   Regel 11 hierboven vangt precies deze klasse, maar alleen voor `accounts.`.
   Deze regel doet hetzelfde voor ELKE lokaal gerequirede module, en dan aan de
   kant waar het misging: de destructurering.

   BEWUST CONSERVATIEF, net als de kruis-slice-scan. We lezen de exportlijst
   STATISCH (geen require, want dat zou tweehonderd modules met bijwerkingen
   uitvoeren tijdens een keuring). Kunnen we de export-verzameling niet met
   zekerheid bepalen -- een fabrieksfunctie, een spread, een Object.assign, een
   berekende sleutel -- dan slaan we die module over. Liever een gemist geval
   dan vals alarm in de pijplijn. Het aantal overgeslagen modules staat in de
   uitslag, zodat de dekking van deze regel zelf zichtbaar is en niet als
   volledigheid overkomt. */
console.log('\n26) bedradings-contract: elke naam die je uit een module haalt, bestaat daar');
{
  /* Exportnamen statisch uit een bestand halen. Geeft null als we het niet
     zeker weten -- dat is een OVERSLAAN, geen fout. */
  function exportNamen(bestand) {
    let bron;
    try { bron = zonderCommentaar(fs.readFileSync(bestand, 'utf8')); } catch (e) { return null; }
    const namen = new Set();
    // module.exports.foo = ... en exports.foo = ...
    for (const m of bron.matchAll(/(?:^|[^.\w$])(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/g)) namen.add(m[1]);
    // Object.assign(module.exports, ...) -> onbekend
    if (/Object\.assign\s*\(\s*(?:module\.)?exports\b/.test(bron)) return null;
    const i = bron.search(/(?:^|[^.\w$])module\.exports\s*=/m);
    if (i < 0) return namen.size ? namen : null;
    const na = bron.slice(bron.indexOf('=', i) + 1);
    const eerste = na.match(/^\s*(\S)/);
    if (!eerste) return null;
    // module.exports = <iets anders dan een objectliteraal>: fabriek, klasse,
    // functie, doorgeefluik. Dan zegt de destructurering ons niets.
    if (eerste[1] !== '{') return namen.size ? namen : null;
    // het objectliteraal uithappen op brace-balans
    const start = na.indexOf('{');
    let diepte = 0, eind = -1;
    for (let k = start; k < na.length; k++) {
      if (na[k] === '{') diepte++;
      else if (na[k] === '}') { diepte--; if (!diepte) { eind = k; break; } }
    }
    if (eind < 0) return null;
    const lijf = na.slice(start + 1, eind);
    if (/\.\.\./.test(lijf)) return null;          // spread: onbekend
    // sleutels op diepte 0 van dit literaal
    let d = 0, stuk = '';
    const stukken = [];
    for (const ch of lijf) {
      if ('{[('.includes(ch)) d++;
      else if ('}])'.includes(ch)) d--;
      if (ch === ',' && d === 0) { stukken.push(stuk); stuk = ''; } else stuk += ch;
    }
    stukken.push(stuk);
    for (const s of stukken) {
      const t = s.trim();
      if (!t) continue;
      if (t.startsWith('[')) return null;          // berekende sleutel: onbekend
      const m = t.match(/^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*(?::|\(|$)/);
      if (!m) return null;                          // iets wat we niet herkennen
      namen.add(m[1] || m[2] || m[3]);
    }
    return namen;
  }

  const cache = new Map();
  const haal = (p) => { if (!cache.has(p)) cache.set(p, exportNamen(p)); return cache.get(p); };
  function los(vanaf, spec) {
    const basis = path.resolve(path.dirname(vanaf), spec);
    for (const kand of [basis, basis + '.js', path.join(basis, 'index.js')]) {
      try { if (fs.statSync(kand).isFile()) return kand; } catch (e) {}
    }
    return null;
  }

  let gecontroleerd = 0, overgeslagen = 0, mis = 0;
  const bestanden = [];
  loop(path.join(ROOT, 'server'), /\.js$/, f => bestanden.push(f));
  /* `const {  ...  } = require('./iets')`, ook over meerdere regels.

     De vooruitblik op het eind is niet cosmetisch. Zonder hem las de eerste
     versie van deze regel ook

         const { a, b } = <require van ./tokens>.maakTokens(getUserById);

     als een kale require, en meldde dan dat tokens.js die namen niet
     exporteert -- terwijl ze uit de AANROEP komen. Dat leverde 1767 valse
     meldingen: een regel die alles aanwijst, wijst niets aan. De require moet
     dus het HELE rechterlid zijn, niet het begin ervan.

     En de inhoud mag geen accolade of puntkomma bevatten. Met een luie
     [\s\S]*? sprong het patroon over statements heen: begon het bij een
     `const { a } = ctx;` zonder require, dan liep het door tot de EERSTVOLGENDE
     `} = require(..)` verderop in het bestand en las het alles daartussen als
     namen. Zo kwam server/kern/pay/index.js "namen halen" uit een buurbestand
     dat het nooit destructureert. */
  const RE = /(?:const|let|var)\s*\{([^{};]*?)\}\s*=\s*require\(\s*'(\.[^']*)'\s*\)(?=\s*[;\n])/g;
  for (const f of bestanden) {
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    for (const m of bron.matchAll(RE)) {
      const doel = los(f, m[2]);
      if (!doel) continue;                          // pad-fouten vangt regel 1/8 al
      const bekend = haal(doel);
      if (!bekend) { overgeslagen++; continue; }
      gecontroleerd++;
      for (const deel of m[1].split(',')) {
        const t = deel.trim();
        if (!t) continue;
        if (t.includes('=')) continue;              // standaardwaarde: afwezigheid is voorzien
        if (t.startsWith('...')) continue;          // rest: pakt wat er is
        const naam = (t.split(':')[0] || '').trim();
        if (!/^[A-Za-z_$][\w$]*$/.test(naam)) continue;
        if (!bekend.has(naam)) {
          mis++;
          fout(path.relative(ROOT, f) + ' haalt "' + naam + '" uit ' + path.relative(ROOT, doel) +
            ', maar dat exporteert die naam niet -- hij wordt stilzwijgend undefined');
        }
      }
    }
  }
  if (!mis) ok(gecontroleerd + ' destructureringen nagekeken tegen de exportlijst van hun module (' +
    overgeslagen + ' overgeslagen: fabriek, spread of anderszins niet statisch te bepalen)');
}

/* 27) geen dode configuratie: een variabele die je aanraadt, moet iets DOEN.

   DE FOUT DIE DIT VANGT, EN DIE ECHT IS GEBEURD. De productie-keuring drong aan
   op SENTRY_DSN "voor externe fout-tracking". PRODUCTION.md noemde hem drie
   keer, docker-compose gaf hem door aan de container, en op de go-live-lijst
   stond "SENTRY_DSN gezet en er komt een testfout binnen". Niets in deze
   codebase las die variabele: het pakket @sentry/node is er nooit gekomen (zero
   dependencies) en server/foutmelder.js nam zijn plaats in, met een eigen
   webhook op ERR_WEBHOOK_URL -- die in geen enkele documentatie stond.

   Wie de checklist netjes afliep zette dus de verkeerde variabele, vinkte een
   regel af die niet af te vinken was, en ging live zonder alarmering. Ooit
   klopte die tekst; niemand keek hem na toen de laag eronder veranderde.

   DE TRUC IN DEZE REGEL. De productie-keuring zelf telt NIET mee als "leest
   hem". Anders is elke waarschuwing zijn eigen bewijs: `if (!env.SENTRY_DSN)
   waarschuw(...)` is een leesactie, en dan blijft precies deze fout onzichtbaar.
   Wat telt is of er ergens ANDERS in server/, scripts/ of de Rust-motor iets
   mee gebeurt.

   Er is een categorie die dan onterecht opvalt: vlaggen die BIJ de keuring
   horen ("ik weet het, start toch"). Die staan hieronder met een reden. Dat is
   bewust handwerk: het verschil tussen "bevestigingsvlag" en "dode belofte" is
   niet machinaal te zien, en wie een nieuwe naam op deze lijst zet moet er een
   eerlijke zin bij kunnen schrijven. */
console.log('\n27) geen dode configuratie: elke aangeraden variabele wordt ergens gelezen');
{
  const MAG_DOOD = new Map([
    ['POSTGRES_DB', 'gelezen door de postgres-container zelf, niet door onze code'],
    ['POSTGRES_USER', 'idem'],
    ['POSTGRES_PASSWORD', 'idem'],
    ['POSTGRES_PASSWORD_FILE', 'gelezen door de officiele postgres-container; het geheim blijft zo buiten docker inspect'],
    ['PGDATA', 'gelezen door de officiele postgres-container om de datamap te kiezen'],
    ['RTG_ALLOW_PLAINTEXT', 'bevestigingsvlag VOOR de keuring: "ik weet dat er geen sleutel is, start toch"'],
    ['STRIPE_DEMO_BEWUST', 'oude vlag die de productie-keuring alleen nog expliciet afwijst; runtime negeert hem'],
    ['SENTRY_DSN', 'bewust genoemd om te WAARSCHUWEN dat hij niets doet; de echte alarmweg is ERR_WEBHOOK_URL']
  ]);
  // De hele keuringsmap telt als belofte-bron EN wordt uitgesloten van "leest
  // hem": anders is elke waarschuwing haar eigen bewijs. Sinds de geldkant is
  // afgesplitst zijn dat twee bestanden, en een derde hoort er vanzelf bij.
  const KEURMAP = 'server/config/';
  let dood = 0;
  try {
    const gelezen = new Set();
    for (const map of ['server', 'scripts']) {
      loop(path.join(ROOT, map), /\.(js|mjs|cjs|sh)$/, f => {
        const rel = path.relative(ROOT, f).replace(/\\/g, '/');
        if (rel.startsWith(KEURMAP)) return;         // de keuring is niet haar eigen bewijs
        const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
        for (const m of bron.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) gelezen.add(m[1]);
        for (const m of bron.matchAll(/\benv\.([A-Z_][A-Z0-9_]*)/g)) gelezen.add(m[1]);
        /* Shellscripts lezen dezelfde productieomgeving, maar stonden hier
           buiten beeld. Daardoor noemde Compose een werkende backupvariabele
           "dood" terwijl backup.sh hem letterlijk gebruikte. Alleen $NAAM en
           ${NAAM...}; geen losse hoofdletters uit tekst. */
        if (rel.endsWith('.sh')) {
          for (const m of bron.matchAll(/\$\{([A-Z_][A-Z0-9_]*)[^}]*\}/g)) gelezen.add(m[1]);
          for (const m of bron.matchAll(/\$([A-Z_][A-Z0-9_]*)\b/g)) gelezen.add(m[1]);
        }
      });
    }
    // De native motor is evenzeer runtimecode. Hij leest variabelen via de
    // kleine `env("NAAM", standaard)`-helper (en getypeerde varianten zoals
    // env_bool) of rechtstreeks via std::env::var.
    // Alleen Node scannen zou iedere Docker-vlag voor Rust ten onrechte dood
    // noemen en toekomstige echte configuratiefouten in ruis laten verdwijnen.
    loop(path.join(ROOT, 'motor', 'src'), /\.rs$/, f => {
      const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
      for (const m of bron.matchAll(/\benv(?:_[a-z]+)*\(\s*"([A-Z_][A-Z0-9_]*)"/g)) gelezen.add(m[1]);
      for (const m of bron.matchAll(/std::env::var\(\s*"([A-Z_][A-Z0-9_]*)"/g)) gelezen.add(m[1]);
    });
    const genoemd = new Map();                        // naam -> waar hij beloofd wordt
    for (const n of fs.readdirSync(path.join(ROOT, KEURMAP)).filter(x => x.endsWith('.js'))) {
      const rel = KEURMAP + n;
      const bron = zonderCommentaar(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      for (const m of bron.matchAll(/env\.([A-Z_][A-Z0-9_]*)/g)) if (!genoemd.has(m[1])) genoemd.set(m[1], rel);
    }
    const dc = path.join(ROOT, 'docker-compose.yml');
    if (fs.existsSync(dc)) {
      for (const m of fs.readFileSync(dc, 'utf8').matchAll(/^ {6}([A-Z_][A-Z0-9_]*):/gm))
        if (!genoemd.has(m[1])) genoemd.set(m[1], 'docker-compose.yml');
    }
    for (const [naam, waar] of genoemd) {
      if (gelezen.has(naam) || MAG_DOOD.has(naam)) continue;
      dood++;
      fout(waar + ' belooft ' + naam + ', maar niets in server/, scripts/ of motor/ leest die variabele' +
        ' -- zet hem aan het werk, haal hem weg, of zet hem met een reden in MAG_DOOD');
    }
    if (!dood) ok(genoemd.size + ' beloofde omgevingsvariabelen doen ook echt iets (' +
      MAG_DOOD.size + ' benoemd als uitzondering)');
  } catch (e) { fout('kon de configuratie niet nalopen: ' + e.message); }
}

/* 28) elke API-route heeft een poort, of staat met een reden op de publieke lijst.

   DE KLASSE DIE DIT VANGT is de onzichtbaarste die er is: een route die je
   vergeet te poorten geeft GEEN fout, geen log en geen kapotte pagina. Hij doet
   het perfect, alleen ook voor mensen voor wie hij niet bedoeld is. Er is niets
   dat er ooit over klaagt.

   Een route telt als gepoort wanneer een van deze drie geldt:
   1. er staat poort-middleware voor de handler (auth, supplierAuth, ...);
   2. de handler roept zelf een poort-hulpje aan (profiel(req,res), rtfSociaal,
      resolveSession, ...) -- dat patroon staat door de hele rtf-laag;
   3. de handler kan zelf 401 of 403 antwoorden, en doet dus zijn eigen controle.

   Punt 3 is een vormsignaal en dus zwakker dan de andere twee. Dat mag hier,
   want dit is een AUDIT en geen autorisatie: het ergste wat een gemist signaal
   doet, is een route onterecht op de publieke lijst laten belanden -- en die
   lijst wordt door een mens gelezen. Het omgekeerde (een echte gat-route die
   ongemerkt doorglipt) is wat we tegenhouden.

   DRIE KEER MIS GEWEEST TIJDENS HET BOUWEN, en dat staat hier omdat het iets
   zegt over hoe je zo'n lijst maakt:
   - `express.json`, `rem` en `talenCache` staan ook voor een handler maar zijn
     GEEN poort. Een regel die "er staat iets voor de handler" als bewijs neemt,
     keurt 37 routes ten onrechte goed.
   - `...lid` (een spread van `[auth, geenGast]`) werd gemist zolang ik alleen
     naar kale namen keek.
   - een handler als `teamOp((s, b) => ...)` heeft geen (req, res)-signatuur, en
     mijn eerste knip zocht daarop -- dan viel `auth` buiten beeld.
   Elke ronde werd de lijst kleiner. Wie hem uitbreidt: meten, niet gokken. */
console.log('\n28) elke API-route heeft een poort (of staat met reden op de publieke lijst)');
{
  /* `meetpoort` staat hier omdat het dezelfde deur is als `magMeten` hieronder,
     alleen als middleware: server/meetpoort.js weigert met 404 tenzij het
     metrics-token klopt of het verzoek van een intern adres komt. Hij kwam
     erbij toen de sonde een tweede endpoint met precies die eis kreeg. */
  /* `gastAuth` (routes/gast.js) hoort in deze rij en is geen uitzondering: hij
     zoekt de tafelsleutel op, weigert met 401 als die niet bij een OPEN
     rekening hoort, en zet pas daarna req.gast. Dat is precies wat de andere
     namen hier doen -- alleen is het bewijs een sleutel van de tafel in plaats
     van een sessie van een account, omdat een gast aan tafel 12 geen lid hoeft
     te zijn. */
  const POORT_MW = new Set(['auth', 'supplierAuth', 'officeAuth', 'techAuth', 'boardroomAuth',
    'huisAuth', 'baasAuth', 'lid', 'geenGast', 'eigenaarAlleen', 'meetpoort', 'gastAuth',
    /* de gezinsdeur van het RTFoundation-huis (gezinscode + profieltoken, gasten
       erbuiten). Stond eerst als aanroep BINNEN de handler; is middleware geworden
       toen die routes zichtbaar werden, zodat bij elke route staat welke deur hij
       heeft -- zie regel 45 voor waarom ze onzichtbaar waren. */
    'gezinsPoort', 'huisPoort',
    /* spread van [auth, geenGast], zoals `lid` hierboven; werd zichtbaar toen
       de kantoorpakket-paden voluit kwamen te staan (regel 45) */
    'ledenAuth', 'rtfPoort']);
  POORT_MW.add('arrivalPassAuth'); // bezit van de tijdelijke, gehashte Arrival Pass
  /* `viaBeheerOfDirectie` (routes/tenant.js) is geen derde poort maar een keuze
     tussen de twee die er al zijn: het beheer-token, of een lid met het recht
     `werkruimte`. Hij belandde hier omdat deze regel 800 tekens vooruitkijkt en
     bij de volgende route stopt -- staat de helperfunctie achter een tweede
     route, dan valt zijn 403 buiten het venster en heet de eerste route
     ongepoort. Bij naam noemen is eerlijker dan de code herschikken om een
     tekstafstand te plezieren. */
  /* DE POORTEN VAN DE RTFOUNDATION- EN SCHOOLTAK, toegevoegd 2 september 2026.

     Die takken hangen via `app.use('/api/foundation', router)` en waren daardoor
     onzichtbaar voor de uitdrukking hierboven -- 342 van de 565 paden die deze
     regel niet zag (zie de schaduwmeting onderaan). Ze dragen geen bewakerslaag
     en poorten in de HANDLER, met een eigen vocabulaire dat hier niet stond.

     ELKE NAAM IS IN ZIJN DEFINITIE NAGEKEKEN, en dat is geen formaliteit: de
     eerste meting gaf ook `schoon`, `getal`, `String` en `isDatum` als kandidaat,
     want die bewaken ook een vroege return. Wie die lijst op frequentie vult,
     keurt honderden routes goed op een opschoonfunctie.

       gezinVan        gezinshulp.js:147   return null
       sessieVan       foundation.js:44    403 + return null
       familieVan      foundation.js:51    403 (weigert gasten) + return null
       gezinSessie     poorten.js:69       403 + return null
       schoolVan       poorten.js:13       403 + return null
       personeelVan    poorten.js:32       403 + return null
       klasVan         poorten.js:44       403 + return null
       docentCheck     onderwijs.js:44     403
       lesVan          onderwijs.js:38     return null
       beheerderVan    gezinshulp.js:158   403
       magKlus         gezinsleven.js:105  403
       marktVolwassen  markt.js:14         403
       sessie          leden-mail.js:19    403 (weigert gasten) + return null

     BEWUST NIET OPGENOMEN, en met de reden:
       geldigePin   `p => /^\d{4,6}$/.test(p)` -- een controle op VORM is geen
                    controle (LAT.md regel 8). Vier cijfers is geen bewijs.
       magGeld,     rolpredicaten op een AL geauthenticeerde sessie
       isGast       (`s.p.rol`). Ze verfijnen een poort; ze zijn er geen.
       schoon,      opschonen en omzetten. Ze bewaken wel een vroege return,
       getal        en juist daarom staan ze hier met naam als tegenvoorbeeld.
       mijn, ipVan  een gefilterde berichtenlijst en het IP-adres. Ze staan naast
                    een poort, ze zijn er geen.

     EN `poort` STAAT ER WEL IN, MAAR ALLEEN IN DE VORM `poort(req, ...)`. Deze
     naam draagt in dit huis twee betekenissen, en ik heb ze bij het schrijven
     van deze lijst eerst verwisseld -- met de gevaarlijke uitkomst, want ik
     sloot de echte poort uit:

       `server/school/rollen.js:84`  function poort(req, res, recht)
                                     schoolcode, token, actieve status EN een
                                     rechtencontrole, alle vier met 403. Dit is
                                     de poort van de hele schooltak.
       `server/school/taalcheck.js:34`  const poort = mag(doel, taal, beleid)
                                     een TAALBELEID-uitkomst met 400. Geen
                                     autorisatie, en toevallig dezelfde naam.

     De vorm scheidt ze: de poort wordt met `(req` aangeroepen, de variabele
     wordt toegekend. Vandaar de tweede tak in de uitdrukking hieronder en niet
     de kale naam. Dit is SEMANTIEK.json in het klein -- een naam met twee
     betekenissen, in de veiligheidslaag. */
  const POORT_BINNEN = /\b(profiel|schoolProfiel|rtfSociaal|eisAccount|resolveSession|verifyToken|sessionFor|magInzien|isEigenaar|boardroomWie|magBoardroom|doosSleutelOk|magMeten|metPartner|samenSess|kantoorSess|werkPoort|beheerVan|lidVan|viaBeheerOfDirectie|gezinVan|sessieVan|familieVan|gezinSessie|schoolVan|personeelVan|klasVan|docentCheck|lesVan|beheerderVan|magKlus|marktVolwassen|sessie)\s*\(|\bpoort\s*\(\s*req/;

  /* PUBLIEK MET REDEN staat in ./lib/publiekeroutes.js, en daar alleen. Hij
     stond hier, en het mutatiecontractregister heeft hem ook nodig: een contract
     eist een toegangsklasse, en voor een publieke route is dat PUBLIC MET EEN
     REDEN -- precies wat hier per route al geschreven staat. Twee kopieen zouden
     uiteenlopen, en dan noemt de ene lijst een route publiek die op de andere
     een poort heeft. */
  const { PUBLIEK } = require('./lib/publiekeroutes');

  let gaten = 0, viaMw = 0, viaBinnen = 0, totaal = 0;
  /* DE STAART NIET MEE-MATCHEN. Hier stond ([\s\S]{0,800}) in het patroon zelf,
     en dat CONSUMEERT die 800 tekens: exec() zoekt daarna verder voorbij de
     staart en slaat elke route over die er binnen valt. Uitkomst: 709 van de
     ~1900 routes bekeken, en netjes "alles in orde" gemeld. Een regel die een
     fractie ziet en volledigheid suggereert is precies wat deze regel moet
     tegenhouden -- gevonden doordat een mutatie NIET beet (LAT.md regel 2). */
  const RE = /app\.(get|post|put|delete|patch)\(\s*['"](\/api\/[^'"]*)['"]\s*,/g;
  const gezien = new Set();        // publieke paden die de lijst echt nodig hadden
  const bestaat = new Set();       // alle /api-paden die we tegenkwamen
  loop(path.join(ROOT, 'server'), /\.js$/, f => {
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    let m;
    while ((m = RE.exec(bron))) {
      totaal++;
      const pad = m[2];
      /* HET VENSTER STOPT BIJ DE VOLGENDE ROUTE. Zonder die knip keek deze
         regel 800 tekens vooruit en liep daarmee de BUURMAN in: een route zonder
         poort werd goedgekeurd omdat de route eronder ergens een 401 teruggaf.
         Precies dat gebeurde bij /api/aanmeld/start, en het kwam pas aan het
         licht doordat een `await` van zes tekens de 401 van de buurman net
         buiten het venster duwde -- een groene regel die aan een toevallige
         tekstafstand hing. Valse goedkeuring is bij deze regel de gevaarlijke
         richting; een venster dat over de grens kijkt is er een bron van. */
      const ruw = bron.slice(m.index + m[0].length, m.index + m[0].length + 800);
      const volgende = ruw.search(/app\.(get|post|put|delete|patch)\(\s*['"]/);
      const staart = volgende > 0 ? ruw.slice(0, volgende) : ruw;
      bestaat.add(pad);
      const knip = staart.search(/=>|function\s*\(/);
      const voor = knip > 0 ? staart.slice(0, knip) : staart.slice(0, 80);
      if ([...voor.matchAll(/([A-Za-z_$][\w$]*)/g)].some(x => POORT_MW.has(x[1]))) { viaMw++; continue; }
      /* EERST TE SLIM GEWEEST. Hier stond ook een heuristiek op "staat er
         idToken/token/sleutel/code in het lijf" als bewijs van een poort. Dat
         keurde meteen een handvol routes goed die alleen een BEDRIJFSCODE uit
         de body lezen -- en dat is geen geloofsbrief. Valse goedkeuring is de
         gevaarlijke richting bij deze regel: een gemiste melding is stil.
         Routes die hun bewijs echt in het lijf dragen (RTG iD met een idToken)
         staan nu bij naam op de publieke lijst, met die reden erbij. */
      if (POORT_BINNEN.test(staart) || /\b(401|403)\b/.test(staart)) { viaBinnen++; continue; }
      if (PUBLIEK.has(pad)) { gezien.add(pad); continue; }
      gaten++;
      fout(path.relative(ROOT, f) + ': ' + pad + ' heeft geen poort en staat niet op de publieke lijst' +
        ' -- zet er een poortwachter voor, of neem hem met een REDEN op in PUBLIEK (check.js regel 28)');
    }
  });
  /* Een publieke lijst die namen bevat die niet meer bestaan, groeit stil vol en
     verliest zijn betekenis. Dit is dezelfde controle als regel 25b. */
  for (const pad of PUBLIEK.keys()) {
    if (gezien.has(pad)) continue;
    gaten++;
    /* Twee heel verschillende gevallen, en ze verwarren zou de lijst juist
       stiller maken. Bestaat de route nog wel, dan heeft hij inmiddels een
       eigen poort en is de uitzondering overbodig geworden -- dat is goed
       nieuws, maar de regel hoort weg. Bestaat hij niet meer, dan groeit de
       lijst vol met namen die niets meer betekenen. */
    fout(bestaat.has(pad)
      ? 'check.js regel 28: ' + pad + ' staat op de publieke lijst maar heeft inmiddels een eigen poort -- haal de uitzondering weg'
      : 'check.js regel 28: ' + pad + ' staat op de publieke lijst maar bestaat niet (meer) als route');
  }
  if (!gaten) ok(totaal + ' API-routes: ' + viaMw + ' via een poortwachter, ' + viaBinnen +
    ' met een poort in de handler, ' + PUBLIEK.size + ' bewust publiek met een reden');

  /* DE BLINDE VLEK VAN DEZE REGEL, IN DE SCHADUW GEMETEN.

     Alles hierboven oordeelt over wat de uitdrukking `app.<verb>('/api/...')`
     VINDT. Wat hij niet vindt, wordt niet afgekeurd en ook niet geteld -- en dat
     is de gevaarlijkste vorm van groen: een regel die een deel van zijn invoer
     niet BEKIJKT, zegt niet "in orde" maar "ik heb niet gekeken" (lat regel 10,
     hier op de handhaver zelf toegepast).

     De vergelijking staat in ./lib/poortbereik.js en gaat tegen de LEVENDE
     routetabel, niet tegen een tweede regex. Hij MELDT en blokkeert niet: 565
     routes in een keer rood zetten maakt van deze regel een muur die binnen een
     week wordt uitgezet, en "geen bewakerslaag" is niet hetzelfde als
     "onbeveiligd" -- honderden routes in die takken controleren een
     capability-token in de handler. Wat ze nodig hebben is een oordeel per
     route. CONTROLPLANE.md schrijft die volgorde voor: eerst meelopen, dan
     afdwingen. TAKEN.md 7.14 draagt de weg naar hard. */
  {
    const { buitenBereik } = require('./lib/poortbereik');
    const b = buitenBereik(bestaat, { poortMw: POORT_MW, poortBinnen: POORT_BINNEN, publiek: PUBLIEK });
    if (b.nietVastTeStellen) {
      console.log('  \x1b[2m? bereik van deze regel niet vast te stellen: ' + b.nietVastTeStellen + '\x1b[0m');
    } else if (!b.paden.length) {
      ok('en deze regel ziet elk /api-pad dat de router kent');
    } else if (b.nietGeclassificeerd) {
      console.log('  \x1b[2m? ' + b.paden.length + ' paden vallen buiten deze regel, ongeclassificeerd: ' +
        b.nietGeclassificeerd + '\x1b[0m');
    } else {
      const k = b.klasse;
      console.log('  \x1b[2m! SCHADUW: ' + b.paden.length + ' van de ' + b.bekend +
        ' /api-paden die de router kent, vallen buiten de uitdrukking van deze regel. Geclassificeerd: ' +
        k.poortwachter.length + ' via een poortwachter, ' + k.inHandler.length + ' met een poort in de handler, ' +
        k.publiek.length + ' publiek met reden, ' + k.bronOnvindbaar.length + ' bron onvindbaar, ' +
        k.onbekend.length + ' bewakers onbekend.\x1b[0m');
      if (k.gat.length) {
        console.log('  \x1b[2m! en ' + k.gat.length + ' ZONDER enige poort -- die blokkeren nog niet, ' +
          'maar dit is de lijst die naar nul moet (TAKEN.md 7.14):\x1b[0m');
        for (const g of k.gat.slice(0, 12)) console.log('  \x1b[2m    ' + g + '\x1b[0m');
        if (k.gat.length > 12) console.log('  \x1b[2m    ... en nog ' + (k.gat.length - 12) + '\x1b[0m');
      } else {
        console.log('  \x1b[2m! en GEEN ENKELE zonder poort -- de schaduw mag hard worden gemaakt\x1b[0m');
      }
    }
  }
}

/* 29) de Authorization-kop wordt gelezen om een token te HALEN, niet om te oordelen.

   Dit is de handhaver voor LAT.md regel 8, die tot nu toe alleen een voornemen
   was: een controle op VORM is geen controle.

   Het geval dat hem opleverde stond in /api/translate:

       const ingelogd = <regex op Bearer>.test(req.get('authorization') || '');

   Een regex op een header. Wie "Bearer x" meestuurde zette daarmee de weg naar
   de betaalde AI-aanbieder open, zonder account en zonder rekening. Het
   commentaar erboven beloofde precies het tegenovergestelde, dus lezen hielp
   niet, en de bijbehorende toets gaf de vlag zelf mee, dus toetsen ook niet.

   De regel: elke plek die de kop leest, moet binnen twaalf regels het eruit
   gehaalde token door een echte verifier halen (verifyToken, resolveSession,
   sessionFor, veiligGelijk, ...). Wie de kop alleen betast, wordt aangewezen.

   LET OP HET STRIPPEN, want daar ging het twee keer mis. Deze regel meldt een
   REGELNUMMER en zoekt naar een STRING, en de twee bestaande strippers kunnen
   elk maar een van die twee:
   - zonderCommentaar (hierboven) vervangt een blokcommentaar door EEN spatie en
     plet daarmee elk regelnummer erna; mijn eerste meting wees zo vier
     onschuldige plekken aan;
   - kruisscan.strip houdt de regels heel maar haalt ook STRINGS weg, dus
     req.get('authorization') werd req.get(...) en het patroon matchte nog maar
     een van de zeventien plekken -- opnieuw een scan die bijna niets ziet en
     vrolijk groen meldt.
   Vandaar hieronder een derde variant die allebei doet: commentaar weg, strings
   en newlines heel. Dat is bewust GEEN vierde kopie van de andere twee: hij
   lost een eis op die geen van beide dekt, en dat staat hier zodat de volgende
   niet opnieuw de verkeerde pakt. */
console.log('\n29) de Authorization-kop wordt gelezen om een token te halen, niet om te oordelen');
{
  /* commentaar weg, strings en regelnummers heel */
  const stripRegels = (b) => String(b)
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const KOP = /req\.get\(\s*['"]authorization['"]\s*\)|req\.headers\s*\[\s*['"]authorization['"]\s*\]|req\.headers\.authorization/i;
  const VERIFIER = /\b(verifyToken|resolveSession|sessionFor|veiligGelijk|verifyActionToken|magAi|scimSleutelOk|apiSleutelOk|magMeten|vanSleutel|accounts\.\w+)\s*\(/;
  const VENSTER = 12;   // regels waarbinnen de verificatie moet volgen
  /* Plekken die de kop bewust lezen zonder te verifieren. Vandaag leeg, en dat
     hoort zo te blijven: wie hier iets toevoegt legt uit waarom betasten hier
     genoeg is. Kun je dat niet, dan is het waarschijnlijk gewoon een gat. */
  /* DE SLEUTEL IS HET BESTAND PLUS DE REGEL ZELF, NIET HET REGELNUMMER.

     Hier stonden nummers ('basis.js:131'). Dat brak zodra iemand er BOVEN een
     regel bijzette: de uitzondering verschoof mee naar 146, de sleutel niet, en
     de keuring wees ineens een plek aan die niemand had aangeraakt. Dat is
     vandaag gebeurd -- bij een commentaarblok van vijftien regels.

     Erger is de andere kant: op zo'n vrijgekomen nummer kan een ANDERE regel
     komen te staan, en die wordt dan stilzwijgend vrijgepleit door een
     uitzondering die niet voor hem bedoeld was. test/scheiding.test.js heeft
     precies deze les al geleerd en sleutelt daarom op het routepad. Een
     regelnummer schuift op; de regel zelf niet. */
  const MAG_BETASTEN = new Map([
    ["server/foundation/basis.js|const h = ((req.get && req.get('authorization')) || '');",
      'tokenUit() HAALT alleen het token uit het verzoek; de aanroepers verifieren het (profielVan zoekt het op in de profielen van dat gezin). Een extractor is geen beslissing.'],
    ["server/kern/stuur.js|const auth = req.get && req.get('authorization');",
      'geeft de kop ONGEWIJZIGD door aan een interne dienst op 127.0.0.1, die zelf verifieert. Hier wordt niets besloten.'],
    ["server/lib/idem-poort.js|const auth = (typeof req.get === 'function' && req.get('authorization')) || '';",
      'hasht de kop tot een SCOPE en beslist er niets mee: de idem-poort verleent geen toegang, hij zorgt ' +
      'alleen dat twee afzenders nooit dezelfde opslagsleutel delen. De echte authenticatie staat achter de ' +
      'poort, en alleen een 2xx gaat de kast in -- een verzonnen kop levert dus nooit een bewaard antwoord op.'],
    ["server/lib/dubbeltik.js|const kop = req.get('authorization') || '';",
      'de dubbeltik VERSLEUTELT de kop tot een hash en kijkt er nooit in. Hij beslist niets over toegang -- de hash bepaalt alleen in welke la het bewaarde antwoord komt, zodat twee bellers met dezelfde idem-sleutel nooit elkaars antwoord krijgen. Een verzonnen kop levert dus hooguit een eigen lege la op; of het verzoek mag, beslist de echte auth verderop in de keten.'],
    ["server/middleware/idempotentie.js|const wie = (req.get('authorization') || '') + '|' + String(req.ip || '');",
      'de kop is hier alleen ONDOORZICHTIG sleutelmateriaal: hij gaat een sha256 in zodat twee afzenders ' +
      'met dezelfde idempotentiesleutel nooit elkaars antwoord krijgen. Er wordt niets uit gelezen en niets ' +
      'besloten -- een fout token betekent hoogstens een eigen kasvakje, en de poort van de route oordeelt zelf.'],
    ["server/trio-kleef.js|const kop = (req && req.headers && req.headers.authorization) || '';",
      'de poortwachter gebruikt het token als ROUTELABEL en niets anders: het gaat rechtstreeks een hash in en de uitkomst is een servernummer. ' +
      'Er wordt niets verleend -- de gekozen server draait de volledige stapel en verifieert zelf, dus een verzonnen Bearer levert daar gewoon een 401 op. ' +
      'Zou hier ooit iets aan een tokenwaarde worden opgehangen (een quotum per proces, een tarief per proces), dan vervalt deze reden.']
  ]);
  let los = 0, gekeurd = 0;
  loop(path.join(ROOT, 'server'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const regels = stripRegels(fs.readFileSync(f, 'utf8')).split('\n');
    regels.forEach((r, i) => {
      if (!KOP.test(r)) return;
      gekeurd++;
      const plek = rel + ':' + (i + 1);
      if (MAG_BETASTEN.has(rel + '|' + r.trim())) return;
      if (VERIFIER.test(regels.slice(i, i + VENSTER).join('\n'))) return;
      los++;
      fout(plek + ' leest de Authorization-kop maar haalt het token binnen ' + VENSTER +
        ' regels niet door een verifier -- een controle op de VORM van een header is geen' +
        ' authenticatie (LAT.md regel 8)');
    });
  });
  if (!los) ok(gekeurd + ' plekken lezen de Authorization-kop, en elk daarvan verifieert het token (' +
    MAG_BETASTEN.size + ' benoemd als uitzondering)');
}

/* 30) een schermtoets luistert naar paginafouten via het gedeelde hulpje.

   test/helper.js heeft letOpFouten(page, bak): dat zet de luisteraar EN filtert
   het ene bericht dat niet van ons is -- "Transition was skipped", de afwijzing
   die de browser zelf maakt als hij een navigatie-overgang overslaat
   (@view-transition in shared/rtg-uniform.css). Niemand van ons maakt die
   promise, dus niemand kan hem opvangen.

   Het hulpje stond er al en werd door drie van de drieenveertig bestanden
   gebruikt. De andere veertig hadden hun eigen regel, en die telde de ruis
   gewoon mee. Dat viel pas op toen wings.e2e.js erop zakte (die toets is inmiddels weg met de wings) -- in CI, niet hier,
   want het is een race. Een hulpje dat niemand aanroept is geen reparatie.

   Deze regel bewaakt dus niet de smaak maar de ruis: wie zijn eigen luisteraar
   zet, krijgt vroeg of laat een toets die valt op iets wat geen fout is. */
console.log('\n30) schermtoetsen luisteren naar paginafouten via het gedeelde hulpje');
{
  const testMap = path.join(ROOT, 'test');
  const EIGEN = /\.on\(\s*['"]pageerror['"]/;
  let eigen = 0, gebruikt = 0;
  for (const naam of fs.readdirSync(testMap).filter(n => /\.e2e\.js$/.test(n))) {
    const bron = fs.readFileSync(path.join(testMap, naam), 'utf8');
    if (bron.includes('letOpFouten(')) gebruikt++;
    if (naam === 'helper.js') continue;
    for (const [i, r] of bron.split('\n').entries()) {
      if (!EIGEN.test(r)) continue;
      eigen++;
      fout('test/' + naam + ':' + (i + 1) + ' zet zelf een pageerror-luisteraar' +
        ' -- gebruik letOpFouten(page, bak) uit test/helper.js, anders telt de browserruis mee');
    }
  }
  /* Nul gebruikers is geen "alles goed" maar een kapotte meting: dan is het
     hulpje hernoemd of verdwenen en let deze regel nergens meer op. */
  if (!gebruikt) fout('geen enkel e2e-bestand roept letOpFouten() aan -- is het hulpje hernoemd? Dan bewaakt regel 30 niets meer');
  else if (!eigen) ok(gebruikt + ' schermtoetsbestanden luisteren via letOpFouten, geen enkele met een eigen luisteraar');
}

/* 31) geen route die twee keer wordt geregistreerd.

   DEZE REGEL KOMT UIT EEN COMMIT VAN VANDAAG, en het lelijke eraan is dat er
   niets aan de code mankeerde -- alleen aan de manier waarop hij werd
   vastgelegd. server/routes/rtfkantoor.js werd met `git mv` verplaatst naar
   rtfkantoor/index.js en daarna aangepast (zes routes eruit, naar
   ./codedeuren.js). De verplaatsing stond klaar in de index, de AANPASSING
   niet. Wat er werd vastgelegd was dus: het oude bestand op de nieuwe plek,
   MET de zes oude routes, PLUS een nieuw bestand dat dezelfde zes registreert.

   Het gevolg is stiller dan een botsing: de router pakt de EERSTE laag die
   past, dus de oude, remloze route wint en de nieuwe met zijn twee remmen
   staat erachter te wachten. Geen fout bij het opstarten, geen dubbele
   melding, geen enkele toets die zakt -- want die draaiden hier op de
   werkmap, waar het wel goed stond.

   Een dubbele registratie is nooit expres. Dit is een van de weinige regels
   waarbij een uitzonderingenlijst niet nodig hoort te zijn, en zolang die
   leeg blijft is dat een gezond teken. */
console.log('\n31) geen enkele route wordt twee keer geregistreerd');
{
  const stripRegels = (b) => String(b)
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const zien = new Map();   // "POST /pad" -> [plek, plek]
  loop(path.join(ROOT, 'server'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    stripRegels(fs.readFileSync(f, 'utf8')).split('\n').forEach((r, i) => {
      const re = /app\.(get|post|put|delete|patch|all)\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(r))) {
        const sleutel = m[1].toUpperCase() + ' ' + m[2];
        if (!zien.has(sleutel)) zien.set(sleutel, []);
        zien.get(sleutel).push(rel + ':' + (i + 1));
      }
    });
  });
  /* Nul gevonden routes is geen schone lei maar een kapotte meting: dan is de
     vorm van de registratie veranderd en kijkt deze regel nergens meer naar. */
  if (zien.size < 500) fout('regel 31 vindt maar ' + zien.size + ' routes -- dat is te weinig om te kloppen; de scanner past niet meer op de bron');
  else {
    const dubbel = [...zien].filter(([, plekken]) => plekken.length > 1);
    for (const [sleutel, plekken] of dubbel)
      fout(sleutel + ' wordt ' + plekken.length + ' keer geregistreerd (' + plekken.join(', ') +
        ') -- de eerste wint stil, de rest is dode code');
    if (!dubbel.length) ok(zien.size + ' routes, elk precies een keer geregistreerd');
  }
}

/* 32) elk SVG-pad is te tekenen.

   Een pad dat de browser niet kan parsen verdwijnt zonder te klagen: geen
   foutmelding op het scherm, geen kapotte pagina, alleen een vorm die er niet
   is. Het vingerafdruk-icoon op de passkey-knop stond daardoor met drie in
   plaats van vier ribbels -- het laatste pad eindigde op "c0 1", een curve met
   twee van de zes getallen. Zoiets vind je nooit door de code te lezen; wel
   door de paden na te rekenen. De grammatica staat in scripts/svgpaden.js. */
console.log('\n32) elk SVG-pad is te tekenen');
{
  const { scan } = require('./svgpaden');
  const kapot = scan(ROOT, ['public', 'server', 'scripts', 'test']);
  for (const t of kapot) {
    fout('ontekenbaar pad: ' + t.bestand + ':' + t.regel + ' -- ' + t.fout + '\n      d="' +
      (t.d.length > 70 ? t.d.slice(0, 70) + '...' : t.d) + '"');
  }
  if (!kapot.length) ok('alle SVG-paden in de bron zijn te tekenen');
}

/* 33) tekst wordt niet in een kader geperst.

   lengthAdjust="spacingAndGlyphs" rekt niet alleen de spaties op maar de
   letters zelf. Op de weekdag van de klok stond een vaste textLength met dat
   attribuut: "Zondag" ging 71% uit elkaar staan, "Friday" 96%, en elke dag
   kreeg een andere rekfactor. Bij een display-serif als Bodoni is dat precies
   wat je niet doet. Wie tekst moet laten passen: meet eerst, en houd alleen in
   wat echt te breed is -- met lengthAdjust="spacing", dat de vormen heel laat.
   Zie pasInKastje() in public/shared/klok/klok-02.js. */
console.log('\n33) tekst wordt niet in een kader geperst');
{
  let geperst = 0;
  loop(path.join(ROOT, 'public'), /\.(js|html|svg)$/, f => {
    // commentaar eruit: een uitleg WAAROM dit niet mag, mag zelf geen alarm geven
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8')).replace(/<!--[\s\S]*?-->/g, ' ');
    if (!/spacingAndGlyphs/.test(bron)) return;
    geperst++;
    fout('spacingAndGlyphs in ' + path.relative(ROOT, f) +
      ' -- dat vervormt de letters zelf; meet de tekst en gebruik lengthAdjust="spacing"');
  });
  if (!geperst) ok('geen tekst die met spacingAndGlyphs vervormd wordt');
}

/* 34) elke AI-ingang draagt de toegangsregel, of staat erkend op de lijst.

   CLAUDE.md stelt een harde regel: de AI belooft nooit zelf toegang tot de
   Lifestyle- of Business Pass, bevestigt nooit een boeking als verwerkt, en
   voert geen echte hotel-/luchtvaartmerken op als partner. Die regel woont in de
   gedeelde promptbasis (RAHUL_BASIS -> RAHUL_LEAD / rahulLeadVoor, en de per-pas
   aiSystemPrompt): "je belooft niets wat je niet zeker kunt waarmaken (geen
   toegang, geen goedkeuring...)".

   Er zijn 74 plekken die het model aanroepen (naast de transportlaag); de
   meeste dragen die basis. De
   rest doet dat bewust niet -- JSON-uitvoer zonder vrije tekst, begrensde
   eenmalige opdrachten, of werk-/leverancier-/techniekgereedschap zonder
   pasgesprek -- en staat hieronder met naam en reden. Deze poort dwingt niets
   te herschrijven; hij zorgt dat er geen ONGEZIENE AI-ingang zonder de regel kan
   bijkomen. Wie een nieuwe bouwt, gebruikt de gedeelde basis (rahulLeadVoor /
   RAHUL_LEAD / aiSystemPrompt) of zet hem hieronder met een reden.

   De lijst wordt ook de andere kant op bewaakt: een naam die de regel intussen
   zelf draagt of het model niet meer aanroept, moet er weer uit -- zo blijft de
   lijst een eerlijke weergave en geen groeiende dooie hoek. */
console.log('\n34) elke AI-ingang draagt de toegangsregel, of staat erkend op de lijst');
{
  const { scan } = require('./ai-oproepen');
  // bestand (relatief aan server/) -> reden waarom het de gedeelde basis niet gebruikt
  const AI_BUITEN_BASIS = new Map([
    ['foundation/buddy.js', 'RTF-onderwijs: leermaatje voor kinderen, geen pasgesprek'],
    ['foundation/onderwijs/schrift.js', 'RTF-onderwijs: leerling-schrift, geen pasgesprek'],
    ['kern/agenda.js', 'JSON-uitvoer: agenda-structuur, geen vrije tekst naar een lid'],
    ['kern/baby.js', 'JSON-uitvoer: geen vrije tekst naar een lid'],
    ['kern/bijles.js', 'RTF-onderwijs: bijles, geen pasgesprek'],
    ['kern/gemeente/meldingen.js', 'JSON-uitvoer: meldingsvelden, geen vrije tekst naar een lid'],
    ['kern/homekit.js', 'JSON-uitvoer: scene-definitie, geen vrije tekst naar een lid'],
    ['kern/webmaker-ai.js', 'JSON-uitvoer: een website-ontwerp in de bloktaal, geen vrije tekst naar een lid'],
    ['kern/kijken.js', 'begrensd: beeldherkenning met eigen harde grenzen, geen pasgesprek'],
    ['kern/kletspraat/gesprek.js', 'kletsspel met eigen opdracht + taalregels, geen pasgesprek'],
    ['kern/leren/overhoren/lijsten.js', 'RTF-onderwijs: overhoorlijsten, geen pasgesprek'],
    ['kern/leren/projecten.js', 'RTF-onderwijs: projecten voor kinderen en gezinnen, geen pasgesprek'],
    ['kern/leren/schrijven.js', 'RTF-onderwijs: schrijfcoach, geen pasgesprek'],
    ['kern/lesmaker.js', 'RTF-onderwijs: lesontwerper, geen pasgesprek'],
    ['kern/markt/toezicht.js', 'begrensd: advertentietekst schrijven'],
    ['kern/office/delen.js', 'RTG Office werk-tool met vaste opdrachtenlijst, geen pasgesprek'],
    ['kern/onboarding/beheer.js', 'JSON-config voor een beheerder (intakevelden/contract), geen lid-gesprek'],
    ['kern/pakketten.js', 'begrensd: advies op basis van uitsluitend het meegegeven pakket'],
    ['kern/rtgonderzoeker.js', 'begrensd: analyse van aangeleverde bevindingen, "de mens beslist"'],
    ['kern/werkplaats-ai.js', 'JSON-uitvoer, geen vrije tekst naar een lid'],
    ['routes/muziek.js', 'JSON-uitvoer: muzikaal patroon, geen vrije tekst naar een lid'],
    ['routes/supplier/events/catering.js', 'JSON-uitvoer, leverancier-gereedschap'],
    ['routes/supplier/events/keuken/coach.js', 'JSON-uitvoer, leverancier-gereedschap'],
    ['routes/supplier/events/keuken/recepten.js', 'begrensd: werkinstructie voor een keukenkracht (leverancier)'],
    ['routes/supplier/events/mep.js', 'JSON-uitvoer, leverancier-gereedschap'],
    ['routes/supplier/events/planning.js', 'JSON-uitvoer, leverancier-gereedschap'],
    ['routes/supplier/tools.js', 'begrensd: reactie namens een leverancier'],
    ['routes/techniek/beheer.js', 'techniek/eigenaar-gereedschap, geen lid-gesprek'],
    ['routes/techniek/functie.js', 'techniek/eigenaar-gereedschap, geen lid-gesprek'],
    ['translate.js', 'vertaalmachine, geen gesprek'],
    ['translate/batch-model.js', 'JSON-lijstvertaler voor aantoonbare UI-brontekst, geen gesprek'],
  ]);
  const sites = scan(ROOT);
  const buiten = new Set(sites.filter(s => !s.draagtRegel).map(s => s.bestand));
  let mis = 0;
  // nieuwe AI-ingang zonder de regel en niet op de lijst
  for (const b of buiten) {
    if (!AI_BUITEN_BASIS.has(b)) {
      mis++;
      fout('AI-ingang zonder de toegangsregel: ' + b +
        ' -- gebruik de gedeelde basis (rahulLeadVoor / RAHUL_LEAD / aiSystemPrompt), of zet hem in AI_BUITEN_BASIS met een reden');
    }
  }
  // stale: staat op de lijst maar draagt de regel nu zelf, of roept het model niet meer aan
  for (const b of AI_BUITEN_BASIS.keys()) {
    if (!buiten.has(b)) {
      mis++;
      fout('overbodige uitzondering: ' + b +
        ' -- draagt de regel nu zelf of roept het model niet meer aan; haal hem uit AI_BUITEN_BASIS');
    }
  }
  if (!mis) {
    const draagt = sites.length - buiten.size;
    ok(draagt + ' AI-ingang(en) dragen de toegangsregel; ' + buiten.size + ' erkend op de lijst (van ' + sites.length + ' totaal)');
  }
}

/* 35) Elke meter is geijkt, of zegt met naam waarom niet.

   LAT-regel 10: "een meter die je niet hebt zien uitslaan, meet niets." Die
   regel stond opgeschreven en werd door mensen bewaakt -- en juist daar zijn
   op een dag zeven liegende meters gevonden. Deze regel maakt hem machinaal:
   elke sleutel uit de METERS-lijst van scripts/norm.js moet voorkomen in de
   registratie van test/meterijk.test.js, met OF een proef die hem op een
   bekend-foute invoer laat uitslaan, OF een reden waarom dat in een toets
   niet eerlijk kan.

   Wat deze regel NIET doet: bewijzen dat de proef zinnig is. Dat blijft
   regel 2 (natrekken met een mutatie). Wat hij wel doet: voorkomen dat een
   NIEUWE meter ongemerkt ongeijkt meelift -- en dat was precies hoe de zeven
   erin kwamen. */
console.log('\n35) elke meter met een norm is geijkt of noemt zijn reden');
{
  const normBron = fs.readFileSync(path.join(ROOT, 'scripts/norm.js'), 'utf8');
  const ijkPad = path.join(ROOT, 'test/meterijk.test.js');
  if (!fs.existsSync(ijkPad)) {
    fout('test/meterijk.test.js ontbreekt: zonder registratie is geen enkele meter geijkt');
  } else {
    const ijkBron = fs.readFileSync(ijkPad, 'utf8');
    // alleen de sleutels uit de METERS-lijst, niet elke 'sleutel:' in het bestand
    const lijst = /const METERS = \[([\s\S]*?)\n\];/.exec(normBron);
    const prest = /const PRESTATIEMETERS = \[([\s\S]*?)\n\];/.exec(normBron);
    const sleutels = [...(lijst ? lijst[1] : ''), ...(prest ? prest[1] : '')].length
      ? [...((lijst ? lijst[1] : '') + (prest ? prest[1] : '')).matchAll(/sleutel:\s*'([a-zA-Z0-9]+)'/g)].map(m => m[1])
      : [];
    /* Niet elke meter woont in norm.js. Wie een journaal nodig heeft (de
       waargenomen dekking, de schermdekking, de samenhang) meet in een eigen
       script en zet zijn sleutel daar in een METER-constante. Die ontsnapten
       aan deze regel -- en dat is precies het gat waar een ongeijkte meter
       doorheen glipt, dus lezen we ze er hier bij. */
    for (const bestand of fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.js') && f !== 'norm.js')) {
      const bron = fs.readFileSync(path.join(ROOT, 'scripts', bestand), 'utf8');
      for (const m of bron.matchAll(/^const METER[A-Z_]*\s*=\s*'([a-zA-Z0-9]+)'/gm)) {
        if (!sleutels.includes(m[1])) sleutels.push(m[1]);
      }
    }
    if (!sleutels.length) {
      fout('geen enkele meter gevonden in scripts/norm.js -- deze regel meet dan zelf niets');
    } else {
      const mist = sleutels.filter(s => !new RegExp('(^|[^a-zA-Z0-9])' + s + '\\s*:\\s*\\{').test(ijkBron));
      for (const s of mist) {
        fout('meter "' + s + '" staat niet in de registratie van test/meterijk.test.js -- ' +
          'voeg een proef toe die hem op een foute invoer laat uitslaan, of een reden waarom dat niet kan');
      }
      if (!mist.length) {
        const metReden = sleutels.filter(s => {
          const m = new RegExp(s + '\\s*:\\s*\\{([\\s\\S]{0,300}?)\\}').exec(ijkBron);
          return m && /reden:/.test(m[1]);
        }).length;
        ok(sleutels.length + ' meters staan in de registratie (' + (sleutels.length - metReden) +
          ' met een proef, ' + metReden + ' met een reden)');
      }
    }
  }
}


/* ============================================================================
   36) GEEN PROEFRESTANT IN DE GESCHIEDENIS

   Dit is twee keer misgegaan, op precies dezelfde manier. Een ijking of een
   mutatieproef verandert kortstondig een echt bestand -- dat MOET ook, want een
   proef die de bron niet aanraakt bewijst niets -- en zet het daarna in een
   `finally` weer terug. Committen gebeurt in dat venster van een paar seconden,
   en dan staat het restant in de geschiedenis terwijl de werkboom er schoon
   uitziet.

   TAKEN 6.4 loste dat de eerste keer op met "sindsdien gaat elke tussenstand
   eerst langs de diff". Dat is een voornemen, en LAT.md zegt precies wat een
   voornemen waard is: het ging opnieuw mis, met een nep-dependency die npm
   install bij de volgende ophaler zou laten struikelen.

   Deze regel kijkt daarom niet naar de WERKBOOM maar naar wat er in de commit
   staat. Dat is het hele punt: bij het geval van vandaag was de werkboom schoon
   en HEAD vervuild, dus elke controle op de werkboom had groen gegeven.

   WAAROM DE PATRONEN HIERONDER ZIJN OPGEKNIPT. De eerste versie schreef ze
   voluit, en klaagde prompt over zijn eigen uitleg -- het bestand dat de marker
   beschrijft bevat de marker. De verleiding is dan om check.js op een
   uitzonderingslijst te zetten, maar dat maakt uitgerekend de handhaver zelf
   het enige bestand waar een restant ongezien blijft. Opknippen kost een regel
   leesbaarheid en houdt iedereen onder toezicht.
   ========================================================================== */
console.log('\n36) geen proefrestant in de laatste commit');
{
  const git = (...a) => cp.spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  /* Zonder git valt er niets vast te stellen, en dan hoort deze regel te ZAKKEN
     en niet stilzwijgend te slagen (LAT.md regel 3: een meter zakt als zijn
     invoer ontbreekt). Anders is de handhaver weg zodra de map geen repo is. */
  const kop = git('rev-parse', 'HEAD');
  if (kop.status !== 0) {
    fout('kan HEAD niet lezen, dus dit is niet vast te stellen: ' + String(kop.stderr || '').trim());
  } else {
    /* Twee soorten restant, elk met hun eigen vorm.

       De IJKINGEN gebruiken allemaal dezelfde tijdelijke naam. Alleen het
       bestand dat die proeven definieert (test/meterijk.test.js) mag hem
       noemen, want daar wordt hij gemaakt.

       Een MUTATIERESTANT herken je aan de marker als staartcommentaar ACHTER
       code, niet aan het begin van een commentaarregel. Een blokcommentaar dat
       over een mutatie schrijft -- daar staan er een paar van in de bron, en
       die horen te mogen -- heeft die vorm niet. */
    const soorten = [
      { naam: 'ijkrestant', patroon: 'zz' + '-ijk-tijdelijk', mag: /^test\/meterijk\.test\.js$/,
        uitleg: 'een ijking heeft dit bestand aangeraakt terwijl er gecommit werd' },
      { naam: 'mutatierestant', patroon: '//[[:space:]]*' + 'MUTA' + 'TIE', mag: /^$/,
        uitleg: 'een mutatieproef is blijven staan; de bron is niet teruggezet' }
    ];
    let gevonden = 0;
    for (const s of soorten) {
      const r = git('grep', '-n', '-E', s.patroon, 'HEAD', '--', '*.js', '*.json', '*.html', '*.css');
      /* Exitcode 1 = niets gevonden, en dat is hier het goede antwoord. Alles
         daarboven is een echte fout en mag niet als "schoon" gelezen worden. */
      if (r.status > 1) { fout('git grep faalde voor ' + s.naam + ': ' + String(r.stderr || '').trim()); continue; }
      for (const regel of String(r.stdout || '').split('\n').filter(Boolean)) {
        const pad = regel.replace(/^HEAD:/, '').split(':')[0];
        if (s.mag.test(pad)) continue;
        gevonden++;
        fout(s.naam + ' in de commit: ' + regel.replace(/^HEAD:/, '').slice(0, 160) +
          '\n    ' + s.uitleg + ' -- zet het bestand terug en commit opnieuw (git commit --amend)');
      }
    }
    /* EN DE BLINDE VLEK DIE DEZE REGEL ZELF HAD, gevonden doordat hij hem miste.

       Op 2026-08-05 kwamen drie ijkbestanden mee in een commit (drie keer de
       tijdelijke naam onder server/kern/, met -a, -b en -c erachter) en deze regel
       gaf groen. De reden: hij grep't in de INHOUD, en de inhoud van zo'n bestand
       is `function zzIjkTijdelijkeNaam(x)` -- camelCase, zonder streepjes. De
       marker zat alleen in de BESTANDSNAAM, en daar keek niemand.
       (De naam staat hier niet voluit, om precies de reden die hierboven bij de
       opgeknipte patronen staat: dan klaagt deze regel over zijn eigen uitleg.)

       Dat is precies de vorm die de rest van deze lijst probeert te voorkomen: een
       handhaver die iets net niet dekt is gevaarlijker dan geen handhaver, want
       hij geeft groen. Dus nu ook de namenlijst van de commit. */
    const lijst = git('ls-tree', '-r', '--name-only', 'HEAD');
    if (lijst.status !== 0) {
      fout('kan de bestandenlijst van HEAD niet lezen: ' + String(lijst.stderr || '').trim());
    } else {
      const marker = 'zz' + '-ijk-tijdelijk';
      for (const pad of String(lijst.stdout || '').split('\n').filter(Boolean)) {
        if (!pad.includes(marker)) continue;
        gevonden++;
        fout('ijkrestant als BESTAND in de commit: ' + pad +
          '\n    een ijking maakt dit bestand en ruimt het op; hier is er gecommit tussen die twee' +
          ' -- git rm het bestand en commit opnieuw');
      }
    }
    if (!gevonden) ok('de laatste commit draagt geen ijk- of mutatierestant, in inhoud noch in naam');
  }
}

/* 37) een pagina die een hulpklasse gebruikt, laadt ook het blad waar hij in staat.

   De hulpklassen (public/shared/rtg-hulpklassen.css) vervangen style="..."-
   attributen, zodat style-src-attr ooit dicht kan. Dat werkt alleen als de
   pagina dat blad ook binnenhaalt -- en als hij dat NIET doet, breekt er niets
   zichtbaar op de plek waar je kijkt: het element verliest gewoon zijn marge of
   zijn kleur. Precies het soort stille breuk waar deze lijst voor bestaat.

   De klassen komen uit het blad zelf en niet uit een lijst hier: een tweede
   lijst loopt binnen een week uit de pas (LAT.md regel 4). Een pagina "gebruikt"
   een klasse als hij hem zelf draagt, of als een script of bundel die hij laadt
   hem draagt. */
console.log('\n37) elke pagina die een hulpklasse gebruikt, laadt ook rtg-hulpklassen.css');
{
  const BLAD = path.join(ROOT, 'public/shared/rtg-hulpklassen.css');
  if (!fs.existsSync(BLAD)) {
    fout('public/shared/rtg-hulpklassen.css ontbreekt, dus deze regel is niet vast te stellen');
  } else {
    const klassen = Array.from(fs.readFileSync(BLAD, 'utf8').matchAll(/^\.(h-[a-z0-9]+)\s*\{/gm)).map(m => m[1]);
    if (!klassen.length) {
      fout('geen enkele .h-klasse gevonden in rtg-hulpklassen.css; dan meet deze regel niets');
    } else {
      const draagt = new RegExp('class="[^"]*\\b(?:' + klassen.join('|') + ')\\b');
      const PUB = path.join(ROOT, 'public');
      const web = (p) => '/' + path.relative(PUB, p).split(path.sep).join('/');
      const paginas = [];
      loop(PUB, /\.html$/, f => { if (!web(f).startsWith('/dist/')) paginas.push(f); });
      const lees = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
      let mis = 0, met = 0;
      for (const p of paginas) {
        const s = lees(p);
        let gebruikt = draagt.test(s);
        if (!gebruikt) {
          for (const m of s.matchAll(/<script[^>]*src="(\/[^"]+\.js)"/g)) {
            const f = path.join(PUB, m[1].slice(1));
            if (draagt.test(lees(f))) { gebruikt = true; break; }
            // een bundel: de delen staan in een map met dezelfde naam
            const delen = f.replace(/\.js$/, '');
            let namen = []; try { namen = fs.readdirSync(delen); } catch (e) { namen = []; }
            if (namen.some(n => n.endsWith('.js') && draagt.test(lees(path.join(delen, n))))) { gebruikt = true; break; }
          }
        }
        if (!gebruikt) continue;
        met++;
        /* Niet `s.includes(...)`: sinds het stijlblad via @import in rtg-ui.css
           hangt, staat de naam op geen van de 231 pagina's die hem wel laden.
           Die keten volgt ./lib/hulpcss.js, uit dezelfde bron als
           scripts/hulpklassen-omzet.js -- twee kopieen zouden uiteenlopen en
           dan ruilt de een iets in wat de ander afkeurt (regel 4). */
        if (!paginaDraagt(s, p, PUB)) {
          mis++;
          fout(web(p) + ' gebruikt een hulpklasse maar laadt rtg-hulpklassen.css niet');
        }
      }
      if (!mis) ok(met + ' pagina\'s gebruiken een hulpklasse, en alle ' + met + ' laden het blad (' + klassen.length + ' klassen)');
    }
  }
}

/* 38) camera en microfoon gaan door EEN deur, en elk kader geeft het recht door.

   WAAR DIT UIT KOMT. De klacht was "op mijn telefoon doet niks het" -- geen
   camera, geen microfoon, en nergens een melding. De oorzaak zit niet in de
   camera maar in het ADRES: buiten https (en localhost) bestaat
   navigator.mediaDevices niet. Alle zeventien losse getUserMedia-aanroepen
   liepen daar op een rauwe TypeError, en zeven ervan gaven `null` terug of
   lieten de fout lopen. Er gebeurde dus niets, zonder melding -- en op een
   laptop op localhost werkte het, want dat vindt de browser wel beveiligd.
   test/media.e2e.js meet dat op een echt LAN-adres.

   Daarom loopt alles nu via public/shared/media.js: die stelt de diagnose,
   noemt de oorzaak hardop op het moment van gebruik, en geeft nooit stil een
   null terug. Deze regel houdt drie dingen vast: de deur, het kaderrecht, en de
   pagina die de module ook echt binnenhaalt. Dat laatste is niet formeel --
   laadt een pagina media.js niet, dan is RTGMedia er niet en breekt elk scherm
   dat hem gebruikt.

   OVER HET KADERRECHT, EERLIJK. Bij het bouwen was de aanname dat een iframe
   allow="camera; microphone" nodig heeft en dat vijf van de zes kaders hier dus
   stil stuk waren. Die aanname is nagemeten en klopt NIET voor een same-origin
   kader: featurePolicy.allowsFeature('camera') is daar true zonder allow en de
   camera gaat gewoon open. Voor een kader naar een andere origin is het wel
   verplicht, en dit huis heeft die niet (frame-ancestors 'self'). Onderdeel
   38b repareert hier dus niets -- het houdt de bedoeling expliciet en op EEN
   plek. Dat het er staat is een keuze, geen bugfix, en zo hoort het te lezen. */
console.log('\n38) camera en microfoon: een deur, elk kader geeft het recht door');
{
  const PUB = path.join(ROOT, 'public');
  const web = (p) => '/' + path.relative(PUB, p).split(path.sep).join('/');
  const lees = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
  const DEUR = 'public/shared/media.js';
  if (!fs.existsSync(path.join(ROOT, DEUR))) {
    fout(DEUR + ' ontbreekt; dan is er geen deur en meet deze regel niets');
  } else {
    /* Bestanden: alles in public behalve de uitvoer (dist) en de deur zelf.
       Bundels tellen mee als bestand maar niet als bron -- regel 6 bewaakt dat
       een bundel gelijk is aan zijn delen, dus een fout daar staat al in de
       delen en dubbel melden helpt niemand. */
    const { bundels } = require('./bundel');
    const bundelPaden = new Set(Object.keys(bundels).map(k => '/' + k));
    const bronnen = [];
    loop(PUB, /\.(js|html)$/, f => {
      const p = web(f);
      /* De deur zelf telt niet als overtreder -- en dat is sinds hij een BUNDEL
         is niet meer een pad maar twee. shared/media.js ging over de 10 kB en is
         opgeknipt in shared/media/media-01.js (de diagnose en de teksten) en
         -02.js (de melding en de vraag). Voor de browser is dat nog steeds EEN
         bestand; voor deze regel waren het er ineens twee, en die tweede kwam
         als overtreder binnen omdat de enige echte getUserMedia-aanroep van dit
         huis daarin staat. Wat de deur is, is de MODULE -- niet het aantal
         bestanden waarin hij bewaard wordt. */
      if (p.startsWith('/dist/') || p === '/shared/media.js' || p.startsWith('/shared/media/')) return;
      bronnen.push(f);
    });

    // 38a) niemand anders raakt getUserMedia aan.
    let stiekem = 0;
    for (const f of bronnen) {
      if (bundelPaden.has(web(f))) continue;
      const s = zonderCommentaar(lees(f));
      if (!/\.getUserMedia\s*\(/.test(s)) continue;
      stiekem++;
      fout(web(f) + ' roept getUserMedia rechtstreeks aan; dat hoort via RTGMedia (shared/media.js)');
    }
    if (!stiekem) ok('geen enkel bestand buiten de mediapoort roept getUserMedia rechtstreeks aan');

    /* 38b) wie een iframe MAAKT, geeft het recht door. Alleen createElement en
       een <iframe> in een string tellen: een iframe in een stijlblad
       (`#split iframe{...}`) maakt niets. Een statisch <iframe>-element in de
       markup mag ook zijn eigen allow= dragen -- dat is dezelfde doorgifte,
       alleen met de hand.

       EN ER IS EEN OMGEKEERD BESLUIT, dat sinds de App Store bestaat. Een kader
       met een LEEG allow geeft bewust NIETS door: geen camera, geen microfoon.
       Dat is precies wat de cel van een app van derden nodig heeft -- die
       rechten heeft een lid nooit verleend en de machtigingencatalogus kent ze
       niet eens (APPSTORE.md, grens 1). Zo'n kader hier laten zakken zou de
       enige uitweg RTGMedia.kader() maken, en dat is de verkeerde: dan krijgt
       derdencode juist wel camera en microfoon.

       `maakt` telt in dat ene geval niet mee, en dat is geen slordigheid maar
       een grens van de heuristiek: in een .html-bestand is "een <iframe> in een
       string" niet te onderscheiden van gewone markup -- elk aanhalingsteken
       eerder op de pagina maakt hem waar. createElement telt wel: wie een kader
       BOUWT, zegt zelf wat het meekrijgt. Gemeten toen deze regel erbij kwam:
       in de hele public/ draagt precies een bestand een leeg allow. */
    let kaderloos = 0, kaders = 0, leegBesluit = 0;
    for (const f of bronnen) {
      if (bundelPaden.has(web(f))) continue;
      const s = zonderCommentaar(lees(f));
      const bouwt = /createElement\(\s*['"]iframe['"]\s*\)/.test(s);
      const maakt = bouwt || /['"`][^'"`]*<iframe\b/.test(s);
      const statisch = /^\s*<iframe\b/m.test(s) || />\s*<iframe\b/.test(s);
      if (!maakt && !statisch) continue;
      kaders++;
      if (/RTGMedia\.kader\s*\(/.test(s)) continue;
      // een statisch kader met eigen allow= is ook doorgifte
      if (statisch && !maakt && /<iframe\b[^>]*\ballow=/.test(s)) continue;
      // en een statisch kader met een LEEG allow is het omgekeerde besluit
      if (statisch && !bouwt && /<iframe\b[^>]*\ballow=""/.test(s)) { leegBesluit++; continue; }
      kaderloos++;
      fout(web(f) + ' maakt een iframe zonder RTGMedia.kader(); camera en microfoon vallen daarin stil weg');
    }
    if (!kaderloos) ok(kaders + ' plekken maken een kader; ' + (kaders - leegBesluit) + ' geven het recht door en ' +
      leegBesluit + ' geven bewust niets door (leeg allow)');

    /* 38c) een pagina die RTGMedia gebruikt, laadt shared/media.js ook. Net als
       regel 37: het gebruik kan in de pagina zelf staan of in een script (of
       bundeldeel) dat hij laadt.

       WAT DIT NIET ZIET: een module die met createElement('script') wordt
       binnengehaald. Op dit moment gebruikt geen van die modules (mond, sterren,
       glyf, handenvrij-bureau, palet, wauw) de mediapoort -- nagekeken -- maar
       als er ooit een bijkomt, valt hij hier niet op. */
    const gebruikt = (s) => /\bRTGMedia\b/.test(s);
    const paginas = [];
    loop(PUB, /\.html$/, f => { if (!web(f).startsWith('/dist/')) paginas.push(f); });
    let misDeur = 0, metDeur = 0;
    for (const p of paginas) {
      const s = lees(p);
      let raakt = gebruikt(zonderCommentaar(s));
      if (!raakt) {
        for (const m of s.matchAll(/<script[^>]*src="(\/[^"]+\.js)"/g)) {
          if (m[1] === '/shared/media.js') continue;
          const f = path.join(PUB, m[1].slice(1));
          if (gebruikt(zonderCommentaar(lees(f)))) { raakt = true; break; }
          const delen = f.replace(/\.js$/, '');
          let namen = []; try { namen = fs.readdirSync(delen); } catch (e) { namen = []; }
          if (namen.some(n => n.endsWith('.js') && gebruikt(zonderCommentaar(lees(path.join(delen, n)))))) { raakt = true; break; }
        }
      }
      if (!raakt) continue;
      metDeur++;
      if (!s.includes('/shared/media.js')) {
        misDeur++;
        fout(web(p) + ' gebruikt RTGMedia maar laadt /shared/media.js niet');
      } else if (!s.includes('/shared/media.css')) {
        misDeur++;
        fout(web(p) + ' laadt de mediapoort maar niet /shared/media.css; de melding staat er dan zonder vorm');
      }
    }
    if (!misDeur) ok(metDeur + ' pagina\'s gebruiken de mediapoort, en alle ' + metDeur + ' laden module en blad');
  }
}

/* 39) een routebestand pakt uit de kern wat het GEBRUIKT, en niets meer.

   DE GRENS DIE ER NIET WAS. server.js geeft elke router hetzelfde object `kern`
   met ruim driehonderd eigenschappen, en elke router pakt eruit wat hij wil. Er
   was dus geen grens -- maar dat was nog niet het ergste. De twaalf breedste
   routebestanden reikten alle twaalf naar 134-139 namen, en dat waren geen
   twaalf brede domeinen: het was EEN destructurering die twaalf keer was
   overgenomen. server/routes/supplier/kamers.js pakte honderdvierendertig namen,
   gebruikte er NUL van, en riep daarna twee submodules aan.

   Over server/routes samen: 3929 namen gepakt en nooit gebruikt, over 62
   bestanden. Zolang dat mag, zegt de kop van een bestand niets. Hij hoort de
   grens te ZIJN: dit heb ik nodig, de rest niet. Na het opruimen is
   supplier/toegang.js van 139 naar 24 namen gegaan, en nu is die kop een
   leesbare opsomming van wat dat bestand echt doet.

   HOE. Een naam heet gebruikt als hij buiten de destructurering nog ergens als
   los woord staat, niet direct achter een punt. De meting zit in
   scripts/grenzen.js en niet hier: dezelfde bron als de ratel-meter
   `kernOngebruikt` in NORM.json, want twee tellers voor een waarheid lopen
   uiteen (LAT.md regel 4).

   BEWUST RUIM, en die kant is de goede. Een naam die alleen in de tekst van een
   template-string voorkomt telt als gebruikt. Dat mist een geval; de andere kant
   -- iemand haalt een naam weg die wel gebruikt wordt -- levert een
   ReferenceError op die pas bij het eerste verzoek valt. */
console.log('\n39) een routebestand pakt uit de kern alleen wat het gebruikt');
{
  let grenzen = null;
  try { grenzen = require('./grenzen').meet(); }
  catch (e) { fout('de grenzen konden niet worden gemeten (' + e.message + '); dan stelt deze regel niets vast'); }
  if (grenzen) {
    const dood = grenzen.alleOngebruikt || [];
    if (!dood.length) {
      ok(grenzen.kernBreedte + ' kern-namen in gebruik, en geen enkel routebestand pakt er een die het niet gebruikt');
    } else {
      for (const d of dood.slice(0, 12)) {
        fout(d.bestand + ' pakt ' + d.aantal + ' van de ' + d.gepakt +
          ' namen uit kern zonder ze te gebruiken: ' + d.namen.slice(0, 6).join(', ') +
          (d.namen.length > 6 ? ', ...' : ''));
      }
      if (dood.length > 12) fout('... en nog ' + (dood.length - 12) + ' bestanden (zie node scripts/grenzen.js)');
    }
  }
}

/* 40 + 41) DE TWEE GEGENEREERDE KAARTEN LOPEN NIET ACHTER.

   WAAROM DIT ER IS. De derde kritiek op dit huis was de scherpste: de bus factor
   is een. Niemand houdt 1253 servermodules en 2384 endpoints in zijn hoofd, en de
   meetkast compenseert dat maar half -- die vertelt je of iets stuk is, niet waar
   de dingen staan of wat een toets bewijst. Daar zijn twee documenten voor:

     ARCHITECTUUR.md   de lagen, de domeinen, de gedeelde kern, waar de waarheid
                       staat (scripts/kaart.js)
     BEWIJS.md         per toetsbestand welke bewering, en of er een mutatie bij
                       is vastgelegd (scripts/bewijs.js)

   EN DE ENIGE REDEN DAT ZE IETS WAARD ZIJN, is dat ze niet kunnen verouderen. Een
   handgeschreven architectuurdocument is binnen twee maanden onwaar, en dan is
   het erger dan geen document: het stuurt iemand met vertrouwen de verkeerde kant
   op. Beide bestanden komen uit de code, en deze regels genereren ze opnieuw en
   vergelijken. Schuift de code, dan wordt de keuring rood tot iemand `npm run
   kaart` of `npm run bewijs` draait -- bijwerken is een commando geworden en geen
   schrijfwerk.

   Ze staan met opzet NIET in het gegenereerde bestand zelf te controleren (geen
   hash in een kop): dan zou iemand de hash kunnen bijwerken zonder de inhoud. De
   vergelijking is de volle tekst. */
console.log('\n40) ARCHITECTUUR.md loopt niet achter op de code');
{
  try {
    const kaart = require('./kaart');
    const opSchijf = fs.existsSync(kaart.DOEL) ? fs.readFileSync(kaart.DOEL, 'utf8') : null;
    const verwacht = kaart.bouw();
    if (opSchijf === null) fout('ARCHITECTUUR.md bestaat niet -- draai: npm run kaart');
    else if (opSchijf !== verwacht) fout('ARCHITECTUUR.md loopt achter op de code -- draai: npm run kaart');
    else ok('ARCHITECTUUR.md is gelijk aan wat de code nu zegt');
  } catch (e) {
    fout('de kaart kon niet worden gebouwd (' + e.message + '); dan stelt deze regel niets vast');
  }
}

/* 41b) HET BELOFTEREGISTER KLOPT.

   Deze regel bestaat door een fout die ik twee keer achter elkaar maakte. Op de
   vraag "wat is er nog niet" scande ik eerst alleen de bovenste maplaag en
   meldde ik RTG Sheets, Slides en Forms als ontbrekend -- ze stonden in
   public/apps/office/. Daarna meldde ik CRM en BI als ontbrekend, terwijl CRM
   als server/bedrijf/klant.js bestaat en de voorspellaag als server/kern/voorspel/.

   Twee keer fout op dezelfde vraag betekent niet dat er beter gezocht moet
   worden; het betekent dat er geen bron was om in te kijken. BELOFTE.json is die
   bron, en deze regel houdt hem eerlijk: elk bewijsstuk moet echt bestaan.

   DE GEVAARLIJKE STAND IS "GEBROKEN", niet "open". Een belofte die nog open
   staat, weet iedereen. Een belofte die ooit waar was en stil verdween, mist
   niemand -- en precies die vindt deze regel. Bij het schrijven van het register
   sloeg hij meteen drie keer aan: drie paden wezen naar modules die ergens
   anders bleken te wonen. */
console.log('\n41b) BELOFTE.md klopt en geen enkele belofte is stilletjes gebroken');
{
  try {
    const belofte = require('./belofte');
    const opSchijf = fs.existsSync(belofte.DOEL) ? fs.readFileSync(belofte.DOEL, 'utf8') : null;
    const verwacht = belofte.bouw();
    const { tel, rijen } = belofte.meet();
    if (opSchijf === null) fout('BELOFTE.md bestaat niet -- draai: node scripts/belofte.js');
    else if (opSchijf !== verwacht) fout('BELOFTE.md loopt achter op BELOFTE.json -- draai: node scripts/belofte.js');
    else if (tel.gebroken) {
      for (const r of rijen.filter(x => x.stand === 'gebroken'))
        fout('gebroken belofte "' + r.wat + '": ' + r.kwijt.join(', ') + ' bestaat niet (meer)');
    } else ok(tel.gedekt + ' beloften gedekt, ' + tel.open + ' open, geen enkele gebroken');
  } catch (e) {
    fout('het belofteregister kon niet worden gelezen (' + e.message + '); dan stelt deze regel niets vast');
  }
}

console.log('\n41) BEWIJS.md loopt niet achter op de toetsen');
{
  try {
    const bewijs = require('./bewijs');
    const opSchijf = fs.existsSync(bewijs.DOEL) ? fs.readFileSync(bewijs.DOEL, 'utf8') : null;
    const verwacht = bewijs.bouw();
    if (opSchijf === null) fout('BEWIJS.md bestaat niet -- draai: npm run bewijs');
    else if (opSchijf !== verwacht) fout('BEWIJS.md loopt achter op de toetsen -- draai: npm run bewijs');
    else ok('BEWIJS.md is gelijk aan wat de toetsen nu beweren');
  } catch (e) {
    fout('het bewijsregister kon niet worden gebouwd (' + e.message + '); dan stelt deze regel niets vast');
  }
}

/* 42) een naam die in EEN functie wordt verklaard, wordt niet buiten die functie
   aangeroepen.

   DE FOUT DIE DIT VANGT, en hij is hier echt gemaakt. De grote app-scripts staan
   opgeknipt in deelbestanden die bij de build weer aaneengeplakt worden
   (scripts/bundel.js). Zo'n knip mag midden in een functie liggen -- dat gebeurt
   ook, want sommige functies zijn groter dan een deelbestand. Maar dan ligt
   ALLES wat er in de volgende deelbestanden staat BINNEN die functie, en dat is
   zelden de bedoeling.

   Zo raakten de Vooruit-kaart en de postvoorstellen binnen renderFacturenLid()
   te liggen. Op het scherm gaf dat "renderVooruit is not defined" en dus een
   lege kaart, terwijl elke API-toets groen stond en `npm run check` niets zei.
   Regel 9 (de kruisscan) kon het niet zien: die zoekt kale verwijzingen naar
   TOP-LEVEL namen van een zuster, en deze namen stonden nergens op top-level.

   Wat deze regel doet is smal en precies: een functie die binnen een andere
   functie wordt verklaard, en waarvan de naam ERBUITEN wordt aangeroepen. Dat is
   altijd fout -- geen stijlkwestie, maar een ReferenceError die op een pad ligt
   dat niemand heeft gelopen.

   Wat hij NIET doet: klagen over een knip midden in een functie. Dat is een
   geldige manier om een groot bestand te delen, en er zijn er hier meer dan een. */
console.log('\n42) geen functie die binnen een andere functie staat en erbuiten wordt aangeroepen');
{
  const { loop: loopKnopen } = require('./ast/walk');
  const bundels = require('./bundel').bundels;
  let stuk = 0, gekeken = 0;
  for (const doel of Object.keys(bundels)) {
    const bron = path.join(ROOT, 'public', doel);
    let src; try { src = fs.readFileSync(bron, 'utf8'); } catch (e) { continue; }
    let ast; try { ast = ontleed(src); } catch (e) { fout(doel + ' ontleedt niet: ' + e.message); stuk++; continue; }
    gekeken++;
    /* De plek van een knoop is soms een GETAL en soms een token-object met zijn
       eigen start/end (zo werkt onze parser). Wie dat door elkaar haalt,
       vergelijkt objecten met `>=` -- dat levert geen fout op maar onzin, en dan
       meldt deze regel keurig vier problemen die er niet zijn. Dat gebeurde hier
       bij de eerste versie; bij de tweede zat het getal nog een laag dieper en
       zweeg de regel juist over een fout die er WEL was. Vandaar: doorpellen tot
       er een getal ligt, en anders niets beweren. */
    const plek = (v, sleutel) => {
      let x = v;
      for (let i = 0; i < 6 && x && typeof x === 'object'; i++) x = x[sleutel];
      return typeof x === 'number' ? x : null;
    };
    const van = (n) => plek(n.start, 'start');
    const tot = (n) => plek(n.end, 'end');

    /* EERST TELLEN HOE VAAK EEN NAAM ERGENS WORDT GEBONDEN -- als functie, als
       const/let/var, of als parameter. Een naam die meer dan een keer voorkomt
       slaan we over: welke binding een aanroep bedoelt, is dan niet uit te maken
       zonder echte scope-analyse, en een regel die gokt is erger dan een regel
       die zwijgt. Zonder deze telling meldde deze regel `stuur()` en `zet()` --
       namen die elders gewoon een const zijn. */
    const bindingen = new Map();
    const bind = (naam) => { if (naam) bindingen.set(naam, (bindingen.get(naam) || 0) + 1); };
    loopKnopen(ast, (n) => {
      if (n.type === 'FunctionDeclaration' && n.id) bind(n.id.name);
      else if (n.type === 'VariableDeclarator' && n.id && n.id.name) bind(n.id.name);
      else if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
        for (const p2 of (n.params || [])) if (p2 && p2.name) bind(p2.name);
      }
      if (n.type === 'FunctionDeclaration') for (const p2 of (n.params || [])) if (p2 && p2.name) bind(p2.name);
    });

    /* Elke functieverklaring die BINNEN een andere functie staat, met de grenzen
       van dat omhulsel erbij. */
    const binnenIn = new Map();   // naam -> { van, tot } van de OMHULLENDE functie
    loopKnopen(ast, (n, pad) => {
      if (n.type !== 'FunctionDeclaration' || !n.id) return;
      if ((bindingen.get(n.id.name) || 0) > 1) return;   // te dubbelzinnig, zie hierboven
      const ouders = pad.filter(x => /Function/.test(x.type));
      const omhulsel = ouders[ouders.length - 1];
      // ouders[0] is de IIFE zelf; alleen dieper dan dat telt als "binnen een functie"
      if (ouders.length >= 2 && omhulsel) binnenIn.set(n.id.name, { van: van(omhulsel), tot: tot(omhulsel) });
    });
    if (!binnenIn.size) continue;
    loopKnopen(ast, (n) => {
      if (n.type !== 'CallExpression' || !n.callee || n.callee.type !== 'Identifier') return;
      const g = binnenIn.get(n.callee.name);
      if (!g || typeof g.van !== 'number' || typeof g.tot !== 'number') return;
      const p = van(n);
      if (typeof p !== 'number') return;
      if (p >= g.van && p < g.tot) return;   // netjes binnen het omhulsel
      stuk++;
      fout(doel + ': ' + n.callee.name + '() wordt aangeroepen buiten de functie waarin hij verklaard staat' +
        ' -- op het scherm is dat een ReferenceError en een leeg vak');
    });
  }
  if (!stuk) ok(gekeken + ' gebundelde app-scripts: geen enkele functie wordt buiten zijn eigen omhulsel aangeroepen');
}

/* 43) in een gebundeld script staat geen losse tekstoptelling die nergens heen gaat.

   DE FOUT DIE DIT VANGT, en hij is hier echt gemaakt. De grote app-scripts staan
   opgeknipt per onderdeel en worden bij de build weer aaneengeplakt IN DE
   VOLGORDE VAN DE BESTANDSNAAM (readdirSync().sort()). Bij het opknippen van
   app-main-04 ontstond de reeks 04, 04a, 04ab, 04b -- terwijl de inhoud
   geschreven was voor 04, 04ab, 04a, 04b. Alfabetisch komt "04a" voor "04ab",
   dus het brok kwam achter de regel `document.head.appendChild(st);` terecht.

   Wat er dan gebeurt is het vervelendste soort stuk: de stijlregels stonden nog
   letterlijk in het bestand, maar als LOSSE expressie na het afsluitende `;`.
   JavaScript telt die tekst netjes bij elkaar op en gooit hem weg. Geen
   syntaxfout, geen consolemelding, geen enkele toets die zakt -- en op het
   scherm waren de halo achter de klok, de schaal van de klok en de uitlijning
   van de zin gewoon verdwenen. Ik heb het zelf een screenshot lang aangezien
   voor "de sterren zijn wat druk".

   controleer() in bundel.js kan dit per definitie NIET zien: die vergelijkt de
   bundel met de som van dezelfde delen in dezelfde volgorde, en is dus altijd
   consistent met zichzelf. Consistent is niet hetzelfde als goed.

   De regel is smal gehouden: alleen een expressie-statement dat NIETS anders is
   dan tekst met plussen ertussen. Zo'n statement heeft geen enkel effect en is
   dus altijd fout. Een optelling met een aanroep of een variabele erin kan wel
   effect hebben en blijft buiten schot. */
console.log('\n43) geen weggegooide tekstoptelling in een gebundeld script');
{
  const { loop: loopKnopen } = require('./ast/walk');
  const bundels = require('./bundel').bundels;
  let stuk = 0, gekeken = 0;
  /* Zit er ergens in deze +-keten een stuk tekst? Niet "bestaat hij UITSLUITEND
     uit tekst" -- dat was mijn eerste versie, en die liet de echte fout er
     doorheen. Een losgeraakt brok eindigt namelijk op een `+`, dus hij plakt
     zich vast aan wat er in het VOLGENDE deelbestand staat. Hier was dat een
     aanroep van (function sterrenhemel(){...})(), en daarmee was de keten niet
     meer alleen tekst en zweeg de regel over precies het geval waarvoor hij
     geschreven was. Gemeten met de mutatie, niet aangenomen. */
  const tekstErin = (n) => {
    if (!n || typeof n !== 'object') return false;
    if (n.type === 'Literal') return typeof n.raw === 'string' && /^['"`]/.test(n.raw.trim());
    if (n.type === 'BinaryExpression' && n.operator === '+') return tekstErin(n.left) || tekstErin(n.right);
    return false;
  };
  for (const doel of Object.keys(bundels)) {
    const bron = path.join(ROOT, 'public', doel);
    let src; try { src = fs.readFileSync(bron, 'utf8'); } catch (e) { continue; }
    let ast; try { ast = ontleed(src); } catch (e) { continue; }   // regel 42 meldt dat al
    gekeken++;
    loopKnopen(ast, (n) => {
      if (n.type !== 'ExpressionStatement') return;
      const e = n.expression;
      /* Een KALE tekst is een directive ('use strict') en telt niet mee; het
         gaat om de OPTELLING, want dat is de vorm die een losgeraakt brok
         aanneemt. */
      if (!e || e.type !== 'BinaryExpression' || e.operator !== '+') return;
      if (!tekstErin(e)) return;
      stuk++;
      fout(doel + ' regel ' + (e.lijn || '?') + ': een optelling met tekst erin die nergens aan ' +
        'toegekend wordt -- dit brok is bij het aaneenplakken losgeraakt en doet niets meer');
    });
  }
  if (!stuk) ok(gekeken + ' gebundelde app-scripts: elk tekstbrok komt ergens aan');
}

/* 44) een app staat in precies EEN wereld op het beginscherm.

   DE FOUT DIE DIT VANGT: twee plekken voor hetzelfde is precies waarom je iets
   nergens meer vindt. Een lid dat Vluchten een keer onder Reizen zag staan,
   zoekt hem daar -- en als hij ook onder Leven hangt, is de vraag "waar stond
   dat ook alweer" terug, wat het hele acht-werelden-besluit juist moest
   oplossen (PLATFORM.md par. 0).

   WAAROM HIER EN NIET IN DE SCHERMTOETS. Dit stond in test/appmenu.e2e.js, en
   die telde de tegels door elke map open te klikken. Sinds een wereldtegel de
   APP opent en niet een tegelveld, is die lijst uit het scherm verdwenen. De
   regel is niet vervallen; hij heeft een andere plek nodig, en de bron is de
   juiste: MAPPEN zelf.

   EN NIET MEER MET EEN REGEX OP EEN SNEDE. Deze regel las app-main-24a2.js met
   een regex, en toen dat bestand over de 10 KB ging (regel 13) en FoundationOS
   naar een eigen snede verhuisde, zei hij "MAPPEN staat er niet meer" -- terwijl
   MAPPEN gewoon bestond en over twee snedes liep. Een meter die zakt op de
   INDELING van de bron in plaats van op de bron, meet de verkeerde dingen. Hij
   leest nu dezelfde lezer als de toets en de wereldlijst
   (scripts/lib/wereldregister.js), die de bundel eerst aaneenplakt.

   Wat deze regel NIET doet: iets zeggen over welke wereld de juiste is. Dat is
   een ontwerpvraag. Hij zegt alleen dat het er precies een is. */
console.log('\n44) elke app staat in precies een wereld op het beginscherm');
{
  let items = [], werelden = 0;
  try {
    const reg = require('./lib/wereldregister');
    werelden = reg.MAPPEN.length;
    for (const m of reg.MAPPEN) for (const it of (m.items || [])) items.push(it);
  } catch (e) { fout('MAPPEN is niet uit de app-main-bundel te lezen: ' + e.message); }
  const gezien = new Set();
  const dubbel = [];
  for (const it of items) {
    if (gezien.has(it)) { if (!dubbel.includes(it)) dubbel.push(it); }
    else gezien.add(it);
  }
  if (!items.length) fout('geen enkel item gevonden in MAPPEN -- de regel leest de verkeerde vorm');
  else if (dubbel.length) fout('deze apps staan in meer dan een wereld: ' + dubbel.join(', '));
  else ok(items.length + ' items over ' + werelden + ' werelden: geen enkele staat er twee keer in');
}

/* 45) ELK ROUTEPAD STAAT VOLUIT.

   Waarom dit een eigen regel is, en geen smaak. scripts/schakelbaar.js telt
   welke routes vanuit de boardroom te schakelen zijn door de bron af te lezen
   op letterlijke paden. Wie zijn pad met een plus bouwt --
   `app.post('/api/geld/' + pad, ...)` in een lus -- is voor die census
   ONZICHTBAAR. En onzichtbaar is hier erger dan ongedekt: een ongedekte route
   staat in de zakkerlijst, een onzichtbare route bestaat niet en niemand mist
   hem. Hij is er gewoon, altijd, voor iedereen, en geen knop in de boardroom
   raakt hem.

   Dat is hier echt gebeurd, met acht geldroutes en twee levensroutes tegelijk.
   Het viel pas op doordat de twee LOSSE routes in dezelfde bestanden wel
   zichtbaar waren en als ongedekt gemeld werden; waren die er niet geweest,
   dan had niets geklaagd. Een meter met een blinde vlek is geen meter, dus
   staat de vorm die meetbaar is nu vast (LAT.md regel 3).

   Wat wel mag: een pad met een express-parameter (:id) of een regexp. Die
   staan nog steeds voluit als tekst en zijn dus gewoon te tellen. */
console.log('\n45) elk routepad staat voluit, zodat de schakelkast ze kan tellen');
{
  const lees = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
  const bouwers = [];
  let bekeken = 0;
  loop(path.join(ROOT, 'server'), /\.js$/, (f) => {
    const s = zonderCommentaar(lees(f));
    if (!/app\.(get|post|put|delete|patch|all)\s*\(/.test(s)) return;
    bekeken++;
    /* een routeaanroep waarvan het eerste argument met een string BEGINT en
       daarna doorloopt met een plus: dat is precies de vorm die de census
       niet ziet */
    for (const m of s.matchAll(/app\.(?:get|post|put|delete|patch|all)\s*\(\s*'([^']*)'\s*\+/g)) {
      bouwers.push(path.relative(ROOT, f) + ": '" + m[1] + "' + ...");
    }
    // en de vorm zonder enige letterlijke tekst: app.post(pad, ...)
    for (const m of s.matchAll(/app\.(?:get|post|put|delete|patch|all)\s*\(\s*([A-Za-z_$][\w$]*)\s*,/g)) {
      bouwers.push(path.relative(ROOT, f) + ': app.post(' + m[1] + ', ...)');
    }
  });
  /* DE SCHULD DIE ER AL LAG, met naam en toenaam. Deze regel vond negentien
     bestanden die hun paden opbouwen -- niet als besluit maar door optelling,
     precies zoals scripts/schakelbaar.js het beschrijft voor de catalogus.
     Ze in een keer openbreken is een aparte klus met een eigen risico; ze
     stilzwijgend doorlaten is hoe de vlek is ontstaan.

     Dus staat de lijst hier, en hij mag ALLEEN KRIMPEN. Een nieuw bestand dat
     paden opbouwt zakt meteen; een bestand dat wordt opgeruimd hoort van deze
     lijst af (de regel zegt zelf wanneer dat kan). Zelfde afspraak als de
     BUITEN-lijst in schakelbaar.js, met een belangrijk verschil dat er ook bij
     hoort te staan: die lijst bevat KEUZES, deze bevat SCHULD. */
  const BEKEND = new Set([
    /* Nog EEN over: de poortwachterslaag zelf. Die monteert hele
       routefamilies achter een deur en bouwt daarbij een voorvoegsel op; dat
       is een ander geval dan een lijst acties, en het hoort bij een aparte
       ronde met de poortwachters zelf ernaast. Van negentien naar een. */
    'server/opzet/poortwachters.js',
    /* De Game Hall registreert zijn acties uit EEN tabel (plus ./spellen-rondom);
       bij de samenvoeging is die tabel gehouden boven de uitgeschreven vorm van
       de consolidatietak, omdat hij meer acties draagt (tempo, projectie, de
       rondom-lijst). Voluit uitschrijven is een aparte klus; tot die tijd staat
       de schuld hier met naam. */
    'server/routes/spellen.js'
  ]);
  const nieuwe = bouwers.filter(b => !BEKEND.has(b.split(':')[0]));
  const schoongemaakt = [...BEKEND].filter(f => !bouwers.some(b => b.split(':')[0] === f));

  if (!bekeken) fout('geen enkel bestand met routes gevonden; deze regel meet dan niets');
  else if (nieuwe.length) {
    for (const b of nieuwe) fout('NIEUW routepad wordt opgebouwd en is onzichtbaar voor de schakelkast -- ' + b);
  } else if (schoongemaakt.length) {
    /* Geen fout maar een opdracht: wie een bestand opruimt, haalt hem ook van
       de lijst. Anders slijt de lijst tot een verzameling namen die niets meer
       zegt, en dan is de ratel geen ratel meer. */
    fout('deze bestanden bouwen geen paden meer op; haal ze uit BEKEND in deze regel: ' + schoongemaakt.join(', '));
  } else ok(bekeken + ' bestanden met routes; geen nieuwe opbouwers, ' + BEKEND.size + ' bekende resteren');
}

/* 46) DE SLO-TABEL IN SLO.md IS EEN AFDRUK VAN SLO.json.

   Sinds er een meter is die de servicedoelen leest (server/kern/command/slo.js)
   staan ze in SLO.json. De tabel in SLO.md stond er los naast, en dat is de
   toestand waar LAT.md regel 4 over gaat: twee plaatsen met dezelfde waarheid
   lopen uit elkaar, en dan is het document dat een MENS leest het verkeerde van
   de twee. Bijstellen van een streefwaarde zonder de tabel bij te werken is
   precies hoe dat gebeurt, en het valt nergens op.

   Zelfde vorm als regel 40 en 41: de bouw wordt herhaald en de volle tekst
   vergeleken, geen hash in de kop -- want een hash kan iemand bijwerken zonder
   de inhoud. */
console.log('\n46) de SLO-tabel in SLO.md is een afdruk van SLO.json');
{
  try {
    const slo = require('./slo');
    const opSchijf = fs.existsSync(slo.DOEL) ? fs.readFileSync(slo.DOEL, 'utf8') : null;
    if (opSchijf === null) fout('SLO.md bestaat niet, terwijl SLO.json de norm draagt');
    else if (slo.bouw(opSchijf) !== opSchijf) fout('SLO.md loopt achter op SLO.json -- draai: npm run slo');
    else {
      const norm = JSON.parse(fs.readFileSync(slo.BRON, 'utf8'));
      ok(norm.doelen.length + ' servicedoelen en ' + (norm.reizen || []).length +
        ' sondereizen staan in SLO.json, en SLO.md is daar gelijk aan');
    }
  } catch (e) {
    fout('de SLO-norm kon niet worden gelezen (' + e.message + '); dan stelt deze regel niets vast');
  }
}

/* ============================================================================
   47) saveDuurzaam() wordt alleen aangeroepen waar het MOET

   WAAROM DIT EEN HARDE POORT IS EN GEEN AFSPRAAK. db.saveDuurzaam() schrijft
   synchroon met een fsync eronder en keert pas terug als de opslag het heeft
   bevestigd. Dat kost latentie, en dat is de hele reden dat hij bestaat -- voor
   geld, waar bevestigen vóór duurzaamheid een belofte is die de opslag nog niet
   heeft gedaan (zie GELDLAT.md).

   Precies daarom is hij gevaarlijk als hij rondslingert. Iemand leest hem als
   "de veilige save", zet hem onder een profielwijziging, en het prestatieprofiel
   van het platform is veranderd zonder dat er ooit een beslissing over is
   genomen. Een afspraak in een document houdt dat niet tegen; deze regel wel.

   Elke regel in TOEGESTAAN noemt zijn reden. Staat er geen reden bij, dan hoort
   hij er niet -- dezelfde vorm als PUBLIEK in de poortwacht en MAG in de
   klokschuld.

   DRIE DEUREN, EN DE REGEL BEWAAKTE ER EERST MAAR EEN. Hij zocht op de NAAM
   saveDuurzaam, en niemand roept die naam aan: de weg erheen is
   `bijeen(fn, { duurzaam: true })`, en sinds notities is er ook de gedeelde
   helper server/lib/duurzaam.js. Wie een route duurzaam maakte, kwam er dus
   ongezien langs -- een poort die precies de gebruikte ingang niet bewaakte, en
   dat is de stilste vorm die er is. Hij kijkt nu naar het BEREIK: de naam, de
   vlag die een bundel duurzaam maakt, en de helper die beide verpakt. */
console.log('\n47) saveDuurzaam() staat alleen waar duurzaamheid vóór bevestiging moet');
{
  const TOEGESTAAN = new Map([
    ['server/db/duurzaam.js', 'hier WOONT de primitive sinds db/index.js is opgeknipt'],
    ['server/db/bijeen.js', 'de bundel met de duurzaam-vlag is de enige indirecte weg erheen'],
    ['server/db/index.js', 'draagt de vlag van de aanroeper door naar de bundel; kiest zelf niets'],
    ['scripts/check.js', 'deze regel zelf noemt zijn naam'],
    ['test/saveduurzaam.test.js', 'de toets die bewijst dat hij bevestigt'],
    ['test/notitiesduurzaam.test.js', 'de toets die bewijst dat het bord niet bevestigt zonder opslag'],
    ['scripts/duurzaamheidskosten.js', 'merkt per route of hij duurzaam is; meet de prijs, zet niets aan'],
    ['server/lib/verraad.js', 'de catalogus benoemt de plek waar sterf-na-commit zit; geen aanroep'],
    ['server/lib/idem.js', 'draagt de vlag door van de aanroeper naar de bundel; kiest zelf niets'],
    ['server/lib/duurzaam.js', 'hier woont de gedeelde vastleg-helper voor werk van een lid'],
    ['server/kern/pay/index.js', 'geld: bevestigen vóór duurzaamheid is een belofte die de opslag nog niet deed'],
    ['server/kern/notities.js', 'werk van een lid: een bevestigde notitie mag niet verdwijnen bij een opslagfout'],
    ['server/kern/agenda.js', 'werk van een lid: een afspraak die je hebt gezet, hoort er na een herstart te staan'],
    ['server/kern/agenda-pro.js', 'schrijft in dezelfde agenda en doet dus dezelfde belofte'],
    ['server/kern/bestanden.js', 'werk van een lid: de bytes staan al duurzaam, de verwijzing ernaartoe nu ook'],
    ['server/kern/berichten/index.js', 'werk van een lid: een weggezet gesprek hoort niet terug te komen'],
    ['server/kern/vergeten.js', 'AVG-wissing: verwijderd mag pas worden bevestigd nadat de opslag het vastlegt']
  ]);
  /* Het BEREIK van de primitive: de naam zelf, de vlag waarmee een bundel
     duurzaam wordt, en de gedeelde helper. Zonder die laatste twee bewaakt deze
     regel alleen zichzelf.

     EN HIJ KIJKT NAAR CODE, NIET NAAR PROZA. Hier stond de rauwe bron, dus een
     bestand dat saveDuurzaam alleen NOEMT -- in een kop die uitlegt waarom het
     hier juist niet gebeurt -- kwam als overtreder binnen en moest met een
     reden op de lijst. Zo'n regel is erger dan geen: hij zet een naam op de
     lijst van plekken die aan de duurzame commit komen terwijl daar geen enkele
     aanroep staat, en dan leest de lijst als dekking die er niet is.

     Betrapt bij het knippen van server/db/index.js: drie nieuwe deelbestanden
     werden gemeld, en een ervan (afsluiten.js) raakt de commit nergens aan --
     het woord stond in een zin over waar hij NIET hoort. Strings blijven wel
     staan: server/lib/verraad.js noemt de plek in zijn catalogus als tekst, en
     dat is een verwijzing die iets doet.

     TWEE REGELS VIELEN DAARMEE VAN DE LIJST, en dat zegt iets over wat deze
     regel wel en niet ziet. test/duurzaamheidskosten.test.js kwam er alleen op
     door zijn eigen uitleg; die raakt de commit nergens aan.
     server/kern/bestanden-delen.js WEL -- maar via een `vastleggen` die
     server/kern/bestanden.js hem aanreikt, en die naam staat in 111 bestanden
     van dit huis. Hem aan het bereik toevoegen zou de lijst met honderd namen
     vullen en daarmee waardeloos maken.

     WAT DEZE REGEL DUS NIET DEKT, en dat hoort hier te staan: een module die de
     helper KRIJGT AANGEREIKT. Dat is te verdedigen en niet toevallig -- deze
     regel bewaakt wie BESLUIT om duurzaam te schrijven, en dat besluit valt
     waar lib/duurzaam wordt gemaakt (bestanden.js, dus op de lijst). Een module
     die alleen gebruikt wat hij krijgt, kan dat besluit niet nemen. Maar wie
     vanuit een toegestaan bestand de helper aan een nieuwe module doorgeeft,
     komt hier ongezien langs. Dat is mensenwerk, geen poort. */
  const BEREIK = /saveDuurzaam|duurzaam\s*:\s*true|lib\/duurzaam/;
  const overtreders = [];
  let gezien = 0;
  const kijk = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) {
        if (/^(node_modules|\.git|data|dist)$/.test(naam)) continue;
        kijk(p); continue;
      }
      if (!naam.endsWith('.js')) continue;
      let bron; try { bron = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
      if (bron.includes('\u0000')) continue;
      if (!BEREIK.test(zonderCommentaar(bron))) continue;
      gezien++;
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      if (!TOEGESTAAN.has(rel)) overtreders.push(rel);
    }
  };
  for (const map of ['server', 'scripts', 'test']) {
    const m = path.join(ROOT, map);
    if (fs.existsSync(m)) kijk(m);
  }
  /* EEN LIJST DIE NAAR EEN VERDWENEN BESTAND WIJST, BEWAAKT DAAR NIETS MEER.
     Zonder deze controle blijft een regel staan nadat het bestand is hernoemd,
     en leest de lijst als dekking die er niet is. */
  const spoken = [...TOEGESTAAN.keys()].filter(r => !fs.existsSync(path.join(ROOT, r)));
  if (overtreders.length) {
    fout('de duurzame commit wordt bereikt op een plek die er niet op de lijst staat: ' + overtreders.join(', ') +
      ' -- zet hem in TOEGESTAAN (met reden) of gebruik de gewone save()');
  } else if (spoken.length) {
    fout('de lijst noemt bestanden die niet meer bestaan: ' + spoken.join(', ') +
      ' -- haal ze eruit, anders belooft de lijst dekking die er niet is');
  } else {
    ok(gezien + ' bestanden komen aan de duurzame commit (naam of bundelvlag), allemaal met een reden op de lijst');
  }
}

/* ============================================================================
   48) BEWIJSGROEN EN GO-LIVE-GROEN KUNNEN ELKAAR NIET GROEN PRATEN

   LAT.md regel 11. Twee soorten groen die niets met elkaar te maken hebben:
   bewijsgroen zegt dat iemand heeft gekeken, go-live-groen zegt dat dit huis de
   deur open mag. Je kunt honderd procent bewijsdekking hebben en juridisch nog
   steeds niet mogen lanceren -- en andersom.

   Deze regel houdt de twee kanten STRUCTUREEL uit elkaar, want een afspraak
   houdt dit niet tegen. Zodra de go-live-keuring een bewijsregister zou lezen,
   kan een verdubbelde matrix een ontbrekende secrets manager wegdrukken, en dat
   is precies de fout die niemand terugvindt. Andersom net zo: een
   bewijsinstrument dat "klaar voor productie" roept, spreekt over iets waar hij
   niets van weet.

   Wat hij NIET kan: de mens tegenhouden die de twee naast elkaar legt en
   optelt. Daarvoor staat regel 11 in LAT.md. */
console.log('\n48) bewijsgroen en go-live-groen blijven uit elkaar');
{
  const REGISTERS = ['BEWIJSMATRIX.json', 'CONTROLS.json', 'ROLPROEF.json', 'KETENS.json',
    'STAATPROEF.json', 'INVOERPROEF.json', 'IDEMPROEF.json', 'POORTWACHT.json',
    'DUURZAAMHEIDSKOSTEN.json', 'VERRAAD.json', 'SCHERMLEUGEN.json'];
  const BEWIJSSCRIPTS = ['scripts/bewijsmatrix.js', 'scripts/controls.js', 'scripts/rolproef-route.js',
    'scripts/invoerproef-route.js', 'scripts/idemproef-route.js', 'scripts/staatproef-route.js',
    'scripts/ketenronde.js', 'scripts/duurzaamheidskosten.js'];
  const GOLIVE_SCRIPTS = ['scripts/golive.js', 'scripts/papierwerk.js'];
  const klachten = [];

  // 1) de go-live-keuring leest geen enkel bewijsregister
  for (const rel of GOLIVE_SCRIPTS) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) continue;
    const bron = fs.readFileSync(f, 'utf8');
    for (const reg of REGISTERS) if (bron.includes(reg)) klachten.push(rel + ' leest ' + reg);
  }

  // 2) een bewijsinstrument velt geen go-live-oordeel
  const OORDEEL = /klaar voor (de )?productie|mag live|kan live|go-?live-?groen|golive\(/i;
  for (const rel of BEWIJSSCRIPTS) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) continue;
    for (const regel of fs.readFileSync(f, 'utf8').split('\n')) {
      if (OORDEEL.test(regel)) klachten.push(rel + ': ' + regel.trim().slice(0, 70));
    }
  }

  if (klachten.length) {
    fout('bewijs en go-live raken elkaar: ' + klachten.join(' | ') +
      ' -- LAT.md regel 11: bewijsgroen is geen go-live-groen');
  } else {
    ok(REGISTERS.length + ' bewijsregisters en ' + BEWIJSSCRIPTS.length + ' bewijsinstrumenten: ' +
      'de go-live-keuring leest er geen, en ze vellen geen go-live-oordeel');
  }
}

/* ============================================================================
   49) ELK MEDIA-ELEMENT DRAAGT EEN BESLUIT OVER ONDERTITELING, MET EEN REDEN

   WAAROM DIT GEEN "ELKE <video> EEN <track>"-POORT IS. Die poort is in vijf
   minuten geschreven en zou hier meteen twintig keer onterecht afgaan. Van de
   negenentwintig media-elementen in dit huis is de meerderheid geen INHOUD maar
   een INSTRUMENT: de camera die een paspoort leest, de QR-scanner van de
   RTG-code, het oog dat een werkvloer schouwt, het onzichtbare element dat een
   affiche uit het eerste frame haalt, en je eigen beeld in de hoek van een
   gesprek. Daar valt niets te ondertitelen -- er is geen geluid en er wordt niets
   gezegd. Een poort die daar toch een <track> eist levert twintig loze alarmen
   op, en na drie loze alarmen zet iemand de poort uit. Dat is exact het patroon
   van de vals-alarmronde in scripts/lib/rolproef.js.

   DUS EEN REGISTER, ZOALS PUBLIEK IN REGEL 28. Elk element staat hieronder bij
   naam, met een soort en een reden. Komt er een element bij, dan zakt deze regel
   tot iemand het besluit opschrijft. Dat is het doel: niet dat er overal
   ondertitels zijn, maar dat over elk element iemand heeft nagedacht, en dat je
   kunt nalezen wie en waarom.

   HET REGISTER LIEGT DE GATEN NIET WEG. Acht van de negenentwintig staan als
   OPEN, en dat is de eerlijke stand en geen slordigheid:

     live gesprek (6)    Een <track> kan niet bestaan voor beeld dat nu ontstaat.
                         Wat een dove deelnemer hier nodig heeft is live tekst
                         (spraak-naar-tekst tijdens het gesprek), en die bestaat
                         in dit huis niet. WCAG 1.2.2 gaat hier niet over; 1.2.4
                         wel, en die is niet gehaald.
     live uitzending (2) Zelfde verhaal, eenrichting: het Podium en het SOS-beeld
                         naar het kantoor.
     opgenomen (0)       Dit waren er drie. Het Theater en de filmspeler van de
                         Media OS hadden geen veld voor ondertitels in het model;
                         dat veld is er nu (kern/ondertitels.js, dezelfde bron als
                         de clip-kant), met een route, een vel waar de maker ze
                         intypt en een gedeelde band die ze toont. De derde, een
                         spraakbericht in de teamchat, bleek dood hout: het veld
                         `m.audio` wordt nergens geschreven. Weggehaald.

   WAT HIJ MACHINAAL NAKIJKT, want een register met alleen woorden erin is een
   document en geen poort:

     stil    Een spiegel of werktuig MOET stil staan: `muted` in de tag, of
             `muted = true` in de regels eronder. Zonder die eis schuift zo'n
             element ongemerkt van "geen geluid" naar "geluid dat niemand
             ondertitelt", en dan klopt de reden hier niet meer. Dit is de tand
             met de meeste bijt: hij gaat af op een wijziging van EEN attribuut.
     anker   Wie "dit is geregeld" zegt, noemt WAAR: een bestand en een naam die
             daar moet staan. Haalt iemand de ondertitelband uit de clipdeler,
             dan zakt deze regel -- ook al is aan het scherm zelf niets veranderd.
     ratel   Het aantal open punten mag alleen omlaag. Wie een twaalfde open
             element toevoegt, lost eerst een ander op of verhoogt OPEN_MAX met
             opzet en met een reden.

   DE SLEUTEL IS bestand#id. Elementen zonder id krijgen een rangnummer in dat
   bestand (#1, #2), en elementen die in JS worden gemaakt een #js1, #js2. Zo'n
   rangnummer schuift als iemand er een element boven zet, en dan meldt deze regel
   een onbekend element plus een spookregel. Dat is geen ruis maar het gewenste
   gedrag: er is iets bijgekomen en er is nog geen besluit over.

   WAT HIJ NIET ZIET, en dat hoort erbij te staan: een element waarvan de
   tagnaam uit een variabele komt (createElement(soort)). Die vorm komt hier
   vandaag niet voor; komt hij er ooit, dan glipt hij langs deze regel. De drie
   vormen die hij WEL ziet zijn de tag in markup of in een string, een
   createElement met een letterlijke naam, en new Audio().

   GEBUNDELDE BESTANDEN DOEN NIET MEE (public/apps/personeel.js en broers): de
   bron staat in de losse delen ernaast, en anders staat elk element hier twee
   keer -- dezelfde afspraak als regel 13 en 19. */
console.log('\n49) elk media-element draagt een besluit over ondertiteling');
{
  /* De soorten. `open` betekent: hier hoort iets en het is er niet. `stil` en
     `anker` zijn de twee dingen die machinaal na te kijken zijn. */
  const SOORTEN = {
    spiegel:     { open: false, stil: true },   // je eigen beeld, zichtbaar, zonder geluid
    werktuig:    { open: false, stil: true },   // beeld als invoer of rekenmiddel
    ondertiteld: { open: false, anker: true },  // opgenomen inhoud MET een weg naar tekst
    gesprek:     { open: true, baan: true },    // live, tweerichting -- MOET een tekstbaan dragen
    uitzending:  { open: true },                // live, eenrichting
    onbedekt:    { open: true }                 // opgenomen inhoud ZONDER weg naar tekst
  };
  /* De ratel. Gemeten op 17 augustus 2026: eerst 11 open van 30, toen 9 nadat het
     Theater een ondertitelspoor kreeg (kern/ondertitels.js, gedeeld met de
     clip-kant), en nu 8 van 29 -- het spraakbericht in de teamchat bleek DOOD
     HOUT. De speler stond in personeel-23.js achter `m.audio`, en niets in dit
     huis schrijft dat veld ooit: /api/supplier/team/message neemt alleen `text`
     aan, en geen enkele aanroeper stuurt iets anders. Het was dus geen
     ondertitelgat maar een knop voor een functie die niet bestaat, en die is
     weggehaald in plaats van beschreven. Mag alleen omlaag. */
  const OPEN_MAX = 8;
  /* De band woonde als private functie IN de clipdeler; sinds het Theater en de
     Media OS dezelfde cue-lijst tonen staat hij als gedeelde laag in
     shared/ondertitelband.js. Deze regel merkte die verhuizing zelf op: het
     oude anker (toonOndertitels in clipdeler-01.js) viel weg en twee elementen
     zakten. Dat is precies waar een anker voor is. */
  const CLIPBAND = ['public/shared/ondertitelband.js', 'RTGOndertitelband'];
  const REGISTER = new Map([
    ['public/apps/app.html#csRemote', ['gesprek', 'het beeld en geluid van de ander in een videogesprek tussen twee leden', ['public/apps/app-main.js', 'RTGMeelezen']]],
    ['public/apps/app.html#csLocal', ['spiegel', 'je eigen beeld in de hoek van dat gesprek; stil, want jezelf terughoren is een echo']],
    ['public/apps/backoffice.html#ontLiveVid', ['uitzending', 'SOS: het kantoor kijkt live mee met de camera van een lid, met geluid erbij. GEEN tekstbaan, en dat is de eerlijke stand: wie doof is kan geen SOS-dienst draaien. Een noodscherm is niet de plek om er een even bij te zetten -- dat is een besluit, zie TOEGANKELIJK.md']],
    ['public/apps/camera.html#beeld', ['spiegel', 'de camera-app: je eigen beeld om een foto te maken, zonder geluid']],
    ['public/apps/clips.html#studioDoek', ['spiegel', 'het opnamedoek van de clipstudio: je eigen beeld voordat de opname loopt']],
    ['public/apps/clips.html#js1', ['ondertiteld', 'de clip in de feed; de gedeelde clipdeler zet de ondertitelband van de maker eroverheen', CLIPBAND]],
    ['public/apps/clips.html#js2', ['werktuig', 'een onzichtbaar element dat het eerste frame als affiche uitleest']],
    ['public/apps/foundation/gezin-rt/gezin-rt-03.js#grt-remote', ['gesprek', 'het gezinsgesprek van RTFoundation: het beeld van de ander', ['public/apps/foundation/gezin-rt.js', 'RTGMeelezen']]],
    ['public/apps/foundation/gezin-rt/gezin-rt-03.js#grt-local', ['spiegel', 'je eigen beeld in dat gezinsgesprek']],
    ['public/apps/foundation/vrienden.html#belRemote', ['gesprek', 'bellen met een vriend: het beeld van de ander', ['public/apps/foundation/vrienden.html', 'RTGMeelezen']]],
    ['public/apps/foundation/vrienden.html#belLocal', ['spiegel', 'je eigen beeld tijdens dat bellen']],
    ['public/apps/geld/rtgcodeb.js#rcCam', ['werktuig', 'de camera leest een RTG-code; shared/media.js vraagt bij een camera nooit geluid']],
    ['public/apps/media.html#film', ['ondertiteld', 'een opgenomen film uit het Theater; de kaart uit kern/mediaos draagt de cue-lijst mee en de gedeelde band toont hem', ['server/kern/mediaos/catalogus.js', 'ondertitels']]],
    ['public/apps/media.html#clipfilm', ['ondertiteld', 'een clip speelt hier via dezelfde clipdeler, met dezelfde ondertitelband', CLIPBAND]],
    ['public/apps/meet/kamer.js#1', ['gesprek', 'de vergaderkamer: een tegel per deelnemer, en de eigen tegel krijgt muted', ['public/apps/meet/kamer.js', 'RTGMeelezen']]],
    ['public/apps/memo/app.js#1', ['ondertiteld', 'een eigen spraakmemo; het toestel maakt er een transcript bij dat in de lijst staat en samen te vatten is', ['public/apps/memo/app.js', 'transcript']]],
    ['public/apps/oog.html#cam', ['werktuig', 'het oog schouwt een voertuig of werkvloer: beeldanalyse, geen geluid']],
    ['public/apps/podium.html#kijkVideo', ['uitzending', 'een live uitzending van het Podium; srcObject is er altijd een stroom, nooit een bestand. Er loopt WEL een tekstbaan mee: de kanaalchat (#chatKijk, aria-live), waarin de uitzender kan meeschrijven -- geen ondertiteling, wel een weg naar tekst', ['public/apps/podium.html', 'chatKijk']]],
    ['public/apps/podium.html#studioVideo', ['spiegel', 'het eigen beeld van de uitzender, voor en tijdens het uitzenden']],
    ['public/apps/scanner.html#beeld', ['werktuig', 'de documentscanner leest papier: beeld als invoer']],
    ['public/apps/theater.html#doekVideo', ['ondertiteld', 'de bioscoop van het Theater: de maker schrijft de ondertitels bij zijn eigen video, en de kijker krijgt ze mee met de zaal', ['server/kern/theater/video.js', 'videoOndertitels']]],
    ['public/apps/theater.html#vVoorbeeld', ['spiegel', 'de voorvertoning van je eigen upload, stil, voordat je hem publiceert']],
    ['public/apps/theater.html#js1', ['werktuig', 'een onzichtbaar element dat het eerste frame als affiche uitleest']],
    ['public/shared/paspoortscan.js#pscanVid', ['werktuig', 'de paspoortscan leest de MRZ-regels van een document']],
    ['public/shared/scanknop.js#js1', ['werktuig', 'de gedeelde scanknop: hetzelfde leesinstrument, in een eigen venster']],
    ['public/shared/scanner.js#js1', ['werktuig', 'het reserve-element van de scanner zelf, als de aanroeper er geen meegeeft']],
    ['public/shared/schoolbel.js#sbelAudio', ['gesprek', 'het schoolgesprek is een live audiogesprek: wie opneemt hoort de ander rechtstreeks', ['public/shared/schoolbel.js', 'RTGMeelezen']]],
    ['public/shared/teamcall/teamcall-01.js#1', ['spiegel', 'de teamcall van het personeel: je eigen tegel, stil, want je eigen stem terughoren is een echo']],
    ['public/shared/teamcall/teamcall-01.js#2', ['gesprek', 'de teamcall van het personeel: de tegel van een collega, met diens stem erbij', ['public/shared/teamcall/teamcall-01.js', 'RTGMeelezen']]]
  ]);

  const bundelPaden = new Set(Object.keys(BUNDELLIJST).map(k => 'public/' + k));
  const gevonden = new Map();
  loop(path.join(ROOT, 'public'), /\.(html|js)$/, (f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (bundelPaden.has(rel)) return;
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    let m, n = 0, jsN = 0;
    const tag = /<(video|audio)(\s[^>]*)?>/gi;
    while ((m = tag.exec(bron))) {
      n++;
      const id = (String(m[2] || '').match(/\bid=["']?([A-Za-z0-9_-]+)/) || [])[1];
      gevonden.set(rel + '#' + (id || n), { stil: /\bmuted\b/.test(m[0]) });
    }
    /* In JS gemaakte elementen. `muted` staat daar niet in de tag maar in de
       regels eronder, dus kijken we in een venster van 300 tekens erna. */
    const inJs = /(?:createElement\(\s*["'](video|audio)["']\s*\)|new\s+Audio\s*\()/g;
    while ((m = inJs.exec(bron))) {
      jsN++;
      const venster = bron.slice(m.index, m.index + 300);
      gevonden.set(rel + '#js' + jsN, { stil: /\bmuted\b/.test(venster) });
    }
  });

  const klachten = [];
  for (const [sleutel, el] of gevonden) {
    const post = REGISTER.get(sleutel);
    if (!post) {
      klachten.push(sleutel + ' is een media-element zonder besluit -- zet hem in REGISTER met een soort en een reden (check.js regel 49)');
      continue;
    }
    const soort = SOORTEN[post[0]];
    if (!soort) { klachten.push(sleutel + ' staat als soort "' + post[0] + '", en die soort bestaat niet'); continue; }
    if (!post[1] || post[1].length < 25) klachten.push(sleutel + ' heeft geen reden die iets zegt');
    if (soort.stil && !el.stil) {
      klachten.push(sleutel + ' staat als ' + post[0] + ' (stil) maar is niet meer muted -- of er komt geluid uit, of de reden klopt niet meer');
    }
    if (soort.anker || soort.baan) {
      /* Twee ankers met dezelfde tand. Bij ONDERTITELD wijst hij naar de band
         die de cues toont; bij een GESPREK naar de tekstbaan waarin deelnemers
         meeschrijven (shared/meelezen.js). In allebei de gevallen geldt: wie
         zegt dat er een weg naar tekst is, noemt WAAR -- en haalt iemand die
         weg, dan zakt deze regel ook al is aan het scherm zelf niets veranderd. */
      const wat = soort.baan ? 'draagt een tekstbaan' : 'staat als ondertiteld';
      const [bestand, naam] = post[2] || [];
      if (!bestand || !naam) klachten.push(sleutel + ' ' + wat + ' maar noemt niet waar dat geregeld is');
      else if (!fs.existsSync(path.join(ROOT, bestand))) klachten.push(sleutel + ': het anker ' + bestand + ' bestaat niet meer');
      else if (!fs.readFileSync(path.join(ROOT, bestand), 'utf8').includes(naam)) {
        klachten.push(sleutel + ': ' + bestand + ' draagt "' + naam + '" niet meer -- de weg naar tekst is eruit gehaald');
      }
    }
  }
  /* Een register dat namen bevat die niet meer bestaan, groeit stil vol en leest
     als dekking die er niet is -- dezelfde controle als bij regel 28 en 47. */
  for (const sleutel of REGISTER.keys()) {
    if (!gevonden.has(sleutel)) klachten.push('check.js regel 49: ' + sleutel + ' staat in het register maar bestaat niet (meer) als media-element');
  }

  const open = [...gevonden.keys()].filter(k => REGISTER.has(k) && (SOORTEN[REGISTER.get(k)[0]] || {}).open);
  if (open.length > OPEN_MAX) {
    klachten.push(open.length + ' open media-elementen terwijl OPEN_MAX op ' + OPEN_MAX + ' staat: ' + open.join(', '));
  }

  if (klachten.length) klachten.forEach(fout);
  else {
    const per = {};
    for (const k of gevonden.keys()) { const s = REGISTER.get(k)[0]; per[s] = (per[s] || 0) + 1; }
    const noem = (lijst) => lijst.filter(s => per[s]).map(s => per[s] + ' ' + s).join(', ');
    /* De open elementen tellen mee als open, ook als ze een tekstbaan dragen.
       Dat is geen slordigheid maar het punt: meelezen is GEEN ondertiteling --
       er wordt niets van spraak naar tekst omgezet, en WCAG 1.2.4 is dus niet
       gehaald. Het getal zou stil dalen als we ze hier zouden wegstrepen, en dan
       leest dit register als dekking die er niet is. Wat er WEL is, telt apart. */
    const metBaan = [...gevonden.keys()].filter(k => REGISTER.has(k) &&
      ((SOORTEN[REGISTER.get(k)[0]] || {}).baan || ((SOORTEN[REGISTER.get(k)[0]] || {}).open && (REGISTER.get(k)[2] || []).length)));
    ok(gevonden.size + ' media-elementen, elk met een besluit en een reden: ' +
      (gevonden.size - open.length) + ' geregeld (' + noem(['spiegel', 'werktuig', 'ondertiteld']) + '), ' +
      open.length + ' open (' + noem(['gesprek', 'uitzending', 'onbedekt']) + '), ratel op ' + OPEN_MAX +
      '\n  ' + metBaan.length + ' van die ' + open.length + ' dragen een TEKSTBAAN waarin deelnemers meeschrijven ' +
      '(geen ondertiteling: WCAG 1.2.4 blijft open)');
  }
}

/* DE ZAAI-HASH BLIJFT BIJ DE SEED.

   kluis.zaaiHash rekent een testwachtwoord eenmalig uit en deelt dus het zout
   tussen alle accounts met datzelfde wachtwoord. Voor een wachtwoord dat als
   letterlijke tekst in deze repo staat kost dat niets; voor een echt wachtwoord
   -- of voor de viercijferige PIN die langs createStaffSync loopt wanneer een
   bedrijfsaanmelding wordt goedgekeurd -- zou het de tabel in groepjes verdelen.

   De functie weigert daarom al buiten Magnaat Test. Deze regel is de tweede
   grendel: hij houdt de AANROEP bij de vijf plekken waar de seed staat, zodat
   een route die morgen "even snel" een account aanmaakt er niet bij kan zonder
   dat iemand het ziet. test/zaaihash.test.js bewaakt dat deze regel blijft. */
{
  const zaaiWoorden = /\b(zaaiHash|createUserZaai|createStaffZaai|setPasswordZaai)\b/;
  const mag = new Set([
    'server/accounts/kluis.js',        // waar hij woont
    'server/accounts/users.js',        // de twee ledenvarianten
    'server/accounts/staff.js',        // de personeelsvariant
    'server/server.js',                // de eigenaar, het testpersoneel en Nora
    'server/kern/staffseed-papieren.js' // de papieren van datzelfde personeel
  ]);
  const buiten = [];
  for (const map of ['server', 'scripts']) {
    loop(path.join(ROOT, map), /\.js$/, (f) => {
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      // de keuring zelf noemt de namen nu eenmaal; anders wijst hij naar zichzelf
      if (mag.has(rel) || rel === 'scripts/check.js') return;
      if (zaaiWoorden.test(zonderCommentaar(fs.readFileSync(f, 'utf8')))) buiten.push(rel);
    });
  }
  if (buiten.length) {
    fout('de zaai-hash wordt aangeroepen buiten de seed: ' + buiten.join(', ') +
      ' -- gebruik hashPassword of hashPasswordSync, of zet de plek bewust in de lijst in scripts/check.js');
  } else {
    ok('de zaai-hash (gedeeld zout) blijft bij de ' + mag.size + ' seed-bestanden');
  }
}


console.log('\n50) een geheim wordt tijd-veilig vergeleken, en een credential komt uit crypto');
{
  /* TWEE FOUTEN DIE HIER ECHT ZIJN GEMAAKT, EN DIE ALLEBEI EEN TWEEDE WAARHEID
     WAREN IN PLAATS VAN EEN ONTBREKENDE.

     A) De eenmalige manager-PIN van een nieuwe zaak kwam uit
        `Math.floor(1000 + Math.random() * 9000)`. Math.random is geen
        cryptografische bron: uit een handvol uitkomsten is de staat van de
        generator af te leiden en daarmee de VOLGENDE pin. Er bestond al een
        huisfunctie (accounts.makePin -> crypto.randomInt); deze plek had er
        stil een tweede naast gezet.

     B) verifyToken vergeleek de HMAC van het SESSIETOKEN met `!==`. Een gewone
        stringvergelijking stopt bij het eerste verschillende teken, dus de tijd
        verraadt hoeveel tekens er klopten. Exact deze redenering stond al
        uitgeschreven bij de clustersleutel in server.js -- en uitgerekend de
        deur waar ELK verzoek langskomt stond nog op de kale vergelijking.

     Waarom dit een keuring is en geen toets: geen van beide is met een
     gedragstoets eerlijk te betrappen. Een timingverschil van microseconden is
     op een testmachine niet betrouwbaar te meten, en een PIN uit Math.random
     ziet er precies zo uit als een goede. Ze zijn alleen in de BRON te zien, en
     dus hoort de bewaker daar te staan (LAT.md regel 2: beide zijn met een
     mutatie nagetrokken -- de fout teruggezet, deze regel werd rood, en toen
     pas terug). */
  const stripRegels = (b) => String(b)
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

  /* A) Math.random op een regel die een geheim maakt.
     Bewust NAUW: 'code' en 'id' staan er niet bij. Een leverancierscode of een
     gespreks-id is geen credential, en een regel die ook die aanwijst wordt
     binnen een week weggeklikt -- dat is precies hoe scripts/samenhang.js zijn
     eerste maatstaf verloor (849 valse gevallen). Liever een smalle regel die
     altijd klopt dan een brede die niemand meer gelooft. */
  const CREDENTIAL = /\b(pin|pincode|otp|token|secret|geheim|sleutel|wachtwoord|password|salt|nonce|apikey|herstelcode|verificatiecode|resetcode)\b/i;
  /* B) een handtekening die met == of != wordt vergeleken. `handtekening(` staat
     er NIET in: dat is Nederlands proza ("er ontbreken 2 handtekening(en)") en
     geen cryptografie. Alleen echte crypto-aanroepen tellen. */
  const HANDTEKENING = /\b(kluis\.sign|\bsign)\s*\(|createHmac\s*\(|\.digest\s*\(/;
  const VERGELIJK = /[!=]==?/;
  const VEILIG = /veiligGelijk|timingSafeEqual/;
  const VENSTER = 2;   // regels boven en onder waarin de veilige vergelijker mag staan

  let losA = 0, losB = 0, gekeurd = 0;
  loop(path.join(ROOT, 'server'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const regels = stripRegels(fs.readFileSync(f, 'utf8')).split('\n');
    regels.forEach((r, i) => {
      if (/Math\.random\s*\(/.test(r) && CREDENTIAL.test(r)) {
        losA++;
        fout(rel + ':' + (i + 1) + ' maakt een geheim met Math.random() -- gebruik crypto' +
          ' (crypto.randomInt/randomBytes, of de bestaande accounts.makePin)');
      }
      if (!HANDTEKENING.test(r) || !VERGELIJK.test(r)) return;
      gekeurd++;
      if (VEILIG.test(regels.slice(Math.max(0, i - VENSTER), i + VENSTER + 1).join('\n'))) return;
      losB++;
      fout(rel + ':' + (i + 1) + ' vergelijkt een handtekening met == of != -- dat stopt bij het' +
        ' eerste verschillende teken en lekt daarmee hoeveel er klopte; gebruik veiligGelijk()');
    });
  });
  if (!losA && !losB) ok('geen enkel geheim uit Math.random(), en alle ' + gekeurd +
    ' handtekeningvergelijkingen gaan tijd-veilig');
}
/* ============================================================================
   51) geen enkel bestand plukt een naam uit een bereik dat het niet heeft

   WAAR DIT UIT KOMT. Een groot bestand opknippen ziet er onschuldig uit: de
   regels verhuizen en de code is woord voor woord dezelfde. Maar een blok dat in
   zijn oude bestand een naam uit het OMRINGENDE bereik plukte, vindt die na de
   knip niet meer -- en JavaScript zegt dat pas als de regel echt draait.

   Op 19 augustus 2026 ging dat op EEN dag vijf keer mis, en alle vijf stil:

     werkplek-bureaus-b.js  `kies` en `BUREAUS` bleven achter. /api/werkplek/
       bureaus gooide een ReferenceError, die de try/catch eromheen omzette in
       een 500 met "Er ging iets mis". Voor elk huis kapot, twee dagen lang.
     rtmail-lid.js          `klokNu` bleef achter; de tak die hem gebruikt werd
       door geen enkele toets aangeraakt.
     leverancierpoort.js    `grootSupplierSync`, plus een require-pad dat vanuit
       een map dieper niet meer klopte.
     x509-pakket.js         `genKeyPair`; maakCSR() zonder eigen sleutel liep
       erop vast. Deze stond er al vanaf een eerdere ronde.
     imap-server.js         `poort`, `host` en `tlsOpties` werden nergens uit de
       opties gehaald, dus IMAP kon uberhaupt niet starten.
     schrift.js             de context heet `octx`, maar de AI-buddy las `ctx`.

   Wat geen van zes betrapte: `node --check` (het is geldige syntaxis),
   scripts/routekaart.js (die START de server, hij doet geen verzoek) en de
   keuring (die leest tekst). Vandaar deze regel.

   HIJ IS MET OPZET VOORZICHTIG. scripts/lib/vrijenamen.js telt een naam als
   gebonden zodra het bestand hem ERGENS bindt, hoe diep dan ook -- een echte
   scope-analyse zou ook betrappen dat de binding in een ANDER bereik staat,
   maar elke fout daarin is een vals alarm op een regel die verder klopt. In een
   harde poort is een vals alarm duurder dan een gemist geval. De nul hieronder
   is dus geen garantie; hij is de ondergrens. */
console.log('\n51) geen enkel bestand plukt een naam uit een bereik dat het niet heeft');
{
  const { vrijeNamen } = require('./lib/vrijenamen');
  let gekeken = 0, stuk = 0;
  const kapot = [];
  /* ALLEEN server/ EN scripts/, en public/ met opzet niet. Daar is een vrije
     naam juist de NORMALE vorm: de browser deelt EEN bereik over alle
     script-tags van een pagina heen, dus shared/uitvoer.js zet RTGUitvoer op
     window en apps/agenda/app.js leest hem. Die bestanden hier meenemen zou
     honderden meldingen geven op code die precies doet wat ze hoort te doen --
     en een regel die honderd keer onterecht rood staat, leert niemand meer
     iets. Wat public/ WEL bewaakt staat in regel 19 (geen twee modules die
     dezelfde window-naam opeisen) en regel 42. */
  /* EN test/ ERBIJ, sinds 21 augustus 2026. Die map stond hier niet, en dat
     kostte een nacht: de samenvoeging van 24 takken liet `bankDeur` achter in
     drie toetsbestanden die hem niet hadden (hij woonde in apps-ui.e2e.js),
     plus `pw` en `fs` in twee andere. Node deelt geen bereik tussen
     toetsbestanden, dus dat is een ReferenceError -- maar pas op de tak van de
     toets die hem raakt, en dus pas in CI, na twee uur suite. Deze analyser had
     ze alle drie gevonden; hij keek alleen de andere kant op. Nagetrokken op de
     stand van vóór de reparatie: werkscherm, zegel-ui en pinherstel melden
     bankDeur, vakbewijs-scherm meldt pw.

     Wat daarvoor wel moest: de BROWSERKANT overslaan. Een schermtoets geeft een
     functie mee aan de pagina (page.evaluate, waitForFunction), en die draait in
     Chromium waar window.Geo gewoon bestaat. Zonder die uitzondering meldt deze
     regel elke browsernaam als vrij. Zie BROWSERHAAK in lib/vrijenamen.js. */
  for (const map of ['server', 'scripts', 'test']) {
    const m = path.join(ROOT, map);
    if (!fs.existsSync(m)) continue;
    loop(m, /\.js$/, (f) => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      if (rel.includes('/data/')) return;
      let bron; try { bron = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
      gekeken++;
      const r = vrijeNamen(bron);
      /* Een bestand dat de eigen parser niet leest, is geen bevinding van DEZE
         regel -- regel 5 (de AST-scan) gaat daarover. Stil overslaan zou het
         cijfer hieronder wel mooier maken, dus het wordt geteld en genoemd. */
      if (r.fout) { stuk++; return; }
      if (r.namen.length) kapot.push(rel + ' -> ' + r.namen.join(', '));
    });
  }
  if (kapot.length) {
    for (const k of kapot.slice(0, 12)) {
      fout('gebruikt een naam die dit bestand nergens heeft: ' + k +
        ' -- geef hem mee als parameter, of haal hem zelf op met require()');
    }
    if (kapot.length > 12) fout('... en nog ' + (kapot.length - 12) + ' bestanden');
  } else {
    ok(gekeken + ' bestanden nagelopen, geen enkele vrije naam' +
      (stuk ? ' (' + stuk + ' niet te lezen voor de eigen parser; zie regel 5)' : ''));
  }
}

/* ============================================================================
   51) EEN AFDRUK LOOPT NIET ACHTER OP DE METING ERONDER.

   DE FOUT DIE DIT VANGT is hier gemaakt en kostte een volle bouwronde van
   tachtig minuten. Er kwamen vijf modules onder server/kern bij, en
   OBJECTMODEL.json -- de afdruk van scripts/objectmodel.js -- stond nog op 1498
   bestanden terwijl de meting er 1503 telde. Er was niets kapot: de UITKOMST van
   de meting (de envelop, de gedeelde velden, de gelijkende vormparen) was byte
   voor byte gelijk. Alleen het getal liep achter, en dat is precies de scheur
   waardoor een afdruk een verhaal wordt.

   WAAROM HIER EN NIET ALLEEN IN DE SUITE. Vier afdrukken stonden al in deze
   keuring -- regel 40 (ARCHITECTUUR.md), 41 (BEWIJS.md), 41b (BELOFTE.md) en 46
   (SLO.md) -- en twee niet: OBJECTMODEL.json en BUNDELS.md werden alleen door
   hun eigen toets bewaakt. Die toetsen zijn goed, maar ze draaien in een suite
   van tachtig minuten, dus je hoort het pas ver na de commit van de bouwstraat
   in plaats van in de halve seconde die het kost. Dat is geen andere norm maar
   een andere PLEK, en de plek was hier de fout. De toetsen blijven staan: deze
   regel is de vroege waarschuwing, niet de vervanging.

   WAT HIER MET OPZET NIET IN STAAT. Een meter die een deel van zijn invoer
   overslaat zonder het te zeggen, zegt niet "in orde" maar "ik heb niet
   gekeken" (regel 10 van LAT.md), dus staat het hier:

     GRENZEN.json  is GEEN afdruk. scripts/grenslijst.js noemt hem zelf "een
                   vertrekpunt en geen waarheid": vier plekken rekenen hun
                   kernnaam uit, de scanner ziet die niet, en ze komen MET DE
                   HAND op de lijst zodra de grens knelt. Een gelijkheidstoets
                   zou eisen dat die aanvullingen weer verdwijnen -- dus die komt
                   er niet.
     LEUGENS.json  is het rapport van EEN ronde, draagt een tijdstempel en staat
                   niet in de repo. Er is niets om achter te lopen.
   ========================================================================== */
console.log('\n51) elke afdruk is gelijk aan de meting eronder');
{
  /* BUNDELS.md is tekst en wordt in zijn geheel vergeleken -- dezelfde
     vergelijking als test/deelindex.test.js maakt. */
  try {
    const deel = require('./deelindex');
    const opSchijf = fs.existsSync(deel.DOEL) ? fs.readFileSync(deel.DOEL, 'utf8') : null;
    if (opSchijf === null) fout('BUNDELS.md bestaat niet -- draai: npm run deelindex');
    else if (opSchijf !== deel.bouw()) fout('BUNDELS.md loopt achter op de bundeldelen -- draai: npm run deelindex');
    else ok('BUNDELS.md is gelijk aan wat de bundeldelen nu zeggen');
  } catch (e) {
    fout('de deelindex kon niet worden gebouwd (' + e.message + '); dan stelt deze regel niets vast');
  }

  /* OBJECTMODEL.json draagt de DATUM waarop hij is vastgelegd, en die hoort te
     verschillen zodra iemand hem opnieuw schrijft; die en de vaste uitleg gaan
     er dus af. Wat overblijft is ALLES wat gemeten is, en dat is ruimer dan
     test/objectmodel.test.js vergelijkt: die kijkt naar `gemeten` en `envelop`,
     en laat `gedeeld` en `paren` staan. Juist die twee dragen de conclusie van
     DEVELOPERCLOUD.md par. 2 -- welke velden vier of meer domeinen delen, en
     welke vormparen echt op elkaar lijken. Nagemeten: een afgekapte `paren` en
     `gedeeld` laat die toets groen en deze regel rood.

     De melding NOEMT WAT ER VERSCHILT en niet alleen dat er iets verschilt. Een
     keuring die "loopt achter" zegt over een afdruk met tien blokken, stuurt je
     zelf op zoek; dat is precies het half uur dat deze regel hoort te schelen. */
  /* TWEE AFDRUKKEN, EEN VERGELIJKING. COMMERCE.json (scripts/commerce.js) draagt
     precies dezelfde vorm als OBJECTMODEL.json -- een `uitleg`, een `vastgelegd`
     en daaronder blokken waarvan er een `gemeten` heet -- en hoort dus langs
     dezelfde controle. Die controle twee keer uitschrijven is de fout waar
     LAT-regel 4 over gaat, en hier met een scherp randje: de vereniging van
     beide sleutelverzamelingen hieronder is zelf een reparatie van een eerdere
     ronde, en een kopie zou die reparatie precies EEN keer dragen. */
  const afdrukGelijk = ({ bestand, meter, vast, zeg }) => {
    try {
      const doel = path.join(ROOT, bestand);
      const opSchijf = fs.existsSync(doel) ? JSON.parse(fs.readFileSync(doel, 'utf8')) : null;
      const vers = meter();
      if (opSchijf === null) { fout(bestand + ' bestaat niet -- draai: ' + vast); return; }
      /* De datum en de vaste uitleg horen NIET tot de meting; al het andere wel,
         ook een blok dat er morgen bij komt. Vandaar de vereniging van beide
         sleutelverzamelingen: een blok dat wel op schijf staat en niet meer in de
         meting is net zo goed achterstand. */
      const blokken = [...new Set([...Object.keys(opSchijf), ...Object.keys(vers)])]
        .filter(k => k !== 'uitleg' && k !== 'vastgelegd');
      const anders = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
      const verschil = [];
      for (const k of blokken) {
        if (!anders(opSchijf[k], vers[k])) continue;
        if (k !== 'gemeten') { verschil.push(k + ' wijkt af'); continue; }
        /* Ook hier de VERENIGING van beide sleutelverzamelingen, en niet
           alleen die van de verse meting. Anders zou een afdruk met een getal
           dat de meting niet meer kent hierboven wel "wijkt af" heten en
           hieronder geen enkel verschil opleveren -- en dan meldt de regel
           doodleuk dat alles in orde is. */
        const was = opSchijf.gemeten || {};
        for (const m of new Set([...Object.keys(was), ...Object.keys(vers.gemeten || {})])) {
          if (was[m] !== (vers.gemeten || {})[m]) verschil.push('gemeten.' + m + ': ' + was[m] + ' -> ' + (vers.gemeten || {})[m]);
        }
      }
      if (verschil.length) fout(bestand + ' loopt achter op de meting (' + verschil.join('; ') + ') -- draai: ' + vast);
      else ok(zeg(vers));
    } catch (e) {
      fout(bestand + ' kon niet worden gemeten (' + e.message + '); dan stelt deze regel niets vast');
    }
  };

  afdrukGelijk({
    bestand: 'OBJECTMODEL.json', meter: () => require('./objectmodel').meet(),
    vast: 'npm run objectmodel:vast',
    zeg: (v) => v.gemeten.vormen + ' bewaarde vormen in ' + v.gemeten.bestanden +
      ' bestanden, en OBJECTMODEL.json is daar in elk blok gelijk aan'
  });
  afdrukGelijk({
    bestand: 'COMMERCE.json', meter: () => require('./commerce').meet(),
    vast: 'npm run commerce:vast',
    zeg: (v) => v.gemeten.koopbareVormen + ' koopbare vormen in ' + v.gemeten.koopbareDomeinen +
      ' domeinen, ' + v.gemeten.werkwoordenVolledig + ' domeinen met alle acht werkwoorden, en COMMERCE.json is daar in elk blok gelijk aan'
  });
}


/* 53) DE WERELDLIJST LOOPT NIET ACHTER OP HET REGISTER.

   Zelfde vorm als regel 40 (de kaart) en 46 (de SLO-tabel): WERELDLIJST.md wordt
   uit `MAPPEN` gegenereerd, dus hoort hij gelijk te zijn aan wat de code nu
   zegt. Verhuist er een onderdeel naar een andere wereld, dan wordt deze regel
   rood tot iemand `npm run wereldlijst` draait -- en dat is een commando, geen
   schrijfwerk.

   Waarom dit ernaast moet en test/wereldregister.test.js niet volstaat: die
   toets meet dat elk item ergens OP UITKOMT. Hij zegt niets over de vraag of het
   document dat mensen lezen nog dezelfde inhoud beschrijft. */
console.log('\n53) WERELDLIJST.md loopt niet achter op het wereldregister');
{
  try {
    const wl = require('./wereldlijst');
    const opSchijf = fs.existsSync(wl.DOEL) ? fs.readFileSync(wl.DOEL, 'utf8') : null;
    const verwacht = wl.bouw();
    if (opSchijf === null) fout('WERELDLIJST.md bestaat niet -- draai: npm run wereldlijst');
    else if (opSchijf !== verwacht) fout('WERELDLIJST.md loopt achter op de code -- draai: npm run wereldlijst');
    else ok('WERELDLIJST.md is gelijk aan wat MAPPEN nu zegt');
  } catch (e) {
    fout('de wereldlijst kon niet worden gebouwd (' + e.message + '); dan stelt deze regel niets vast');
  }
}

/* 53) ELK SCHERM IS ERGENS VANDAAN TE BEREIKEN.

   Een scherm dat bestaat, door de a11y-keuring gaat, in de schermdekking
   meetelt en waar geen enkele weg heen loopt, is geen scherm maar een bestand.
   Dat is de stilste soort dode code: alle meters staan groen.

   Gevonden op 19 augustus 2026, en het leverde er elf op. Twee daarvan waren
   vitrines uit de tijd dat er nog een marketinglaag was (het skelethorloge en
   een skyline van het ecosysteem) -- die stonden in geen enkel document en zijn
   weg. Twee andere waren juist WEL gedocumenteerd en gebouwd: /apps/werk.html
   staat in PLATFORM.md als "voor organisaties" en /apps/wereld.html in README.md
   als de wereldlaag. Die hadden geen deur en hangen nu in hun wereld.

   DE LIJST HIERONDER IS GEEN UITZONDERINGSLIJST MAAR EEN BESLUIT PER REGEL. Wie
   er een bij zet, schrijft op waarom een scherm nergens vandaan bereikbaar HOORT
   te zijn -- en dat is bij een omleiding of een QR-landing een goed antwoord, en
   bij al het andere geen.

   De meting staat in scripts/lib/bereik.js; daar staat ook wat hij niet ziet
   (een adres dat een script uit stukjes samenstelt), dus dit is een ondergrens. */
console.log('\n53) elk scherm is vanaf de bank te bereiken');
{
  try {
    const { meet, MAG_LOS } = require('./lib/bereik');
    const r = meet();
    const onbekend = r.wezen.filter((p) => !MAG_LOS.has(p));
    const verdwenen = [...MAG_LOS.keys()].filter((p) => !r.wezen.includes(p));
    if (onbekend.length) {
      for (const p of onbekend) fout('nergens vandaan te bereiken: ' + p + ' -- hang hem ergens, of zet hem met een reden in MAG_LOS');
    } else if (verdwenen.length) {
      /* Een naam op de lijst die niet meer los staat, groeit stil mee -- zelfde
         controle als bij regel 28, 47 en 49. */
      for (const p of verdwenen) fout('staat in MAG_LOS maar is wel bereikbaar (of bestaat niet meer): ' + p);
    } else {
      ok(r.totaal + ' schermen, ' + r.wezen.length + ' met opzet los: ' +
        r.wezen.map((p) => p.replace('/apps/', '')).join(', '));
    }
  } catch (e) {
    fout('de bereikbaarheid kon niet worden gemeten (' + e.message + '); dan stelt deze regel niets vast');
  }
}


/* ============================================================================
   54) DE RELEASE-WORKFLOW PUBLICEERT NIETS ZONDER STUKLIJST EN HERKOMST

   WAT HIER ACHTER ZIT. Het releasebewijs (scripts/release-bewijs.js) hasht elke
   bron in dit huis, en dat bewijs zit ook in het image. Maar een image is meer
   dan deze repository: uit node:22-slim komen ruim honderd deb-pakketten mee die
   wij niet schrijven en niet kiezen. Op de vraag "zit die kwetsbaarheid in wat
   jullie draaien?" gaf een bronhash geen antwoord, en die vraag komt bij elke
   doorlichting langs. scripts/imageherkomst.js maakt daarom een stuklijst UIT het
   gepubliceerde image en bindt die met een handtekening aan het image-digest.

   WAAROM DAT HIER EEN POORT NODIG HEEFT. Die stappen staan in een
   workflow-bestand, en workflow-bestanden zijn de makkelijkste plek om iets uit
   te zetten: een stap uitcommentarieren is een regel, en de publicatie gaat
   daarna gewoon door. Groen, sneller, en niemand die het ziet -- tot een
   inkoper om de stuklijst vraagt. Deze regel maakt van dat weglaten een rood
   vinkje.

   DE VOLGORDE DOET ERTOE, en dat is geen vormkwestie. Een stuklijst die VOOR de
   publicatie wordt gemaakt beschrijft een image dat misschien niet is wat er
   uiteindelijk gepusht is. Daarom eist deze regel dat --sbom NA de push staat.

   WAT HIJ NIET KAN. Of de handtekening ooit gezet is, weet dit bestand niet:
   dat hangt aan een secret in GitHub. Wel kan hij eisen dat de publieke sleutel,
   als hij er staat, een echte Ed25519-sleutel is -- een verminkte plak tekst in
   deploy/release-sleutel.pub zou anders pas opvallen op het moment dat iemand
   een release probeert te verifieren. */
console.log('\n54) de release-workflow publiceert niets zonder stuklijst en herkomst');
{
  const wfPad = path.join(ROOT, '.github/workflows/release-image.yml');
  if (!fs.existsSync(wfPad)) fout('.github/workflows/release-image.yml bestaat niet meer');
  else if (!fs.existsSync(path.join(ROOT, 'scripts/imageherkomst.js'))) fout('scripts/imageherkomst.js is weg, terwijl de workflow hem aanroept');
  else {
    const wf = fs.readFileSync(wfPad, 'utf8');
    const na = (naald) => wf.indexOf(naald);
    const push = na('docker push');
    const sbom = na('imageherkomst.js --sbom');
    const binden = na('imageherkomst.js --binden');
    const controle = na('imageherkomst.js --controle');
    const klachten = [];
    if (push < 0) klachten.push('de workflow pusht geen image meer -- dan klopt deze regel niet meer bij wat hij bewaakt');
    if (sbom < 0) klachten.push('er wordt geen stuklijst meer gemaakt (imageherkomst.js --sbom ontbreekt)');
    else if (push >= 0 && sbom < push) klachten.push('de stuklijst wordt VOOR de push gemaakt; dan beschrijft hij niet wat er gepubliceerd is');
    if (binden < 0) klachten.push('het image-digest wordt nergens aan de stuklijst gebonden (imageherkomst.js --binden ontbreekt)');
    else if (sbom >= 0 && binden < sbom) klachten.push('er wordt gebonden voordat de stuklijst bestaat');
    if (controle < 0) klachten.push('de workflow controleert zijn eigen publicatie niet (imageherkomst.js --controle ontbreekt)');
    if (!/upload-artifact/.test(wf) || !/sbom\.json/.test(wf)) klachten.push('de stuklijst wordt niet bewaard: zonder upload blijft er na de run niets van over');
    /* Een sleutel die er WEL staat maar geen sleutel is, is erger dan geen
       sleutel: hij ziet eruit als een vertrouwensanker. */
    const pubPad = path.join(ROOT, 'deploy/release-sleutel.pub');
    if (fs.existsSync(pubPad)) {
      try {
        const sleutel = require('crypto').createPublicKey(fs.readFileSync(pubPad, 'utf8'));
        if (sleutel.asymmetricKeyType !== 'ed25519') klachten.push('deploy/release-sleutel.pub is geen Ed25519-sleutel maar ' + sleutel.asymmetricKeyType);
      } catch (e) { klachten.push('deploy/release-sleutel.pub is geen leesbare publieke sleutel: ' + e.message); }
    }
    if (klachten.length) klachten.forEach(fout);
    else ok('de workflow maakt de stuklijst na de push, bindt hem aan het digest, controleert en bewaart hem' +
      (fs.existsSync(pubPad) ? ', en de vastgelegde publieke sleutel is een geldige Ed25519-sleutel' : ' (nog geen vastgelegde publieke sleutel: releases zijn ongetekend)'));
  }
}


/* ============================================================================
   55) DE DUBBELTIK STAAT NA ELKE ANDERE RES.JSON-WIKKEL

   DEZE REGEL KOMT UIT EEN FOUT DIE DERTIEN GROENE TOETSEN NIET ZAGEN. De
   dubbeltik (server/lib/dubbeltik.js) hing res.json om zich een antwoord te
   herinneren. jsonGzip() doet dat OOK, en stuurt een antwoord boven de kilobyte
   via res.send in plaats van via res.json. Stond de dubbeltik daarvoor, dan zag
   hij grote antwoorden nooit -- en liet hij de herhaling het werk gewoon opnieuw
   doen. Negentien routes in de idemproef, allemaal met een groot antwoord, en
   nergens een foutmelding: kleine antwoorden gingen goed, en curl vraagt
   standaard geen compressie.

   Wie het laatst om res.json heen gaat, ziet het antwoord het eerst. De
   dubbeltik hoort dus de BUITENSTE wikkel te zijn. test/dubbeltikgzip.test.js
   bewijst dat die samenstelling werkt; deze regel bewaakt dat de PRODUCTIECODE
   die volgorde ook echt aanhoudt -- een toets die zijn eigen volgorde opschrijft
   zegt niets over wat er in server/ gebeurt. */
console.log('\n55) de dubbeltik staat na elke andere res.json-wikkel');
{
  const wikkelaars = [];
  loop(path.join(ROOT, 'server'), /\.js$/, (f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    /* Elke plek die res.json vervangt is een wikkel. De dubbeltik zelf hoort
       er ook bij: die moet als laatste komen. */
    if (/\bres\.json\s*=/.test(bron)) wikkelaars.push(rel);
  });
  const poortwachters = path.join(ROOT, 'server/opzet/poortwachters.js');
  const bron = fs.existsSync(poortwachters) ? zonderCommentaar(fs.readFileSync(poortwachters, 'utf8')) : '';
  const gzip = bron.indexOf('app.use(jsonGzip())');
  const dub = bron.indexOf('app.use(dubbeltik.middleware())');
  const klachten = [];
  if (dub < 0) klachten.push('de dubbeltik wordt in poortwachters.js niet meer gemount; dan is geen enkele route tegen een herhaling beschermd');
  else if (gzip < 0) klachten.push('jsonGzip() staat niet meer in poortwachters.js -- controleer of de dubbeltik nog de buitenste wikkel is');
  else if (dub < gzip) klachten.push('de dubbeltik staat VOOR jsonGzip(); grote antwoorden gaan dan buiten hem om (zie test/dubbeltikgzip.test.js)');
  /* En een NIEUWE wikkel is geen fout, maar wel iets waar iemand naar hoort te
     kijken: hij kan de dubbeltik opnieuw onzichtbaar maken. De lijst staat hier
     bij naam, dus hij groeit niet stil. */
  const BEKEND = {
    'server/middleware/compressie.js': 'jsonGzip -- staat VOOR de dubbeltik, precies daarom bestaat deze regel',
    'server/opzet/lijfpoort.js': 'het zaakdoos-journaal; staat voor de dubbeltik en verandert het antwoord niet',
    'server/opzet/liegpoort.js': 'meetgereedschap, draait alleen met RTG_LIEG en nooit in een echte rit',
    'server/lib/dubbeltik.js': 'de dubbeltik zelf',
    'server/lib/cache.js': 'antwoordcache; alleen op leesroutes (GET), en een cachetreffer doet per definitie geen werk',
    'server/web/verrijk.js': 'de EIGEN webserver voor klantdomeinen, een andere server dan deze app -- geen express, geen dubbeltik',
    'server/lib/idem-poort.js': "de idem-poort. NAGEKEKEN op 20 augustus 2026 bij het samenvoegen: hij wordt gemount in opzet/lijfpoort.js (stap 8 van de verzoekketen, server.js r.422) en de dubbeltik in opzet/poortwachters.js (server.js r.441). De idem-poort wikkelt dus EERDER en de dubbeltik staat er nog achter, precies wat deze regel eist. Hij bewaart alleen een 2xx-antwoord onder een sleutel en verandert het antwoord zelf niet.",
    'server/middleware/idempotentie.js': "de opt-in idempotentielaag. NAGEKEKEN op 20 augustus 2026: gemount in opzet/poortwachters.js r.114, dus NA de dubbeltik (r.96) -- hij is de buitenste wikkel. Dat is hier juist: hij grijpt alleen in als de client ZELF een idem-sleutel meestuurde, en dan is de herhaling een bewuste retry en geen dubbeltik. Elk ander antwoord gaat ongewijzigd door naar de dubbeltik.",
    'server/staatlog.js': 'meetgereedschap, alleen actief met RTG_STAATLOG. Het wordt vroeg in verzoekketen.js gemount; de later gemounte dubbeltik blijft daardoor de buitenste res.json-wikkel.',
    'server/effectmeter.js': 'meetgereedschap, alleen actief met RTG_STAATLOG (dezelfde vlag als de staatmeter). Hij staat als EERSTE laag van verzoekketen.js -- nog voor het logboek, want de body-lezer parkeert het verzoek en alles daarna moet in zijn async-context vallen. Juist daardoor is hij de BINNENSTE res.json-wikkel en blijft de later gemounte dubbeltik de buitenste.',
  };
  const nieuw = wikkelaars.filter(w => !BEKEND[w]);
  if (nieuw.length) klachten.push('nieuwe res.json-wikkel(s) buiten de bekende lijst: ' + nieuw.join(', ') +
    ' -- staat de dubbeltik daar nog achter? Zet hem op de lijst in check.js regel 51 zodra dat is nagekeken');
  if (klachten.length) klachten.forEach(fout);
  else ok(wikkelaars.length + ' plekken vervangen res.json, en de dubbeltik komt na jsonGzip()');
}

/* ============================================================================
   56) GEEN NIEUWE PRIVE-ROUTELIJST

   WAAROM DEZE REGEL BESTAAT. "Welke routes heeft deze server" werd op ACHT
   plekken los uitgezocht, en elke plek kwam op een ander getal:

     scripts/lib/routes.js            2934   (regex over de bron)
     magnaat-capabilities-bronnen.js  3679   (regex over de bron)
     POORTWACHT-ronde                 3987
     scripts/routekaart.js            4191   (de levende router)
     plus prive-scanners in beproeving.js, tot-crash.js en schakelbaar.js

   Geen van die verschillen was ergens te zien. De vier bewijsproeven leunden op
   de eerste en misten daardoor alle vier dezelfde 1257 routes -- waaronder de
   hele RTFoundation. Dat is niet "een scanner die iets mist": dat is een huis
   waarvan niemand weet hoe groot het is.

   Er is nu EEN antwoord: scripts/routekaart.js vraagt het aan de router
   (app._routes(), server/web/routing.js), en scripts/lib/routes.js verdeelt dat
   onder de afnemers. Deze regel houdt dat zo. Wie een nieuwe eigen scanner
   schrijft, ziet hem hier zakken -- met de reden erbij, want de verleiding is
   begrijpelijk: een regex is in vijf regels klaar en een routekaart kost een
   kindproces.

   WAT HIJ MEET. Een bestand in scripts/ dat zelf een `app.post('/pad'`-achtige
   uitdrukking over de BRON legt, terwijl het de routekaart of lib/routes niet
   gebruikt. De drie bekende gevallen staan met naam op de lijst en mogen blijven
   staan tot ze zijn omgezet; ze mogen alleen niet met een vierde vermeerderen.

   WAT HIJ NIET MEET. Of de routekaart zelf klopt -- dat doet
   test/routedekking.test.js, en de achterstand van de bronscanner van de
   Capability Graph staat als ratel in test/magnaat-capabilities.test.js. */
console.log('\n56) geen nieuwe prive-routelijst: EEN plek bepaalt welke routes er zijn');
{
  /* De drie die er al zijn, met wat er nodig is om ze op te ruimen. Deze lijst
     MAG ALLEEN KRIMPEN -- zelfde afspraak als BEKEND hierboven en als de
     schuldlijst in BEREIK.json. */
  const BEKENDE_SCANNERS = new Map([
    ['scripts/beproeving.js', 'eigen alleRoutes(); draait zelf een server en kan de routekaart lenen'],
    ['scripts/tot-crash.js', 'eigen alleRoutes(); zelfde omzetting als beproeving.js'],
    ['scripts/schakelbaar.js', 'leest paden voluit om ze te kunnen tellen (keuringsregel 45); een eigen soort']
  ]);
  /* HET KENMERK VAN EEN EIGEN SCANNER, en dat is niet te verzinnen: een
     reguliere uitdrukking met `\.(` gevolgd door een HTTP-methode-alternatie.
     Alle vier de bestaande scanners hebben precies die vorm --

       /\b(app|router)\.(post|get|put|delete|patch)\(     lib/routes.js
       /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(  capabilities-bronnen
       /app\.(get|post|put|delete)\(\s*'(\/api\/...        beproeving, tot-crash
       /app\.(get|post|put|delete|patch|all)\(             schakelbaar

     Plus de eis dat het bestand ook echt de servermap afloopt; anders vlagt
     deze regel elke toevallige `/x\.(get|set)/` in een script dat met routes
     niets te maken heeft. Twee kenmerken samen, want een van de twee is te
     grof -- en een keuring die roept bij dingen die kloppen, leert je hem te
     negeren (zie de kop van test/blindevlek.test.js). */
  const METHODE_ALTERNATIE = /\\\.\s*\(\??:?\s*(?:get|post|put|delete|patch|all)\s*\|/i;
  const LOOPT_SERVER_AF = /(?:readdirSync|readFileSync)[\s\S]{0,400}?['"]server['"]|['"]server['"][\s\S]{0,400}?(?:readdirSync|readFileSync)/;
  const eigenScanner = (bron) => METHODE_ALTERNATIE.test(bron) && LOOPT_SERVER_AF.test(bron);

  const nieuw = [];
  let bekeken = 0;
  const scanMap = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { scanMap(p); continue; }
      if (!f.name.endsWith('.js')) continue;
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      /* Drie bestanden horen hier niet in: de twee die de ENE routelijst maken,
         en deze keuring zelf -- die draagt het patroon in zijn eigen detectie en
         zou zichzelf aanwijzen. Dat is precies wat er gebeurde bij het schrijven. */
      if (rel === 'scripts/lib/routes.js' || rel === 'scripts/routekaart.js' ||
          rel === 'scripts/check.js') continue;
      bekeken++;
      const bron = fs.readFileSync(p, 'utf8');
      const bouwtRegex = eigenScanner(bron);
      /* DE OVERTREDING IS DE EIGEN UITDRUKKING, niet het ontbreken van een
         require. Hier stond eerst "gebruikt hij lib/routes? dan is het goed", en
         dat gaf meteen een valse vrijspraak: scripts/beproeving.js importeert
         `isSchakel` uit lib/routes EN heeft daarnaast zijn eigen alleRoutes().
         Een module lenen voor iets anders is geen bewijs dat je haar routelijst
         gebruikt. Wie zijn eigen scanner niet meer heeft, is klaar -- dat is de
         enige toets die niet te omzeilen is met een import erbij. */
      if (!bouwtRegex) continue;
      if (BEKENDE_SCANNERS.has(rel)) continue;
      nieuw.push(rel);
    }
  };
  scanMap(path.join(ROOT, 'scripts'));

  /* De lijst mag alleen krimpen: een naam die zijn eigen scanner kwijt is, hoort
     eraf. Anders slijt hij tot namen die niets meer zeggen. */
  const opgelost = [...BEKENDE_SCANNERS.keys()].filter(rel => {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return true;
    return !eigenScanner(fs.readFileSync(p, 'utf8'));
  });

  if (nieuw.length) {
    for (const rel of nieuw) {
      fout(rel + ' leidt zijn eigen routelijst uit de brontekst af. Gebruik ' +
        'scripts/lib/routes.js (die vraagt het aan de router) -- een tweede lijst ' +
        'komt op een ander getal en niemand ziet het verschil.');
    }
  } else if (opgelost.length) {
    for (const rel of opgelost) {
      fout(rel + ' gebruikt de gedeelde routelijst nu wel; haal hem van BEKENDE_SCANNERS ' +
        'in keuringsregel 49 (die lijst mag alleen krimpen).');
    }
  } else {
    ok(bekeken + ' scripts bekeken; geen nieuwe eigen routelijst, ' + BEKENDE_SCANNERS.size +
      ' erkend op de lijst (die alleen mag krimpen)');
  }
}

/* ---------------------------------------------------------------------------
   57) EEN BROWSER START OP EEN PLEK

   WAT ER GEBEURDE. Deze suite laadde playwright op 123 plekken met dezelfde
   zesregelige functie onder twee namen (laadBrowser en laadPlaywright), startte
   hem op 164 plekken met dezelfde letterlijke opties, en sloeg zich over met
   vijf verschillende zinnen. Op de dag dat de omgeving een andere chromium had
   dan playwright vroeg, vielen alle 122 browsertoetsen om -- en er was geen plek
   waar dat te repareren viel. Een waarheid in bijna driehonderd kopieen is geen
   waarheid maar een gerucht (LAT.md regel 4).

   Erger dan de storing was wat de storing NALIET: het schermjournaal van die
   ronde zag er identiek uit aan dat van een geslaagde ronde waarin geen enkel
   scherm werd geopend. Zie test/schermronde.test.js.

   WAT HIJ MEET. Een toetsbestand dat zelf playwright opzoekt of zelf
   launch-opties samenstelt, in plaats van het aan test/helper.js te vragen.

   WAT HIJ NIET MEET. Of de browser het DOET -- dat merk je vanzelf. Deze regel
   gaat alleen over waar het antwoord op "hoe start hier een browser" staat. */
console.log('\n57) een browser start op EEN plek: test/helper.js');
{
  const zonderCommentaar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const EIGEN_LADER = /function\s+laad(?:Browser|Playwright)\s*\(/;
  const EIGEN_OPTIES = /\.launch\(\s*\{/;
  const EIGEN_REDEN = /skip:\s*\w+\s*\?\s*false\s*:/;
  const overtreders = [];
  let bekeken = 0;
  for (const f of fs.readdirSync(path.join(ROOT, 'test'))) {
    if (!f.endsWith('.js') || f === 'helper.js') continue;
    /* ZONDER COMMENTAAR. De eerste versie las de hele bron en wees
       test/skipwacht.test.js aan, die de oude schrijfwijze in zijn KOPTEKST
       aanhaalt om uit te leggen wat er mis mee was. Een keuring die een
       toelichting voor een overtreding aanziet, leert je hem te negeren. */
    const bron = zonderCommentaar(fs.readFileSync(path.join(ROOT, 'test', f), 'utf8'));
    if (!/chromium/.test(bron)) continue;
    bekeken++;
    const wat = [];
    if (EIGEN_LADER.test(bron)) wat.push('zoekt zelf playwright op');
    if (EIGEN_OPTIES.test(bron)) wat.push('stelt zelf launch-opties samen');
    if (EIGEN_REDEN.test(bron)) wat.push('verzint zijn eigen overslaan-reden');
    if (wat.length) overtreders.push('test/' + f + ': ' + wat.join(', '));
  }
  if (overtreders.length) {
    for (const r of overtreders) fout(r);
    fout('Vraag het aan test/helper.js: laadPlaywright(), browserOpties(pw) en geenBrowser(pw).');
  } else {
    ok(bekeken + ' browsertoetsen halen hun browser bij test/helper.js');
  }
}

console.log('\n58) geen ronde hoeken: elke border-radius is 0, behalve een echte cirkel');
{
  const RE = /border-radius\s*:\s*([^;}"'\n\\`]+)/g;
  const mag = (v) => {
    const k = String(v).trim().toLowerCase().replace(/\s+/g, '');
    return k === '0' || k === '0!important' || k === '50%' || k === '50%!important';
  };
  const kapot = [];
  let gekeken = 0, cirkels = 0;
  loop(path.join(ROOT, 'public'), /\.(css|html|js)$/, f => {
    const rel = path.relative(ROOT, f);
    if (rel.endsWith('.min.js')) return;
    let bron; try { bron = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
    if (!bron.includes('border-radius')) return;
    gekeken++;
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(bron))) {
      const v = m[1].trim();
      if (mag(v)) { if (v.toLowerCase().startsWith('50%')) cirkels++; continue; }
      kapot.push(rel + ' regel ' + bron.slice(0, m.index).split('\n').length + ': ' + v.slice(0, 40));
    }
  });
  if (kapot.length) {
    for (const k of kapot.slice(0, 12)) {
      fout('ronde hoek: ' + k + ' -- zet hem op 0 (CLAUDE.md ontwerpprincipe 3);' +
        ' een echte cirkel mag, en die schrijf je als border-radius:50%');
    }
    if (kapot.length > 12) fout('... en nog ' + (kapot.length - 12) + ' plekken');
  } else {
    ok(gekeken + ' bestanden met een radius: allemaal 0, plus ' + cirkels + ' echte cirkels');
  }
}


/* ==========================================================================
   59) ELKE MODULE DIE ROUTES REGISTREERT, WORDT OOK ECHT INGELADEN.

   Bij de samenvoeging van 24 takken (21 augustus 2026) viel de mountregel van
   server/routes/office/rendezvous.js weg. Het bestand stond er, de kern eronder
   ook, en alle drie zijn adressen gaven 404 -- "Onbekend eindpunt". Vier toetsen
   zakten daarop, na twee uur suite.

   EN GEEN ENKELE METER ZAG HET AANKOMEN, want dat kan ook niet: een module die
   niemand inlaadt staat in geen enkele teller, dus hij kan er ook nergens uit
   verdwijnen. De dekking daalt niet, de routekaart wordt korter, en alles ziet
   er kleiner maar gezond uit. Dat is de stilste vorm van kapot die dit huis
   kent.

   Deze regel stelt een kleine vraag -- is er een pad van een ingang naar dit
   bestand? -- en beantwoordt hem in milliseconden. Zie scripts/lib/bedrading.js
   voor hoe requires worden opgelost en waarom samengestelde requires RUIM
   worden benaderd (liever een gemist geval dan een vals alarm, want een poort
   die onterecht rood staat leert niemand meer iets).

   MUTATIE (RAAK): haal de mountregel van office/rendezvous uit routes/office.js
   -> deze regel meldt dat bestand bij naam.
   ========================================================================== */
/* DE REALITY INDEX -- EEN wandeling, EEN leesronde, EEN antwoord op de
   commentaarvraag. Regel 59 en 60 stellen verschillende vragen over dezelfde
   feiten; ze horen die feiten niet elk apart op te halen. Zie
   PROOF-INCREMENTAL.md stap 1: drie scanners met elk een eigen boomwandeling was
   niet alleen traag, het was de bron van drie van de vier meetfouten die bij het
   bouwen van deze twee poorten zijn gemaakt -- want elke kopie had zijn eigen
   antwoord op de vraag wat commentaar is. */
const WERKELIJKHEID = require('./lib/werkelijkheid').index(['server', 'public']);

console.log('\n59) elke module die routes registreert, wordt ook echt ingeladen');
{
  const { meet } = require('./lib/bedrading');
  const r = meet(['server'], WERKELIJKHEID);
  if (r.wezen.length) {
    for (const w of r.wezen.slice(0, 12)) {
      fout('registreert routes maar wordt nergens ingeladen: ' + w +
        ' -- mount hem, of haal hem weg');
    }
    if (r.wezen.length > 12) fout('... en nog ' + (r.wezen.length - 12) + ' module(s)');
  } else {
    /* DE DRIE GETALLEN STAAN ERBIJ, en dat is de hele bedoeling: een graaf die
       zegt "nul wezen" moet kunnen laten zien hoeveel hij zeker wist. Zie
       PROOF-INCREMENTAL.md par. 3.2 -- known / potentially relevant /
       unresolved als GEMETEN grootheden, niet als gevoel. */
    ok(r.gekeken + ' bestanden, ' + r.kanten.opgelost + ' kanten opgelost, ' +
      r.kanten.benaderd.length + ' benaderd, ' + r.kanten.onbekend.length + ' onbekend' +
      ' -- geen enkele routemodule zonder pad vanaf een ingang');
    for (const o of r.kanten.onbekend) {
      console.log('  \x1b[2m  onbekend: ' + o.bestand + ':' + o.lijn + '  [' + o.vorm + ']\x1b[0m');
    }
    for (const [g, b] of Object.entries(r.vertrouwen).sort()) {
      console.log('  \x1b[2m  ' + g.padEnd(9) + String(b.pct).padStart(6) + '% exact' +
        (b.onbekend ? '  (' + b.onbekend + ' onbekend)' : '') + '\x1b[0m');
    }
  }

  /* DE RATEL, EN DE HARDE NUL VOOR DRIE GEBIEDEN.

     Onbekende kanten zijn geen gewone technische schuld. Het zijn de GRENZEN
     van wat dit systeem op dit moment veilig kan bewijzen, en daar hangt straks
     een beslissing aan: over een onbekende kant mag geen bewijs worden geerfd,
     dus dan moet de impactzone conservatief worden opgerekt
     (PROOF-INCREMENTAL.md par. 3.2 en 7.3). Een onbekende die er stilletjes
     bijkomt, maakt die zone dus stilletjes groter of -- erger -- wordt vergeten.

     Voor identity, money en security is de eis NUL en geen ratel. Daar mag een
     impactzone nooit te klein uitvallen omdat de graaf een kant niet kon
     bepalen; liever een gebied dat weigert te groeien dan een gebied waar we
     het niet zeker weten. */
  {
    const REG = path.join(ROOT, 'BEDRADING.json');
    let oud = null;
    try { oud = JSON.parse(fs.readFileSync(REG, 'utf8')); } catch (e) { oud = null; }
    if (!oud) {
      fout('BEDRADING.json ontbreekt of is onleesbaar -- draai node scripts/check.js met een verse meting');
    } else {
      if (r.kanten.onbekend.length > oud.gemeten.onbekend) {
        fout('de bedradingsonzekerheid groeit: ' + oud.gemeten.onbekend + ' -> ' +
          r.kanten.onbekend.length + '. Los de nieuwe op, of leg de groei met een reden vast in BEDRADING.json');
        for (const o of r.kanten.onbekend) fout('  ' + o.bestand + ':' + o.lijn + '  ' + o.reden);
      }
      for (const g of ['identity', 'money', 'security']) {
        const b = r.vertrouwen[g];
        if (b && b.onbekend) {
          fout(g + ' heeft ' + b.onbekend + ' onbekende kant(en); daar is de eis nul --' +
            ' een impactzone mag hier nooit te klein uitvallen');
        }
      }
    }
  }
}

/* ==========================================================================
   60) DE VERBODEN GRAAF: paden die er niet eens mogen ZIJN.

   Dit huis beweert zulke dingen al -- de gluurronde (mag A bij de spullen van
   B), de rolronde (welke rol komt waar binnen), het gesloten circuit van RTG
   Pay -- maar dynamisch, achteraf, en alleen op de paden waar iemand een toets
   voor maakte. Een verboden kant die STATISCH staat, geldt overal en altijd,
   ook waar niemand aan gedacht heeft.

   FAIL-CLOSED: elke regel in scripts/lib/verboden.js noemt wie het WEL mag, met
   een reden. Al het andere is verboden. Een lijst van wie het NIET mag vergeet
   zichzelf zodra er een map bijkomt.

   MUTATIE (RAAK): roep accounts.realNameOf() aan in een bestand onder
   server/routes/member/ -> deze regel meldt het, met de reden dat de ledenkant
   op codenamen draait.

   Zie PROOF-INCREMENTAL.md par. 4.
   ========================================================================== */
console.log('\n60) de verboden graaf: geen enkel pad dat er niet mag zijn');
{
  const { meet } = require('./lib/verboden');
  const r = meet(['server', 'public'], WERKELIJKHEID);
  if (r.overtredingen.length) {
    for (const o of r.overtredingen.slice(0, 12)) {
      fout(o.werkwoord + ' geschonden (' + o.regel + '): ' + o.bestand + ':' + o.lijn +
        ' raakt ' + o.wat + ' -- ' + o.reden);
    }
    if (r.overtredingen.length > 12) fout('... en nog ' + (r.overtredingen.length - 12) + ' plek(ken)');
  } else {
    const raakt = Object.values(r.gedekt).reduce((a, g) => a + g.geraakt, 0);
    ok(r.regels + ' verboden kanten over ' + r.gekeken + ' bestanden; ' + raakt +
      ' plek(ken) raken ze en dragen allemaal een reden');
    for (const [id, g] of Object.entries(r.gedekt)) {
      console.log('  \x1b[2m  ' + id.padEnd(18) + g.geraakt + ' plek(ken), allemaal toegestaan\x1b[0m');
    }
  }
}

/* De drie regels hieronder kwamen uit PR #128 binnen als 52-54, terwijl deze
   tak 53-60 al droeg; ze zijn hernummerd naar 61-63 boven het maximum, zodat
   geen twee regels een nummer delen (zelfde greep als bij TAKEN.md par. 4). */
/* ============================================================================
   61) EEN ONTSNAPPINGSFUNCTIE DEKT HET AANHALINGSTEKEN.

   WAAR DEZE REGEL VANDAAN KOMT. Dit huis droeg 28 eigen escape-helpers, en vijf
   daarvan vervingen alleen `&` en `<`. Dat is genoeg zolang de uitkomst in TEKST
   landt. Twee ervan landden in een ATTRIBUUT:

     borden:      '<span class="bd-av" title="' + esc(n) + '">'
     collegachat: '<input id="ccInput" placeholder="... ' + esc(naam) + '">'

   Een naam met een aanhalingsteken breekt daar uit het attribuut, en de rest van
   die naam wordt markup. In een werk-OS zet een ANDER mens die naam, dus dat is
   geen theorie.

   WAAROM DE REGEL STRENGER IS DAN DE VONDST. Je zou kunnen uitrekenen welke esc()
   in attribuutcontext landt en alleen die eisen. Dat is te doen -- en het is de
   verkeerde reparatie. Dan blijft de kennis "waar landt deze string?" bij de
   AANROEPER liggen, en die verplaatst een regel zonder aan zijn escape te denken.
   LAT.md regel 1: repareer de oorzaak, niet het symptoom. De oorzaak is dat een
   escape zijn veiligheid van zijn omgeving laat afhangen. Dus dekt elke helper
   `&`, `<` en `"`, en hoeft de aanroeper niets te weten.

   WAAROM DIT DE PARSER GEBRUIKT EN GEEN PATROON. De eerste versie hiervan zocht
   met een reguliere expressie naar het lijf van de functie. Die kapte een
   meerregelig lijf af bij de eerste nieuwe regel en las een tekenklasse niet, en
   meldde daardoor de TWEE STERKSTE helpers van het huis als zwak -- `util.js` en
   `geld/hulp.js` dekken alle vijf de tekens. Een keuring met valse meldingen is
   erger dan geen keuring: hij leert je wegkijken. Daarom loopt hij nu over de
   ontleedboom van scripts/ast en leest hij het lijf exact.

   WAT DEZE REGEL NIET DEKT, en dat staat er met opzet bij. Een ENKEL aangehaald
   attribuut (title='...') blijft open: dan is `'` het gevaarlijke teken, en dat
   eist deze regel niet -- dit huis schrijft zijn attributen dubbel aangehaald en
   de 23 bestaande sterke helpers dekken `'` niet allemaal. Hij keurt ook geen
   URL- of scriptcontext: href="javascript:..." is een andere fout met een andere
   reparatie. Dit is een ondergrens, geen uitvoergrens. Die laatste (tekst /
   attribuut / url / html als aparte contracten) hoort bij de Interface Runtime
   en is groter werk dan een keuringsregel. */
console.log('\n61) elke ontsnappingsfunctie dekt & < en "');
{
  const { lex } = require('./ast/lexer');

  /* WAAROM DE LEXER EN NIET DE PARSER. De vorige versie hiervan gebruikte
     ast/parser.js, en die zakte op 43 bestanden -- alle 43 een BUNDELDEEL. Een
     deel is geen geldig programma: het begint midden in een IIFE die pas in een
     ander deel sluit. Daar woonden vier van de vijf zwakke ontsnappingen, dus de
     regel keurde precies de plek niet waar de fout zat.
     Een lexer heeft geen grammatica nodig en leest een fragment gewoon. Hij
     kent bovendien de twee plekken waar handwerk hier stukloopt: strings en het
     verschil tussen een deling en een reguliere expressie. Het lijf van een
     functie is altijd haakjes-gebalanceerd, ook in een fragment, dus tellen over
     tokens is exact. */
  let BUNDELUIT = new Set();
  try { BUNDELUIT = new Set(Object.keys(require('./bundel').bundels).map(x => 'public/' + x)); }
  catch (e) { fout('de bundellijst kon niet worden gelezen (' + e.message + '); dan stelt deze regel minder vast'); }

  const HEET_ESC = n => /^esc/i.test(n) || /escape/i.test(n);
  const isLees = (t, v) => !!t && t.type === 'lees' && t.value === v;

  function haakEind(toks, k) {
    const open = toks[k].value, dicht = { '(': ')', '[': ']', '{': '}' }[open];
    let d = 0;
    for (let i = k; i < toks.length; i++) {
      const t = toks[i];
      if (t.type !== 'lees') continue;
      if (t.value === open) d++;
      else if (t.value === dicht && !--d) return i;
    }
    return -1;
  }

  /* Van het eerste token van een functie-uitdrukking naar het laatste. Dekt
     `function f(){}`, `(a) => {}`, `a => expr` en `(a) => expr`. */
  function eindeVanFunctie(toks, k) {
    let i = k;
    if (toks[i] && toks[i].type === 'naam' && toks[i].value === 'function') {
      i++;
      if (toks[i] && toks[i].type === 'naam') i++;
      if (!isLees(toks[i], '(')) return -1;
      i = haakEind(toks, i); if (i < 0) return -1;
      i++;
      return isLees(toks[i], '{') ? haakEind(toks, i) : -1;
    }
    if (isLees(toks[i], '(')) { i = haakEind(toks, i); if (i < 0) return -1; i++; }
    else if (toks[i] && toks[i].type === 'naam') i++;
    else return -1;
    if (!isLees(toks[i], '=>')) return -1;
    i++;
    if (isLees(toks[i], '{')) return haakEind(toks, i);
    let d = 0;                                    // pijlfunctie met een uitdrukking als lijf
    for (let j = i; j < toks.length; j++) {
      const t = toks[j];
      if (t.type !== 'lees') continue;
      if ('(['.includes(t.value) || t.value === '{') d++;
      else if (')]'.includes(t.value) || t.value === '}') { if (!d) return j - 1; d--; }
      else if ((t.value === ';' || t.value === ',') && !d) return j - 1;
    }
    return toks.length - 1;
  }

  /* De patronen die aan .replace( worden meegegeven, als brontekst. Een negatieve
     klasse telt niet: die zegt juist dat het teken NIET wordt geraakt. */
  function replacePatronen(lijf) {
    const uit = [];
    for (const m of lijf.matchAll(/\.replace\s*\(\s*\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\//g)) {
      if (!m[1].startsWith('^')) uit.push(m[1]);
    }
    return uit;
  }
  const ENTITEIT = { '&': /&amp;/, '<': /&lt;/, '"': /&quot;|&#0*34\b/ };
  function dekt(lijf, teken) {
    if (ENTITEIT[teken].test(lijf)) return true;
    return replacePatronen(lijf).some(pat => {
      const klassen = [...pat.matchAll(/\[(\^?)((?:[^\]\\]|\\.)*)\]/g)];
      if (klassen.some(k => !k[1] && k[2].includes(teken))) return true;
      return pat.replace(/\[(?:[^\]\\]|\\.)*\]/g, '') === teken;
    });
  }
  /* Alleen HTML-ontsnappers: een escapeRegex() vervangt ook van alles, maar draagt
     geen entiteit en geen `<` in zijn patroon, en hoort hier niet te zakken. */
  const isHtmlEsc = lijf => /&amp;|&lt;|&gt;|&quot;|&#0*3[49]\b/.test(lijf) ||
    replacePatronen(lijf).some(pat => pat.includes('<'));

  let gekeurd = 0, zwak = 0, stuk = 0;
  loop(path.join(ROOT, 'public'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/') || BUNDELUIT.has(rel)) return;
    const bron = fs.readFileSync(f, 'utf8');
    if (!/\besc\w*\s*[=(:]/i.test(bron) || !bron.includes('.replace(')) return;
    let toks;
    try { toks = lex(bron); } catch (e) { stuk++; fout('kon ' + rel + ' niet lezen (' + e.message + ')'); return; }

    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.type !== 'naam' || !HEET_ESC(t.value)) continue;
      const vorig = toks[i - 1], volg = toks[i + 1];
      let k = -1;
      if (vorig && vorig.type === 'naam' && vorig.value === 'function') k = i - 1;
      else if (isLees(volg, '=') || isLees(volg, ':')) k = i + 2;
      if (k < 0 || !toks[k]) continue;
      const e = eindeVanFunctie(toks, k);
      if (e < 0) continue;
      const lijf = bron.slice(toks[k].start, toks[e].end);
      if (!/\.replace\s*\(/.test(lijf) || !isHtmlEsc(lijf)) continue;
      gekeurd++;
      const mist = ['&', '<', '"'].filter(c => !dekt(lijf, c));
      if (!mist.length) continue;
      zwak++;
      fout('zwakke ontsnapping: ' + rel + ':' + t.lijn + ' -- ' + t.value + '() dekt ' +
        mist.map(c => c === '"' ? 'het aanhalingsteken' : c).join(' en ') + ' niet');
    }
  });
  if (!zwak && !stuk) ok(gekeurd + ' HTML-ontsnappingsfuncties dekken & < en het aanhalingsteken');
}

/* ============================================================================
   62) EEN GECONTRACTEERD DOMEIN HEEFT EEN DEUR, EN NIET ZEVENTIEN.

   WAAROM DEZE REGEL NAAST DE RATEL STAAT. scripts/norm.js telt de deuren naar
   db.data over het hele huis (dbDeuren, dbDeurenSchrijvend) en laat ze alleen
   omlaag. Dat houdt het TOTAAL in de hand, maar niet een enkel domein: wie een
   deur sluit in payroll en er een opent in mobiliteit, beweegt de meter niet.
   Voor een domein dat NET achter een contract staat is dat precies het gat --
   daar is de winst nieuw en dus het makkelijkst weer kwijt.

   Dus: zodra een domein hieronder staat, is zijn aantal rechtstreekse
   aanrakingen NUL en niet "lager dan gisteren". De ratel blijft ernaast voor
   alles wat nog niet gecontracteerd is.

   HOE JE EEN DOMEIN TOEVOEGT. Een regel in GECONTRACTEERD, met de map en de
   naam van de deur. Dat is met opzet het enige wat het kost: als het volgende
   domein een nieuwe keuringsregel zou vragen, gebeurt het niet.

   WAT DEZE REGEL NIET DOET. Hij leest brontekst en kijkt naar `db.data`. Een
   module die db langs een andere naam krijgt doorgegeven ziet hij niet -- zelfde
   bewuste onderschatting als bij scripts/deuren.js en keuringsregel 50. Bij
   payroll is dat vandaag geen gat: na de migratie krijgt geen enkele laag daar
   nog een database mee, alleen het contract, en dat is sterker dan een regel.
   Deze poort vangt de terugval. */
console.log('\n62) een gecontracteerd domein raakt db.data alleen door zijn eigen deur');
{
  const { lex } = require('./ast/lexer');
  const GECONTRACTEERD = [
    { map: 'server/kern/payroll', deur: 'opslag.js',
      waarom: 'eerste contractlaag; elf schrijvers over veertien bestanden, dertien collecties' },
    { map: 'server/kern/concern', deur: 'opslag.js',
      waarom: 'acht schrijvers; EEN wortel met acht takken, en dus een andere vorm dan payroll' },
    { map: 'server/kern/veiligheid', deur: 'opslag.js',
      waarom: 'zeven schrijvers; wortel met takken, plus twee plekken die een tak VERVANGEN' },
    { map: 'server/kern/mobiliteit', deur: 'opslag.js',
      waarom: 'veertien schrijvers en 109 aanrakingen: het rommeligste domein, en daarom het meest gebaat' },
    { map: 'server/kern/command', deur: 'opslag.js',
      waarom: 'twaalf schrijvers; het eerste domein met vier soorten omgang (bezit, teller, gedeeld, vreemd)',
      ook: {
        /* register.js is een ZUIVERE module: hij krijgt zijn gegevensbron als
           argument mee (rijen(db, soort)) en heeft geen fabriek waar een
           contract in past. Hem omzetten betekent het lees(db)-contract
           wijzigen, en dat contract dragen OOK kern/zaakcommand/register.js en
           kern/werkcommand/register.js. Dat is een ontwerpvraag over drie
           domeinen en geen migratie; zie ./opslag.js voor de volledige
           afweging. Zolang hij hier staat, kan er geen tweede bij komen zonder
           dat deze regel rood wordt. */
        'register.js': 'zuivere module; zijn lees(db)-contract wordt gedeeld met zaakcommand en werkcommand'
      } },
    /* DE VIER DIE EEN DEUR DELEN. db.data.lifestyle is EEN dossier per lid met
       vijfentwintig velden, en de meting wees uit dat er geen enkel veld door
       twee domeinen wordt geschreven. Het is dus geen betwiste zak maar een
       samengesteld dossier; kern/levensdossier.js draagt de veldenlijst met per
       veld zijn eigenaar, en weigert een schrijver die niet de eigenaar is. */
    { map: 'server/kern/lifestyle', deur: '../levensdossier/index.js',
      waarom: 'bezit vijf velden van het levensdossier (verzoeken, bezittingen, afspraken, dossier, voorkeuren)' },
    { map: 'server/kern/rechterhand', deur: '../levensdossier/index.js',
      waarom: 'bezit twaalf velden; de afspraak stond hier als commentaar en is nu een poort' },
    { map: 'server/kern/bureau', deur: '../levensdossier/index.js',
      waarom: 'bezit acht velden en LEEST er vier van anderen; die vier staan nu met naam in de code' },
    { map: 'server/kern/levensgraaf', deur: '../levensdossier/index.js',
      waarom: 'schrijft niets en leest alles: een projectie, en die mag het dossier niet laten groeien',
      ook: {
        /* DE BRONNEN ZIJN ZUIVERE BESCHRIJVINGEN. Elke bron is een object met
           functies die hun gegevensbron als ARGUMENT krijgen (net als
           kern/command/register.js), en ze lezen zes collecties van andere
           domeinen: agendas, boekingen, cvs, leren, lifestyle en rtgid. Alleen
           lezen -- deze laag schrijft nergens.

           Ze contracteren betekent het bronnen-contract wijzigen, en dat dragen
           ook bronnen-basis, bronnen2, bronnen3 en de zaak-graaf in
           kern/zaak/. Dat is een ontwerpvraag over domeinen heen en geen
           migratie; zolang ze hier staan, kan er geen vijfde bij komen zonder
           dat deze regel rood wordt. */
        'bronnen-leven.js': 'zuivere bronbeschrijving; leest leren en cvs met db als argument',
        'bronnen-leven-bijdrage.js': 'zuivere bronbeschrijving; leest rtgid met db als argument',
        'bronnen-platform.js': 'zuivere bronbeschrijving; leest boekingen en agendas met db als argument',
        'bronnen-zaak.js': 'zuivere bronbeschrijving; leest boekingen en agendas met db als argument'
      } }
  ];

  for (const dom of GECONTRACTEERD) {
    /* Een BENOEMDE uitzondering, met reden -- dezelfde vorm als MAG_ZONDER in
       regel 16 en TOEGESTAAN in regel 47. Een bestand dat hier staat mag
       db.data aanraken; een bestand dat hier NIET staat niet, en dat is het
       verschil met geen poort. Wie er een bij zet, schrijft op waarom. */
    const ook = new Set(Object.keys(dom.ook || {}));
    const wortel = path.join(ROOT, dom.map);
    if (!fs.existsSync(wortel)) { fout(dom.map + ' bestaat niet, maar staat wel als gecontracteerd'); continue; }
    const deurPad = path.join(wortel, dom.deur);
    if (!fs.existsSync(deurPad)) { fout(dom.map + ' mist zijn deur (' + dom.deur + ')'); continue; }
    /* De deur mag BUITEN de eigen map staan. Vier domeinen delen er een:
       kern/levensdossier.js draagt het dossier per lid waarvan lifestyle,
       rechterhand, bureau en levensgraaf elk hun eigen velden schrijven.
       Eist deze regel dat een deur binnen het domein staat, dan zou zo'n
       gedeeld contract in vier kopieen moeten -- precies wat het oplost. */
    const deurRel = path.relative(ROOT, deurPad).replace(/\\/g, '/');

    let langs = 0, gekeken = 0;
    loop(wortel, /\.js$/, f => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      gekeken++;
      if (rel === deurRel) return;                                 // de deur zelf
      if (ook.has(path.posix.basename(rel))) return;               // benoemd, met reden
      /* CODE LEZEN EN GEEN PROZA, VIA DE LEXER. Keuringsregel 47 heeft deze
         fout een keer gemaakt (TAKEN.md 6.17): hij las de RAUWE bron en meldde
         een bestand als overtreder omdat de naam in een KOP stond die uitlegt
         waarom het daar juist NIET gebeurt.

         Commentaar wegstrippen is hier niet genoeg. kern/command/landpakket.js
         draagt `bron: 'db.data.talen'` als STRINGWAARDE -- een gegeven dat
         vertelt waar een feit vandaan komt, en geen aanraking. De lexer kent
         het verschil tussen een naam en een string, dus zoeken we de tokenreeks
         db . data en niet een patroon in tekst. */
      const ruw = fs.readFileSync(f, 'utf8');
      let toks;
      try { toks = lex(ruw); }
      catch (e) { fout('kon ' + rel + ' niet lezen (' + e.message + '); daar stelt deze regel niets vast'); return; }
      let regelNr = 0;
      for (let i = 0; i + 2 < toks.length; i++) {
        if (toks[i].type === 'naam' && toks[i].value === 'db' &&
            toks[i + 1].type === 'lees' && toks[i + 1].value === '.' &&
            toks[i + 2].type === 'naam' && toks[i + 2].value === 'data') { regelNr = toks[i].lijn; break; }
      }
      if (!regelNr) return;
      langs++;
      fout('langs de deur: ' + rel + ':' + regelNr + ' raakt db.data rechtstreeks aan -- ' +
        'dit domein gaat door ' + dom.map + '/' + dom.deur);
    });
    if (!langs) {
      const erbij = ook.size ? ' (plus ' + ook.size + ' benoemde uitzondering(en))' : '';
      ok(dom.map + ': ' + (gekeken - 1 - ook.size) + ' bestanden, geen enkele raakt db.data buiten ' + dom.deur + erbij);
    }
  }
}

/* ============================================================================
   63) EEN COLLECTIE HEEFT EEN EIGENAAR, EN DIE IS DE ENIGE DIE ERIN SCHRIJFT.

   server/kern/eigencollectie.js is de lichte vorm van een opslagcontract: een
   module zegt op zijn eigen plek welke collecties hij bezit en met welke vorm.
   Die declaratie staat MET OPZET bij de eigenaar en niet in een middenregister
   -- een centrale lijst van vierhonderd collecties is binnen een jaar de
   volgende plek die uit de pas loopt met de code.

   Precies daarom moet iets anders bewaken wat zo'n lijst gratis zou geven: dat
   niemand hetzelfde opeist, en dat de eigenaar de enige schrijver is. Dat is
   deze regel. Hij verzamelt alle declaraties in server/ en zakt op twee dingen:

     - twee bestanden die dezelfde collectie bezitten. Dan is "eigenaar" een
       woord zonder betekenis geworden.
     - een SCHRIJVER buiten de eigenaar. De helper kan dat niet zien: hij weigert
       wel een collectie die je niet declareerde, maar niet dat iemand anders
       db.data.<jouw collectie> rechtstreeks aanraakt.

   HIJ LEEST TOKENS EN GEEN TEKST, om dezelfde reden als regel 53: een naam in
   een kop of een string is geen aanraking (TAKEN.md 6.17).
   ========================================================================== */
console.log('\n63) elke gedeclareerde collectie heeft een eigenaar, en die schrijft als enige');
{
  const { lex } = require('./ast/lexer');
  const SERVER = path.join(ROOT, 'server');

  /* Het `bezit`-blok van een aanroep uithalen: van `bezit:` tot de bijhorende
     sluitaccolade, met accolades tellen. Een patroon zou stukgaan op de eerste
     geneste vorm. */
  function bezitVan(bron, vanaf) {
    const k = bron.indexOf('bezit:', vanaf);
    if (k < 0) return null;
    const open = bron.indexOf('{', k);
    if (open < 0) return null;
    let d = 0;
    for (let i = open; i < bron.length; i++) {
      if (bron[i] === '{') d++;
      else if (bron[i] === '}') { d--; if (!d) return bron.slice(open + 1, i); }
    }
    return null;
  }

  const eigenaarVan = new Map();   // collectie -> bestand
  let declaraties = 0;
  loop(SERVER, /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel === 'server/kern/eigencollectie.js') return;
    const bron = fs.readFileSync(f, 'utf8');
    if (!bron.includes('eigencollectie')) return;
    let i = 0;
    while (true) {
      const k = bron.indexOf('eigencollectie', i);
      if (k < 0) break;
      const blok = bezitVan(bron, k);
      i = k + 14;
      if (!blok) continue;
      for (const m of blok.matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*:\s*'(lijst|kaart)'/g)) {
        declaraties++;
        const naam = m[1];
        if (eigenaarVan.has(naam) && eigenaarVan.get(naam) !== rel) {
          fout('twee eigenaren voor "' + naam + '": ' + eigenaarVan.get(naam) + ' en ' + rel +
            ' -- een collectie hoort er een te hebben');
        } else eigenaarVan.set(naam, rel);
      }
      break;   // een bestand declareert een keer; de rest is hergebruik van de naam
    }
  });

  /* En de andere helft: schrijft er iemand ANDERS in een gedeclareerde collectie? */
  let indringers = 0;
  if (eigenaarVan.size) {
    loop(SERVER, /\.js$/, f => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      if (rel.startsWith('server/db/')) return;
      const bron = fs.readFileSync(f, 'utf8');
      if (!bron.includes('db.data')) return;
      let toks;
      try { toks = lex(bron); } catch (e) { return; }
      for (let i = 0; i + 4 < toks.length; i++) {
        if (!(toks[i].type === 'naam' && toks[i].value === 'db' &&
              toks[i + 1].value === '.' &&
              toks[i + 2].type === 'naam' && toks[i + 2].value === 'data' &&
              toks[i + 3].value === '.' && toks[i + 4].type === 'naam')) continue;
        const naam = toks[i + 4].value;
        const baas = eigenaarVan.get(naam);
        if (!baas || baas === rel) continue;
        /* Alleen SCHRIJVEN telt: lezen van andermans collectie is een bekende
           en benoemde vorm (de `vreemd`-secties in de contracten). */
        const na = toks[i + 5] && toks[i + 5].value;
        const schrijft = na === '=' || na === '+=' || na === '-=' ||
          (na === '.' && toks[i + 6] && /^(push|pop|shift|unshift|splice|sort|reverse|fill)$/.test(toks[i + 6].value));
        if (!schrijft) continue;
        indringers++;
        fout('schrijft in andermans collectie: ' + rel + ':' + toks[i].lijn + ' raakt "' + naam +
          '" aan, en die is van ' + baas);
        break;
      }
    });
  }

  if (!declaraties) ok('nog geen enkele collectie gedeclareerd via kern/eigencollectie.js');
  else if (!indringers) ok(eigenaarVan.size + ' collecties met een eigenaar, en niemand schrijft in die van een ander');
}

/* ============================================================================
   64) EEN NIEUWE SCHRIJFROUTE HEEFT EEN MUTATIECONTRACT.

   MUTATIECONTRACT.json draagt per schrijfroute vijf assen: wat de mutatie is,
   wat "hetzelfde verzoek" betekent, wat er gemeten is, wie er binnen mag, en hoe
   hard die kennis is. Vier daarvan worden afgeleid; de vijfde -- de BEDOELING --
   staat in server/lib/mutatiecontracten.js, want die is geen waarneming.

   Deze regel bewaakt het getal dat ertoe doet: LEGACY_PENDING_CLASSIFICATION,
   de routes waarvan dit huis formeel niet weet wat een tweede aanroep hoort te
   doen. Hij MAG ALLEEN KRIMPEN -- dezelfde vorm als IDEMSCHULD.json en
   BEWIJSSCHULD.json, en om dezelfde reden: een lijst onbekenden die vanzelf
   meegroeit met de code is geen schuld maar een decor.

   WAT DIT NIET IS: een eis dat alles idempotent wordt. Vijf van de zes standen
   zijn EINDSTANDEN. Een route die met opzet een tweede handeling uitvoert is
   klaar zodra dat is vastgesteld en bewezen; wie dat omdraait, verbouwt de
   architectuur om een percentage mooi te krijgen.

   De grens staat in test/mutatiecontract.test.js en niet hier, zodat er een plek
   is waar een BEWUSTE verhoging (een heel domein erbij) met een reden in de
   commit staat. Deze regel meldt alleen wanneer het register achterloopt op de
   code -- dan is er een schrijfroute bijgekomen die nog niet geteld is.
   ========================================================================== */
console.log('\n64) het mutatiecontractregister loopt niet achter op de code');
{
  const REG = path.join(ROOT, 'MUTATIECONTRACT.json');
  if (!fs.existsSync(REG)) {
    fout('MUTATIECONTRACT.json ontbreekt -- draai: node scripts/mutatiecontract.js --vastleggen');
  } else {
    let reg = null;
    try { reg = JSON.parse(fs.readFileSync(REG, 'utf8')); } catch (e) { fout('MUTATIECONTRACT.json is onleesbaar: ' + e.message); }
    if (reg) {
      let telling = null;
      try {
        const uit = cp.execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'mutatiecontract.js')],
          { cwd: ROOT, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
        const m = /^\s*(\d+)\s+schrijfroutes in de mutatie-inventaris/m.exec(uit);
        telling = m ? Number(m[1]) : null;
      } catch (e) { fout('de contracttelling kon niet draaien: ' + e.message); }
      if (telling != null) {
        if (telling !== reg.gemeten.totaal) {
          fout('MUTATIECONTRACT.json kent ' + reg.gemeten.totaal + ' schrijfroutes en de code heeft er ' +
            telling + ' -- draai: node scripts/mutatiecontract.js --vastleggen, en geef de nieuwe route ' +
            'een contract in server/lib/mutatiecontracten.js');
        } else {
          const open = reg.gemeten.perStand.LEGACY_PENDING_CLASSIFICATION || 0;
          ok(reg.gemeten.totaal + ' schrijfroutes geteld, ' + (reg.gemeten.totaal - open) + ' geclassificeerd, ' +
            open + ' nog te verklaren');
        }
      }
    }
  }
}

console.log(fouten ? `\nNIET OK: ${fouten} probleem(en).` : '\nAlles in orde.');
process.exit(fouten ? 1 : 0);
