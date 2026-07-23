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
    const gids = appgids.gidsVan('/' + rel);
    if (!gids || gids.algemeen) { np++; fout('9+: geen eigen app-gids voor /' + rel + ' (vul kern/appgids.js aan)'); }
  }
  if (!np) ok(paginas.length + ' app-pagina\'s voldoen aan de 9+-basis (taal, viewport, titel, favicon, landmark, basis-laag, eigen gids)');
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

console.log(fouten ? `\nNIET OK: ${fouten} probleem(en).` : '\nAlles in orde.');
process.exit(fouten ? 1 : 0);
