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
    // server/accounts/users.js is opgeknipt: het ledendossier, de verificatie, de
    // kantoorlijsten en de vergetelheid staan nu in server/accounts/dossier.js
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
  const DERDE = /bestel|order|reserve|boek|booking|bezorg|leveri|koerier|courier|afhaal|ophaal|verblijf|proefrit|koop|huur|ticket|vervoer|taxi|\brit\b/i;
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
    ['/api/tickets/aanbod', 'het aanbod bekijken; er gebeurt nog niets'],
    ['/api/verhuur/aanbod', 'het aanbod bekijken; er gebeurt nog niets'],
    ['/api/verkoop/showroom', 'de showroom bekijken; er gebeurt nog niets'],
    ['/api/verblijf/deur', 'je bent al ingecheckt: dit opent je eigen kamerdeur'],
    ['/api/huur/foto', 'vervolgstap in een lopende huur'],
    ['/api/huur/locatie', 'vervolgstap in een lopende huur (vrijwillige positie)'],
    ['/api/huur/sos', 'noodknop tijdens een lopende huur -- hier NOOIT iets vragen'],
    ['/api/verkoop/teken', 'het contract van een deal die al loopt tekenen'],
    ['/api/asset/koop', 'RTG Shared Assets is van RTG zelf; er staat geen derde tegenover']
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
      const patroon = new RegExp(v.sel.replace('#', '#') + '\\s+' + el + '\\b');
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
    for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/gi)) {
      const p2 = m[1].startsWith('/') ? path.join(PUB, m[1]) : path.join(path.dirname(f), m[1]);
      for (const t of gezetteTokens(zonderCss(leesVeilig(p2)))) def.add(t);
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

console.log(fouten ? `\nNIET OK: ${fouten} probleem(en).` : '\nAlles in orde.');
process.exit(fouten ? 1 : 0);
