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
   staan; voor deze keuringen is dat genoeg. Staat in scripts/lib/bron.js omdat
   scripts/keuring.js hem ook gebruikt. */
const { zonderCommentaar } = require('./lib/bron');

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
    ['server/server.js', 'de bedrading van de hele app; wordt per ronde verder verdund'],
    ['public/apps/boardroom-eigenaar.js', 'de eigenaarszetel: vier panelen op een gedeelde api/el-kern in een IIFE']
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
      const poort = zonderCommentaar(bron).split('\n').some(r =>
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
   Wat telt is of er ergens ANDERS in server/ of scripts/ iets mee gebeurt.

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
    ['RTG_ALLOW_PLAINTEXT', 'bevestigingsvlag VOOR de keuring: "ik weet dat er geen sleutel is, start toch"'],
    ['STRIPE_DEMO_BEWUST', 'bevestigingsvlag VOOR de keuring: "deze installatie draait bewust zonder betalingen"'],
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
      loop(path.join(ROOT, map), /\.(js|mjs|cjs)$/, f => {
        const rel = path.relative(ROOT, f).replace(/\\/g, '/');
        if (rel.startsWith(KEURMAP)) return;         // de keuring is niet haar eigen bewijs
        const bron = zonderCommentaar(fs.readFileSync(f, 'utf8'));
        for (const m of bron.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) gelezen.add(m[1]);
        for (const m of bron.matchAll(/\benv\.([A-Z_][A-Z0-9_]*)/g)) gelezen.add(m[1]);
      });
    }
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
      fout(waar + ' belooft ' + naam + ', maar niets in server/ of scripts/ leest die variabele' +
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
  const POORT_MW = new Set(['auth', 'supplierAuth', 'officeAuth', 'techAuth', 'boardroomAuth',
    'huisAuth', 'baasAuth', 'lid', 'geenGast', 'eigenaarAlleen']);
  const POORT_BINNEN = /\b(profiel|schoolProfiel|rtfSociaal|eisAccount|resolveSession|verifyToken|sessionFor|magInzien|isEigenaar|boardroomWie|magBoardroom|doosSleutelOk|magMeten|metPartner|samenSess|kantoorSess|werkPoort|beheerVan|lidVan)\s*\(/;

  /* PUBLIEK MET REDEN. Alles hier is een bewuste keuze, geen omissie. Wie een
     regel toevoegt schrijft er een reden bij die klopt; kun je dat niet, dan is
     de route waarschijnlijk gewoon een gat. */
  const PUBLIEK = new Map([
    // ---- de deuren zelf: hier kan per definitie nog geen sessie zijn ----
    ['/api/auth/register', 'registreren kan alleen zonder account'],
    ['/api/auth/forgot', 'wachtwoord vergeten: wie buitengesloten is heeft geen token'],
    ['/api/aanmelding/aanvraag', 'een aanstaande aanvrager is nog geen lid (met rem per ip)'],
    ['/api/supplier/apply', 'solliciteren bij een zaak kan zonder account'],
    ['/api/supplier/staff/join', 'personeel meldt zich aan met een uitnodigingscode'],
    ['/api/rtgid/start', 'de identiteitsstroom begint voordat er een sessie is'],
    ['/api/sso/waarheen', 'de SSO-heenweg draagt zijn eigen ondertekende staat'],
    ['/api/sso/start', 'idem; 404 op een onbekende of uitgezette koppeling'],
    ['/api/kantoor/gesprek/start', 'het kantoorgesprek begint voor er een account is'],
    ['/api/kantoor/gesprek/zeg', 'loopt verder op het gespreks-id dat bij de start is uitgegeven'],
    ['/api/bedrijf/werkruimte/maak', 'een organisatie die nog geen werkruimte heeft, heeft ook nog geen sleutel; de maker krijgt het beheer-token'],
    ['/api/bedrijf/lid/aanmeld', 'aanmelden bij een werkruimte kan zonder sleutel -- het token dat je krijgt werkt pas na toelating (test/bedrijfkern.test.js)'],

    /* ---- DE ACHT DIE OP HUN BUURMAN LEUNDEN ----
       Deze stonden hier niet, en ze kwamen ook nergens door een poort: ze
       kwamen door omdat het venster van 800 tekens de code van de VOLGENDE
       route meelas en daar een 401 vond. Sinds die knip (zie hieronder bij
       `staart`) staan ze hier met een eigen reden -- of ze zijn geen gat. */
    ['/api/aanmeld/start', 'het aanmeldgesprek begint voor er een account is; rem van 40 berichten per minuut per ip'],
    ['/api/webauthn/opties', 'de uitdaging moet er zijn VOOR je hem kunt beantwoorden; het bewijs volgt bij /login'],
    ['/api/auth/verify-email', 'de bevestigingslink IS de geloofsbrief (verifyActionToken); ongeldig of verlopen geeft 400'],

    // ---- publiek, maar met een code in het lijf als geloofsbrief ----
    /* Dezelfde familie als metPartner hiernaast: clubs en stadspartners hebben
       geen RTG-account, hun code is de sleutel en het portaal toont uitsluitend
       het dossier dat bij die ene code hoort.

       Hier stond eerst de kanttekening dat er GEEN rem op zat en dat de sterkte
       dus volledig aan de lengte van de code hing. Die staat er nu wel: twee
       remmen in server/routes/rtfkantoor/codedeuren.js (20/min per bron tegen het afgrazen,
       60/min per code tegen veel bronnen op een code), vastgelegd in
       test/rtfcoderem.test.js. Wat blijft staan voor de externe toets (taak 22):
       codes zonder vervaldatum en zonder intrekknop. */
    ['/api/rtf/club/portaal', 'de clubcode is de geloofsbrief (vindCode); alleen het eigen clubdossier'],
    ['/api/rtf/club/bericht', 'idem: schrijft alleen in het logboek van die ene clubcode'],
    ['/api/rtf/partner/raad', 'de raadcode is de geloofsbrief (vindCode); alleen de eigen partnerkant'],

    // ---- publieke informatie: staat ook gewoon op de site ----
    ['/api/pasprijzen', 'de prijslijst is publieke informatie'],
    ['/api/rtf/vacatures', 'openstaande vacatures zijn openbaar'],
    ['/api/gids/app', 'de app-gids is openbaar'],
    ['/api/krant/gids', 'de krant is openbaar; er is een toets die dat vastlegt'],
    ['/api/krant/open', 'idem'],
    ['/api/krant/artikel', 'idem'],
    ['/api/partner', 'het partnerkanaal is bedoeld voor niet-leden'],
    ['/api/partnertrips', 'idem: het aanbod van het partnerkanaal'],
    ['/api/book', 'idem: boeken via het partnerkanaal is de hele opzet'],
    ['/api/talen', 'de talenlijst voedt de kiezer op het inlogscherm'],
    ['/api/vertaal/ui', 'de knopteksten van datzelfde inlogscherm'],
    ['/api/translate', 'het woordenboek is publiek; de AI-tak zit achter kern/aipoort.js'],
    ['/api/push/key', 'de VAPID-sleutel is per definitie de PUBLIEKE helft'],
    /* Het algoritmeregister van de stad. Een register dat alleen achter een
       kantoorinlog te lezen is, geeft een inwoner precies niets -- en dat is
       de enige groep voor wie het bedoeld is. Er staan regels in, geen mensen:
       geen persoonsgegevens, geen bedrijfsgevoelige data, alleen wat er
       meerekent en wat het mag beslissen. */
    ['/api/stad/algoritmes', 'het openbare algoritmeregister: beschrijft regels, geen personen'],
    ['/api/fout/client', 'een fout uit de browser: JUIST zonder poort, want een fout die het ' +
      'inloggen zelf sloopt komt nooit binnen achter een poort die inloggen vereist. Er wordt ' +
      'niets bewaard en niets uitgevoerd, alleen gelogd, met een rem per IP en afgekapte velden ' +
      '(zie server/routes/fout.js voor wat er wel en niet meegaat)'],
    ['/api/zegel/sleutel', 'idem: de publieke helft van het zegel'],
    ['/api/zegel/controleer', 'controleert een handtekening; het bewijs zit in het verzoek'],
    ['/api/ice', 'ijs-servers voor WebRTC; geen gegevens, wel een rem'],
    ['/api/munt/opties', 'welke munten er aan staan is prijslijst-informatie, net als /api/pasprijzen'],
    /* Bedrijfsstatus van de doos zelf (modus, journaalstand, versie, wifi,
       stroom) -- geen zaakdata en geen ledengegevens. Wel eerlijk vermelden:
       het is infrastructuurinformatie, en die hoort op het LAN van de zaak te
       blijven. Hangt een doos ooit rechtstreeks aan het internet, dan is dit
       de eerste route om alsnog achter een poort te zetten. */
    ['/api/doos/status', 'de doos vertelt hoe hij erbij staat; geen zaakdata (zie de opmerking hierboven)'],
    /* Bewust, en met een gemeten grens: de PDA-inlog toont eerst de namenlijst
       zodat personeel zichzelf kan aanwijzen. Zie de rem in toegang.js: dertig
       zaken per kwartier per ip, ruim voor wie van bedrijf wisselt en te weinig
       om alle partners leeg te trekken. */
    ['/api/supplier/roster', 'de PDA-inlog toont de namenlijst voor de pincode; met een eigen rem'],

    // ---- machine naar machine, met een eigen bewijs in het verzoek ----
    ['/api/betaal/webhook', 'ondertekend door de betaalprovider; een sessie bestaat hier niet'],
    ['/api/munt/webhook', 'idem, met een eigen webhook-secret'],
    ['/api/cluster/:actie', 'de clustersleutel zit in een eigen kop; zonder sleutel bestaat de route niet'],
    ['/api/werkmail/bezorg', 'inkomende post van de mailserver, met een eigen venster-rem per minuut'],
    ['/api/mail/binnen', 'de buitenpoort voor echte RFC 5322-post; een vreemde mailserver heeft geen inlog bij ons. Eigen venster-rem per minuut, alles landt in de ONBETROUWDE baan, en de ontvanger komt uit de To-kop en niet uit een parameter (anders was het een open relay)'],
    ['/api/stad/doos/hartslag', 'de stadsdoos stuurt zijn apparaatsleutel mee'],
    ['/api/stad/doos/meting', 'idem'],
    ['/api/rtgid/status', 'RTG iD draagt zijn bewijs als idToken in het LIJF, niet als sessie'],
    ['/api/rtgid/wie', 'idem; de kluis geeft alleen attributen op een geldig idToken'],
    ['/api/vracht/volg', 'volgen op een meegestuurde vrachtcode, zoals elke track-and-trace'],

    // ---- gezondheid: moet juist bereikbaar zijn als de rest dat niet is ----
    ['/api/health', 'de gezondheidscheck'],
    ['/api/ready', 'de load balancer moet dit kunnen lezen terwijl de opslagpoort dicht staat'],
    ['/api/pay/gezond', 'idem voor de betaallaag'],

    // ---- de lesmaker: werkt op een meegestuurd profiel, niet op een sessie ----
    ['/api/les/maak', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/leraar', 'idem'], ['/api/les/apps', 'idem'], ['/api/les/volgende', 'idem'],
    ['/api/les/sluit', 'idem'], ['/api/les/mee', 'idem'], ['/api/les/kijk', 'idem'],
    ['/api/les/antwoord', 'idem'],

    // ---- bestaan alleen in NODE_ENV=test ----
    ['/api/test/bug', 'alleen geregistreerd als NODE_ENV=test; bestaat in productie niet'],
    ['/api/test/crash', 'idem']
  ]);

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
  const VERIFIER = /\b(verifyToken|resolveSession|sessionFor|veiligGelijk|verifyActionToken|magAi|scimSleutelOk|magMeten|vanSleutel|accounts\.\w+)\s*\(/;
  const VENSTER = 12;   // regels waarbinnen de verificatie moet volgen
  /* Plekken die de kop bewust lezen zonder te verifieren. Vandaag leeg, en dat
     hoort zo te blijven: wie hier iets toevoegt legt uit waarom betasten hier
     genoeg is. Kun je dat niet, dan is het waarschijnlijk gewoon een gat. */
  const MAG_BETASTEN = new Map([
    ['server/foundation/basis.js:131', 'tokenUit() HAALT alleen het token uit het verzoek; de aanroepers verifieren het. Een extractor is geen beslissing.'],
    ['server/kern/stuur.js:110', 'geeft de kop ONGEWIJZIGD door aan een interne dienst op 127.0.0.1, die zelf verifieert. Hier wordt niets besloten.']
  ]);
  let los = 0, gekeurd = 0;
  loop(path.join(ROOT, 'server'), /\.js$/, f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const regels = stripRegels(fs.readFileSync(f, 'utf8')).split('\n');
    regels.forEach((r, i) => {
      if (!KOP.test(r)) return;
      gekeurd++;
      const plek = rel + ':' + (i + 1);
      if (MAG_BETASTEN.has(plek)) return;
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
   gewoon mee. Dat viel pas op toen wings.e2e.js erop zakte -- in CI, niet hier,
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
    ['kern/kijken.js', 'begrensd: beeldherkenning met eigen harde grenzen, geen pasgesprek'],
    ['kern/kletspraat/gesprek.js', 'kletsspel met eigen opdracht + taalregels, geen pasgesprek'],
    ['kern/leren/overhoren/lijsten.js', 'RTF-onderwijs: overhoorlijsten, geen pasgesprek'],
    ['kern/leren/projecten.js', 'RTF-onderwijs: projecten voor kinderen en gezinnen, geen pasgesprek'],
    ['kern/leren/schrijven.js', 'RTF-onderwijs: schrijfcoach, geen pasgesprek'],
    ['kern/lesmaker.js', 'RTF-onderwijs: lesontwerper, geen pasgesprek'],
    ['kern/markt/toezicht.js', 'begrensd: advertentietekst schrijven'],
    ['kern/office/delen.js', 'RTG Office werk-tool met vaste opdrachtenlijst, geen pasgesprek'],
    ['kern/onboarding/beheer.js', 'JSON-config voor een beheerder (intakevelden/contract), geen lid-gesprek'],
    ['kern/overheid/belasting.js', 'JSON-uitvoer: belastingberekening, geen vrije tekst naar een lid'],
    ['kern/pakketten.js', 'begrensd: advies op basis van uitsluitend het meegegeven pakket'],
    ['kern/reisbureau.js', 'JSON-uitvoer + eigen boekingsregel (nooit "al geboekt")'],
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
    ['routes/techniek/diagnose.js', 'techniek/eigenaar-gereedschap (diagnose/herstel), geen lid-gesprek'],
    ['routes/techniek/functie.js', 'techniek/eigenaar-gereedschap, geen lid-gesprek'],
    ['translate.js', 'vertaalmachine, geen gesprek'],
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
    if (!gevonden) ok('de laatste commit draagt geen ijk- of mutatierestant');
  }
}

console.log(fouten ? `\nNIET OK: ${fouten} probleem(en).` : '\nAlles in orde.');
process.exit(fouten ? 1 : 0);
