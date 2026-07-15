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

console.log(fouten ? `\nNIET OK: ${fouten} probleem(en).` : '\nAlles in orde.');
process.exit(fouten ? 1 : 0);
