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

/* Commentaar eruit halen (regel- en blokcommentaar), zodat een uitleg als
   "// require('x') -> 'x'" niet als echte require wordt gelezen. Strings blijven
   staan; voor deze keuringen is dat genoeg. */
function zonderCommentaar(bron) {
  return String(bron).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

function loop(dir, filter, fn) {
  for (const naam of fs.readdirSync(dir)) {
    const vol = path.join(dir, naam);
    const st = fs.statSync(vol);
    if (st.isDirectory()) { if (!/node_modules|\.git|data|dist/.test(naam)) loop(vol, filter, fn); }
    else if (filter.test(naam)) fn(vol);
  }
}

console.log('1) server-bestanden compileren');
loop(path.join(ROOT, 'server'), /\.js$/, f => {
  const r = cp.spawnSync(process.execPath, ['--check', f]);
  if (r.status !== 0) fout('syntaxfout in ' + path.relative(ROOT, f) + '\n' + r.stderr);
});
if (!fouten) ok('alle server-bestanden compileren');

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
    for (const regel of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = regel.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue; // commentaar overslaan
      const re = /require\((["'])(\.[^"']*)\1\)/g; let m;
      while ((m = re.exec(regel))) {
        try { maker.resolve(m[2]); }
        catch (e) { reqFout++; fout("kapotte require('" + m[2] + "') in " + path.relative(ROOT, f)); }
      }
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
    ['public/shared/glyf/glyf-02.js', 'de glyfentabel: elk icoon een pad, hoort bij elkaar'],
    ['public/shared/flagship/flagship-02.js', 'een opbouwfunctie zonder binnengrens'],
    ['public/shared/klok3d/klok3d-01.js', 'de 3D-klok: een aaneengesloten tekenlus'],
    ['public/shared/metgezel/metgezel-01.js', 'de metgezel-laag in een IIFE zonder binnengrens'],
    ['public/shared/i18n/i18n-01.js', 'de taaltabel + kiezer, een geheel'],
    ['public/shared/i18n/i18n-03.js', 'de taaltabel + kiezer, een geheel'],
    ['server/server.js', 'de bedrading van de hele app; wordt per ronde verder verdund']
  ]);
  /* NOG TE DOEN. Deze staan net boven de grens en moeten opgeknipt worden, maar
     dat is bij een servermodule geen byte-knip: het vraagt echte bedrading
     (require/export), en dat doe je een voor een met de toetsen ernaast. Ze
     WAARSCHUWEN hier dus, ze breken de keuring niet -- anders staat het licht
     voor iedereen op rood voor iets wat gepland is. De lijst hoort te krimpen. */
  const NOG = new Set([
    'server/accounts/users.js',
    'server/kern/journalistiek.js',
    'server/kern/pay/index.js',
    'server/kern/werkplaats.js',
    'server/lokaal-tls.js',
    'server/techniek.js',
    'server/trio.js'
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
  if (!teGroot) ok('geen onverwacht groot productbestand (' + uitz + ' benoemde uitzonderingen, ' + nog.length + ' op de lijst)');
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

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const beloofd = [];
  for (const veld of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const namen = Object.keys(pkg[veld] || {});
    if (namen.length) beloofd.push(veld + ': ' + namen.join(', '));
  }
  if (beloofd.length) fout('package.json noemt toch pakketten (' + beloofd.join(' | ') + ')');
  else ok('package.json noemt geen enkel pakket');

  const lock = path.join(ROOT, 'package-lock.json');
  if (fs.existsSync(lock)) {
    const pakketten = Object.keys(JSON.parse(fs.readFileSync(lock, 'utf8')).packages || {}).filter(k => k);
    if (pakketten.length) fout('package-lock.json bevat ' + pakketten.length + ' pakket(ten): ' + pakketten.slice(0, 5).join(', '));
    else ok('package-lock.json is leeg (alleen het project zelf)');
  }
}

console.log(fouten ? `\nNIET OK: ${fouten} probleem(en).` : '\nAlles in orde.');
process.exit(fouten ? 1 : 0);
