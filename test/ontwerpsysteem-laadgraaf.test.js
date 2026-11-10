'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const os = require('../scripts/ontwerpsysteem');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');

test('lokale dynamische src, laadcall en array worden gevolgd en gededupliceerd', () => {
  assert.deepEqual(os.lokaleScriptVerwijzingen(`
    s.src='/shared/a.js?v=1'; laad('/shared/a.js?v=2');
    ['/shared/b.js','/ds/bediening.css'].forEach(laad);
    // laad('/shared/commentaar.js');
    s.src='https://voorbeeld.test/shared/extern.js';
    s.src='/shared/' + naam + '.js';
  `), ['/shared/a.js', '/shared/b.js', '/ds/bediening.css']);
});

test('werkelijke Rahul en handenvrij-deelketens blijven statisch bereikbaar', () => {
  for (const [bron, doel] of [
    ['public/shared/metgezel.js', '/shared/rahul-tab.js'],
    ['public/shared/metgezel.js', '/shared/handenvrij.js'],
    ['public/shared/rahul-tab.js', '/shared/rahul-tab/style-base.js'],
    ['public/shared/rahul-tab/style-base.js', '/shared/rahul-tab/style-twin.js'],
    ['public/shared/handenvrij.js', '/shared/handenvrij-balk.js'],
    ['public/shared/handenvrij-balk.js', '/shared/handenvrij-chat.js']
  ]) assert.ok(os.lokaleScriptVerwijzingen(lees(bron)).includes(doel), bron + ' -> ' + doel);
});

test('Foundation-sessie houdt gedeelde deur en wereldschil statisch herleidbaar', () => {
 const bron=lees('public/apps/foundation/sessie.js');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 for(const href of ['/shared/deur.js','/shared/wereldschil.js'])
  assert.ok(analyse.verwijzingen.some(x=>x.href===href&&x.soort==='dom'),href);
 assert.ok(analyse.uitgesloten.includes('/shared/wereldschil.css'));
 assert.ok(!analyse.onzeker.some(x=>/deur\.js|wereldschil\.js/.test(x)),JSON.stringify(analyse));
});

test('echte DS-splitsing sluit legacy-injectie uit maar houdt de bronratel zichtbaar', () => {
  const base = lees('public/shared/rahul-tab/style-base.js');
  const twin = lees('public/shared/rahul-tab/style-twin.js');
  const ds = os.scriptLaadAnalyse(base, { ds: true });
  assert.equal(ds.injecties, 0, 'de eigenaarstaat gebruikt nu canonieke CSS');
  assert.equal(os.scriptLaadAnalyse(base, { ds: false }).injecties, 1);
  assert.deepEqual(ds.uitgesloten, ['/shared/rahul-tab/style-twin.js']);
  assert.equal(ds.verwijzingen.length, 0);
  assert.equal(os.scriptLaadAnalyse(twin, { ds: true }).injecties, 0);
  assert.equal(os.scriptLaadAnalyse(twin, { ds: false }).injecties, 1);
  assert.equal(os.telInjectie(base), 1, 'bronratel telt ook uitgesloten legacycode');
  assert.equal(os.telInjectie(twin), 1);
  assert.equal(os.scriptLaadAnalyse(lees('public/shared/handenvrij-chat.js'), { ds: true }).injecties, 0);
  assert.equal(os.scriptLaadAnalyse(lees('public/shared/handenvrij-chat.js'), { ds: false }).injecties, 0,
    'handenvrij-chat gebruikt ook buiten de DS-detectie uitsluitend de centrale presentatie');
  assert.ok(!os.lokaleScriptVerwijzingen(lees('public/shared/metgezel.js')).some(x => x.startsWith('/shared/metgezel/')), 'bundelparts zijn geen extra runtimeimports');
});

test('workerregistratie volgt geen precache; echte DOM-load van hetzelfde pad blijft staan', () => {
  const a = os.scriptLaadAnalyse(`
    navigator.serviceWorker.register('/apps/foundation/sw.js');
    new Worker('/shared/werker.js'); new SharedWorker('/shared/gedeeld.js');
  `);
  assert.equal(a.verwijzingen.length, 0);
  assert.deepEqual(a.vermeld, ['/apps/foundation/sw.js', '/shared/werker.js', '/shared/gedeeld.js']);
  const basis = os.scriptLaadAnalyse(lees('public/shared/basis.js'), { ds: true });
  assert.ok(basis.vermeld.includes('/apps/foundation/sw.js'));
  assert.ok(!basis.verwijzingen.some(v => v.href === '/apps/foundation/sw.js'));
  assert.ok(os.lokaleScriptVerwijzingen(lees('public/apps/foundation/sw.js')).includes('/shared/rtg-world-desktop.css'), 'cacheasset blijft voor de wezeninventaris genoemd');
  const beide = os.scriptLaadAnalyse(`navigator.serviceWorker.register('/apps/foundation/sw.js');
    const s=document.createElement('script');s.src='/apps/foundation/sw.js';`);
  assert.deepEqual(beide.verwijzingen, [{ href: '/apps/foundation/sw.js', soort: 'dom' }]);
});

test('transitieve echte script- en CSS-load blijft zichtbaar; onbekende loader blijft onzeker', () => {
  const a = os.scriptLaadAnalyse(`const s=document.createElement('script');s.src='/shared/kind.js';`);
  const b = os.scriptLaadAnalyse(`const l=document.createElement('link');l.href='/shared/kind.css';document.createElement('style');`);
  assert.deepEqual(a.verwijzingen, [{ href: '/shared/kind.js', soort: 'dom' }]);
  assert.deepEqual(b.verwijzingen, [{ href: '/shared/kind.css', soort: 'dom' }]);
  assert.equal(b.injecties, 1);
  const onbekend = os.scriptLaadAnalyse(`laad('/shared/kind.js'); const s=document.createElement('script');s.src='/shared/'+naam+'.js';`);
  assert.deepEqual(onbekend.verwijzingen, [{ href: '/shared/kind.js', soort: 'mogelijk' }]);
  assert.ok(onbekend.onzeker.some(x => x.includes('URL zonder bewezen DOM-load')));
  assert.ok(onbekend.onzeker.some(x => x.includes('Berekende src/href')));
});

test('dsPoort vraagt de werkelijke guard en is geen whitelist', () => {
  const poort = ['/shared/oud.css'];
  const code = `(function(){var ds=document.documentElement.hasAttribute('data-ds');
    if(!ds){const l=document.createElement('link');l.href='/shared/oud.css';document.createElement('style');}})();`;
  const ds = os.scriptLaadAnalyse(code, { ds: true, poort });
  assert.deepEqual(ds.uitgesloten, poort); assert.equal(ds.injecties, 0); assert.equal(ds.verwijzingen.length, 0);
  const mutant = os.scriptLaadAnalyse(code.replace('if(!ds)', 'if(anders)'), { ds: true, poort });
  assert.equal(mutant.verwijzingen.length, 1); assert.equal(mutant.injecties, 1);
  assert.ok(mutant.onzeker.includes('dsPoort niet lokaal bewezen: /shared/oud.css'));
  assert.equal(os.scriptLaadAnalyse(code, { ds: false, poort }).verwijzingen.length, 1);
});

test('voorwaardelijke, gewijzigde of anders gescopeerde DS-alias mag niets wegfilteren', () => {
  for (const setup of [
    `if(vlag){var ds=document.documentElement.hasAttribute('data-ds');}`,
    `var ds=document.documentElement.hasAttribute('data-ds');ds=false;`,
    `var ds=document.documentElement.hasAttribute('data-ds');function later(ds){`
  ]) {
    const code = `(function(){${setup}if(!ds){document.createElement('style');}${setup.includes('function later') ? '}' : ''}})();`;
    const a = os.scriptLaadAnalyse(code, { ds: true });
    assert.ok(a.injecties + a.mogelijkeInjecties > 0, setup);
  }
  const indirect = os.scriptLaadAnalyse(`(function(){var ds=document.documentElement.hasAttribute('data-ds');function laad(){const l=document.createElement('link');l.href='/shared/oud.css';}if(!ds)laad();})()`, { ds: true, poort: ['/shared/oud.css'] });
  assert.equal(indirect.verwijzingen[0].soort, 'mogelijk', 'geen nieuwe callgraph-inferentie');
  assert.ok(indirect.onzeker.length > 0);
});

test('dezelfde URL in een uitgesloten tak en een template wordt niet stil kwijtgeraakt', () => {
  const a = os.scriptLaadAnalyse("if(!document.documentElement.hasAttribute('data-ds')){laad('/shared/a.js')}laad(`/shared/a.js`)", { ds: true });
  assert.ok(a.uitgesloten.includes('/shared/a.js'));
  assert.ok(a.verwijzingen.some(v => v.href === '/shared/a.js'));
  assert.ok(a.onzeker.length > 0);
});

test('benoemde functie sluit alleen haar eigen aantoonbaar onbereikbare DS-tak uit', () => {
  const bron = `function stijl(){'use strict';if(document.documentElement.hasAttribute('data-ds'))return;
    const l=document.createElement('link');l.href='/shared/oud.css';document.createElement('style');}stijl();`;
  const a = os.scriptLaadAnalyse(bron, { ds: true });
  assert.deepEqual(a.uitgesloten, ['/shared/oud.css']);
  assert.equal(a.injecties + a.mogelijkeInjecties, 0);
  assert.deepEqual(a.onzeker, []);
  for (const tegen of [
    bron.replace("hasAttribute('data-ds')", "hasAttribute('anders')"),
    bron.replace('return;', 'doorgaan();'),
    bron.replace('function stijl()', 'function stijl(document)'),
    bron.replace("'use strict';", "document.documentElement.hasAttribute=()=>false;"),
    `function guard(){if(document.documentElement.hasAttribute('data-ds'))return;}
      function stijl(){guard();document.createElement('style');}`
  ]) {
    const b = os.scriptLaadAnalyse(tegen, { ds: true });
    assert.ok(b.injecties + b.mogelijkeInjecties > 0, tegen);
  }
  assert.ok(os.scriptLaadAnalyse(bron, { ds: false }).mogelijkeInjecties > 0);
});

test('onleesbare bron en onbekende legacy-paden blijven blokkerend, ook in DS', () => {
  const a = os.scriptLaadAnalyse(`function kapot( { laad('/shared/a.js')`, { ds: true });
  assert.ok(a.onzeker.some(x => x.includes('niet volledig geparseerd')));
  assert.deepEqual(a.verwijzingen, [{ href: '/shared/a.js', soort: 'mogelijk' }]);
  const meting = { paginas: { 'public/apps/wonen.html': { ds: true, bladen: [], injecteert: [], stijlblok: false, erfenis: 0, mogelijkeErfenis: 0, mogelijkeBladen: [], mogelijkeInjectie: [], onzeker: ['berekende laadbron'] } } };
  assert.ok(os.contractFouten(meting).some(x => x.includes('wonen.html: onbesliste laadgraaf')));
});

test('DS-context geldt uitsluitend met expliciet html-attribuut', () => {
  assert.equal(os.dsVoorScript('<html data-ds><script src="/shared/a.js"></script>', '/shared/a.js'), true);
  const html = '<script src="/shared/voor.js"></script><script src="/ds/shell.js"></script><script src="/shared/na.js"></script>';
  assert.equal(os.dsVoorScript(html, '/shared/voor.js'), false);
  assert.equal(os.dsVoorScript(html, '/shared/na.js'), false);
  assert.equal(os.dsVoorScript(html.replace('src="/ds/shell.js"', 'defer src="/ds/shell.js"'), '/shared/na.js'), false);
  assert.equal(os.dsVoorScript(html.replace('src="/ds/shell.js"', 'async src="/ds/shell.js"'), '/shared/na.js'), false);
  assert.equal(os.dsVoorScript('<script src="/shared/na.js" defer></script><script src="/ds/shell.js"></script>', '/shared/na.js'), false);
  assert.equal(os.dsVoorScript(html.replace('src="/ds/shell.js"', 'type="text/plain" src="/ds/shell.js"'), '/shared/na.js'), false);
  assert.equal(os.dsVoorScript('<!--<script src="/ds/shell.js"></script>--><script src="/shared/na.js"></script>', '/shared/na.js'), false);
  assert.equal(os.dsVoorScript('<!-- <!-- --><html data-ds><script src="/shared/na.js"></script>', '/shared/na.js'), false);
  assert.equal(os.dsVoorScript('<!-- ongesloten <html data-ds><script src="/shared/na.js"></script>', '/shared/na.js'), false);
  assert.equal(os.dsVoorScript('<script>const voorbeeld=\'<script src="/ds/shell.js">\';</script><script src="/shared/na.js"></script>', '/shared/na.js'), false);
  assert.equal(os.dsVoorScript('<script src="/shared/defer.js" data-naam="defer"></script><script src="/ds/shell.js"></script>', '/shared/defer.js'), false);
});

/* De echte meet()-traversal op een klein uitsluitend in-memory bestandssysteem.
   Geen platforminventaris, geen gegenereerd register, geen browser. */
function fixtureMeting(kind, opties = {}) {
  const bestanden = new Map(Object.entries({
    'public/apps/proef.html': opties.html || '<html data-ds><head><link href="/ds/rtg-ds.css"><script src="/ds/shell.js"></script><script src="/shared/start.js"></script></head></html>',
    'server/middleware/kopinjectie.js': lees('server/middleware/kopinjectie.js'),
    'public/shared/foutmelder.js': '',
    'public/shared/hand.js': '',
    'public/shared/sprong.js': opties.sprong || '',
    'public/ds/rtg-ds.css': '@layer rtg.component {}',
    'public/ds/shell.js': "if(!document.documentElement.hasAttribute('data-ds'))return;",
    'public/ds/contract.json': JSON.stringify({ overgangsscripts: [], dsPoort: { 'public/shared/start.js': ['/shared/legacy.css'] } }),
    'public/shared/start.js': `const ds=document.documentElement.hasAttribute('data-ds');
      if(!ds){const l=document.createElement('link');l.href='/shared/legacy.css';}
      navigator.serviceWorker.register('/apps/foundation/sw.js');
      const s=document.createElement('script');s.src='/shared/kind.js';`,
    'public/shared/kind.js': kind,
    'public/apps/foundation/sw.js': "const SHELL=['/shared/cache.css'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>c.addAll(SHELL))));",
    'public/shared/legacy.css': '.oud { display:block; }',
    'public/shared/actief.css': '.actief { display:block; }',
    'public/shared/cache.css': '.cache { display:block; }'
  }).map(([p, bron]) => [path.join(root, p), bron]));
  if (opties.ontbreekt) bestanden.delete(path.join(root, 'server/middleware/kopinjectie.js'));
  const directory = p => [...bestanden.keys()].some(k => k.startsWith(p + path.sep));
  const fakeFs = {
    existsSync: p => bestanden.has(p) || directory(p),
    statSync: p => ({ isDirectory: () => directory(p) }),
    readdirSync: p => [...new Set([...bestanden.keys()].filter(k => k.startsWith(p + path.sep)).map(k => k.slice(p.length + 1).split(path.sep)[0]))],
    readFileSync: p => { assert.ok(bestanden.has(p), 'fixturebestand ontbreekt: ' + p); return bestanden.get(p); }
  };
  const realRequire = createRequire(path.join(root, 'scripts/ontwerpsysteem.js'));
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: n => n === 'fs' ? fakeFs :
    n.endsWith('/server/middleware/kopinjectie.js') && opties.renderer ? { kopinjecties: opties.renderer } : realRequire(n),
    __dirname: path.join(root, 'scripts'), Buffer, process });
  vm.runInContext(lees('scripts/ontwerpsysteem.js'), context);
  return JSON.parse(JSON.stringify(module.exports.meet()));
}

test('expliciete documentgrens bepaalt DS; een shellscript alleen blijft fail-closed', () => {
  const sprong = "(function(){if(document.documentElement.hasAttribute('data-ds'))return;document.createElement('style');})();";
  const schoon = fixtureMeting('', { sprong });
  assert.ok(schoon.gemigreerd.includes('public/apps/proef.html'), 'expliciete DS-grens sluit legacy Sprong uit');
  const zonderGrens = fixtureMeting('', { sprong,
    html: '<html><head><link href="/ds/rtg-ds.css"><script src="/ds/shell.js"></script><script src="/shared/start.js"></script></head></html>' });
  assert.ok(!zonderGrens.gemigreerd.includes('public/apps/proef.html'));
  const pagina = zonderGrens.paginas['public/apps/proef.html'];
  assert.ok(pagina.onzeker.length || pagina.injecteert.length || pagina.mogelijkeInjectie.length);
});

test('echte laadgraaf scheidt worker-cache, dode DS-tak en actieve transitieve CSS', () => {
  const m = fixtureMeting("const l=document.createElement('link');l.href='/shared/actief.css';");
  const p = m.paginas['public/apps/proef.html'];
  assert.deepEqual(p.bladen, ['public/ds/rtg-ds.css', 'public/shared/actief.css']);
  assert.equal(p.erfenis, 1); assert.equal(p.mogelijkeErfenis, 0);
  assert.ok(!m.gemigreerd.includes('public/apps/proef.html'));
  assert.ok(!m.geladenDoor['public/shared/cache.css']);
  assert.ok(!m.wezen.includes('public/shared/cache.css'), 'precache blijft in broninventaris bewaard');
  assert.equal(m.injectie['public/shared/start.js'], 1, 'globale ratel houdt de legacy-CSS-verwijzing');
});

test('echte laadgraaf laat alleen aantoonbaar schoon door; onbekende bron blijft open', () => {
  const schoon = fixtureMeting("(function(){if(document.documentElement.hasAttribute('data-ds'))return;document.createElement('style');})();");
  assert.ok(schoon.gemigreerd.includes('public/apps/proef.html'));
  assert.equal(schoon.injectie['public/shared/kind.js'], 1, 'uitgesloten injectie blijft in per-bestandratel');
  for (const code of ["laad('/shared/actief.css');", 'function kapot(']) {
    const m = fixtureMeting(code), p = m.paginas['public/apps/proef.html'];
    assert.ok(!m.gemigreerd.includes('public/apps/proef.html'));
    assert.ok(p.onzeker.length > 0);
    if (code.startsWith('laad')) { assert.deepEqual(p.mogelijkeBladen, ['public/shared/actief.css']); assert.equal(p.mogelijkeErfenis, 1); }
  }
});

test('destructuring en for-in/of kunnen DS-alias wijzigen en houden injectie zichtbaar', () => {
  for (const wijziging of [
    '({ds}={ds:false});', '[ds]=[false];',
    'for(ds of [false]){}', 'for(ds in {oud:1}){}'
  ]) {
    const a=os.scriptLaadAnalyse(`let ds=document.documentElement.hasAttribute('data-ds');${wijziging}if(!ds){document.createElement('style');}`, { ds: true });
    assert.ok(a.injecties+a.mogelijkeInjecties>0, wijziging);
  }
});

test('relatieve lokale laadadressen blokkeren tot hun basis aantoonbaar is', () => {
  for(const adres of ['./kind.js', '../oud.css', 'kind.js', '/anders/kind.js']) {
    const a=os.scriptLaadAnalyse(`const s=document.createElement('script');s.src=${JSON.stringify(adres)};`, {ds:true});
    assert.ok(a.onzeker.some(x=>x.includes('Lokaal laadadres niet herleid')), adres);
    const m=fixtureMeting(`const s=document.createElement('script');s.src=${JSON.stringify(adres)};`);
    assert.ok(!m.gemigreerd.includes('public/apps/proef.html'), adres);
  }
});

test('overschaduwde of herschreven workerbindings mogen DOM-laadpaden niet uitsluiten', () => {
  for(const code of [
    `const Worker=window.laadScript;new Worker('/shared/kind.js');`,
    `function later(Worker){new Worker('/shared/kind.js');}`,
    `Worker=laad;new Worker('/shared/kind.js');`,
    `Worker=laad;new window.Worker('/shared/kind.js');`,
    `window.Worker=laad;new Worker('/shared/kind.js');`,
    `window.Worker=laad;new window.Worker('/shared/kind.js');`,
    `const navigator=anders;navigator.serviceWorker.register('/shared/kind.js');`,
    `navigator.serviceWorker.register=laad;navigator.serviceWorker.register('/shared/kind.js');`
  ]) {
    const a=os.scriptLaadAnalyse(code, {ds:true});
    assert.equal(a.vermeld.length,0,code);
    assert.ok(a.verwijzingen.some(v=>v.href==='/shared/kind.js'),code);
    assert.ok(a.onzeker.some(x=>x.includes('Worker-binding niet bewezen')),code);
  }
});


test('herschreven DS-test of ancestor kan geen werkelijke injectie wegfilteren', () => {
  for (const wijziging of [
    'document.documentElement.hasAttribute=()=>false;',
    'document.documentElement={hasAttribute:()=>false};',
    'window.document={documentElement:{hasAttribute:()=>false}};',
    'globalThis.document.documentElement.hasAttribute=()=>false;'
  ]) {
    const a=os.scriptLaadAnalyse(`(function(){${wijziging}if(document.documentElement.hasAttribute('data-ds'))return;document.createElement('style');})()`, {ds:true});
    assert.ok(a.injecties+a.mogelijkeInjecties>0, wijziging);
  }
});

test('directe onveranderlijke IIFE-documentparameter bewijst alleen zijn eigen DS-guard',()=>{
 for(const code of [
  `(function(d){if(d.documentElement.hasAttribute('data-ds'))return;document.createElement('style');})(document);`,
  `(function(w,d){if(d.documentElement.hasAttribute('data-ds'))return;document.createElement('style');})(window,window.document);`,
  `((doc)=>{if(doc.documentElement&&doc.documentElement.hasAttribute('data-ds'))return;document.createElement('style');})(document);`
 ]){const a=os.scriptLaadAnalyse(code,{ds:true});assert.equal(a.injecties+a.mogelijkeInjecties,0,code);assert.equal(a.onzeker.length,0,code);const legacy=os.scriptLaadAnalyse(code,{ds:false});assert.ok(legacy.injecties+legacy.mogelijkeInjecties>0);}
});
test('onzekere documentparameter, shadowing, mutatie en indirecte aanroep blijven zichtbaar',()=>{
 const style=`document.createElement('style');`,guard=`if(d.documentElement.hasAttribute('data-ds'))return;`;
 for(const code of [
  `(function(d){${guard}${style}})(anders);`,
  `(function(d){${guard}${style}})();`,
  `(function(d){${guard}${style}})(...lijst);`,
  `function start(d){${guard}${style}}start(document);`,
  `(function(d=document){${guard}${style}})();`,
  `(function({d}){${guard}${style}})({d:document});`,
  `(function(d){${guard}${style}var d;})(document);`,
  `(function(d){d=anders;${guard}${style}})(document);`,
  `(function(d){({d}={d:anders});${guard}${style}})(document);`,
  `(function(d){for(d of lijst){}${guard}${style}})(document);`,
  `(function(d){arguments[0]=anders;${guard}${style}})(document);`,
  `(function(d){verander(d);${guard}${style}})(document);`,
  `(function(d){const kopie=d;${guard}${style}})(document);`,
  `(function(d){eval('d=anders');${guard}${style}})(document);`,
  `(function(d){function later(d){${guard}${style}}later(anders);})(document);`,
  `(function(d){function later(){${guard}${style}}later();})(document);`,
  `(function(d){const ds=d.documentElement.hasAttribute('data-ds');function later(){if(ds)return;${style}}later();})(document);`,
  `const document=anders;(function(d){${guard}${style}})(document);`,
  `const window=anders;(function(d){${guard}${style}})(window.document);`,
  `(function(d){Object.defineProperty(d.documentElement,'hasAttribute',{value:()=>false});${guard}${style}})(document);`,
  `Object.defineProperty(document.documentElement,'hasAttribute',{value:()=>false});(function(d){${guard}${style}})(document);`,
  `(function(d){d.documentElement.hasAttribute=()=>false;${guard}${style}})(document);`,
  `(function(d){delete d.documentElement.hasAttribute;${guard}${style}})(document);`,
  `(function(d){d.documentElement={hasAttribute:()=>false};${guard}${style}})(document);`,
  `document.documentElement.hasAttribute=()=>false;(function(d){${guard}${style}})(document);`,
  `window.document=anders;(function(d){${guard}${style}})(window.document);`,
  `(function(d){d.documentElement.removeAttribute('data-ds');${guard}${style}})(document);`
 ]){const a=os.scriptLaadAnalyse(code,{ds:true});assert.ok(a.injecties+a.mogelijkeInjecties>0,code);}
});


test('IIFE-alias subobjectescape en berekende members blijven in conditionele tak zichtbaar',()=>{
 for(const voor of [
  "const kopie=d.documentElement;kopie.hasAttribute=()=>false;",
  "d.documentElement['has'+'Attribute']=()=>false;",
  "const doos={kopie:d.documentElement};doos.kopie.hasAttribute=()=>false;",
  "d.documentElement.hasAttribute=()=>false;",
  "d.documentElement={hasAttribute:()=>false};",
  "delete d.documentElement.hasAttribute;",
  "Object.defineProperty(d.documentElement,'hasAttribute',{value:()=>false});",
  "Object.assign(d.documentElement,{hasAttribute:()=>false});",
  "d=anders;",
  "({d}={d:anders});",
  "arguments[0]=anders;",
  "const kopie=d;kopie.documentElement.hasAttribute=()=>false;",
  "const [kopie]=[d.documentElement];kopie.hasAttribute=()=>false;"
 ]){const code=`(function(d){${voor}if(!d.documentElement.hasAttribute('data-ds')){document.createElement('style');}})(document);`;const a=os.scriptLaadAnalyse(code,{ds:true});assert.ok(a.injecties+a.mogelijkeInjecties>0,code);}
});

test('bewezen lokale anker-href is navigatie/download, geen stijlbron',()=>{
 for(const href of ["URL.createObjectURL(new Blob(['x']))","URL.createObjectURL(await r.blob())","'#'+doel.id","'/shared/actief.css'","'../oud.css'"]){
  const a=os.scriptLaadAnalyse(`function bewaar(){const a=document.createElement('a');a.href=${href};document.body.appendChild(a);a.click();}`,{ds:true});
  assert.deepEqual(a.onzeker,[],href);assert.equal(a.verwijzingen.length,0);assert.equal(a.injecties+a.mogelijkeInjecties,0);
  if(href.includes('/shared/'))assert.ok(a.vermeld.includes('/shared/actief.css'));
 }
 const m=fixtureMeting("const a=document.createElement('a');a.href='/shared/actief.css';");
 assert.ok(m.gemigreerd.includes('public/apps/proef.html'));assert.ok(!m.wezen.includes('public/shared/actief.css'));assert.ok(!m.paginas['public/apps/proef.html'].bladen.includes('public/shared/actief.css'));
 const menu=os.scriptLaadAnalyse("const a=document.createElement('a');a.href='/apps/'+pad;a.append(tekst);menu.appendChild(a);",{ds:true});
 assert.deepEqual(menu.onzeker,[],'een latere menuplaatsing verandert een native anker niet in een stylesheetloader');
 const iife=os.scriptLaadAnalyse("(function(d){function menu(){const link=document.createElement('a');link.href='/apps/'+pad;host.appendChild(link);}})(document);",{ds:true});
 assert.deepEqual(iife.onzeker,[],'het documentargument van de eigen directe IIFE is geen onbekende documentontsnapping');
 const tryBlok=os.scriptLaadAnalyse("async function download(){try{const link=document.createElement('a');link.href=URL.createObjectURL(await r.blob());document.body.appendChild(link);link.click();}catch(e){meld(e)}}",{ds:true});
 assert.deepEqual(tryBlok.onzeker,[],'een lokaal downloadanker blijft ook binnen zijn eigen try-blok bewezen');
});
test('onzekere ankeridentiteit of native DOM-mutatie blijft een berekende laadbron',()=>{
 for(const code of [
  "const a=document.createElement(tag);a.href=pad;",
  "let a=document.createElement('a');a=document.createElement('link');a.href=pad;",
  "const a=document.createElement('link');a.href=pad;",
  "const a=document.createElement('script');a.src=pad;",
  "const a=document.createElement('a');a.src=pad;",
  "const a=document.createElement('a');a['h'+'ref']=pad;",
  "const a=document.createElement('a');function later(a){a.href=pad;}",
  "const a=document.createElement('a');function later(){a.href=pad;}",
  "function f(){a.href=pad;var a=document.createElement('a');}",
  "let a;if(voorwaarde)a=document.createElement('a');a.href=pad;",
  "document.createElement=anders;const a=document.createElement('a');a.href=pad;",
  "const doc=document;doc.createElement=anders;const a=document.createElement('a');a.href=pad;",
  "const doos={doc:document};doos.doc.createElement=anders;const a=document.createElement('a');a.href=pad;",
  "document['create'+'Element']=anders;const a=document.createElement('a');a.href=pad;",
  "Object.defineProperty(document,'createElement',{value:anders});const a=document.createElement('a');a.href=pad;",
  "const a=document.createElement('a');const b=a;b.href=pad;",
  "const a=document.createElement('a');Object.defineProperty(a,'href',{set:laad});a.href=pad;",
  "const a=document.createElement('a');onbekend(a);a.href=pad;"
 ]){const a=os.scriptLaadAnalyse(code,{ds:true});assert.ok(a.onzeker.some(s=>s.includes('Berekende src/href')),code);}
});

test('eerste native iframe-src is documentnavigatie, geen stylesheetload',()=>{
 const goed=os.scriptLaadAnalyse("function open(url){const frame=document.createElement('iframe');frame.src=url;host.appendChild(frame);}",{ds:true});
 assert.deepEqual(goed.onzeker,[]);assert.deepEqual(goed.verwijzingen,[]);
 const lokaal=os.scriptLaadAnalyse("const frame=document.createElement('iframe');frame.src='/apps/blad.js';host.appendChild(frame);",{ds:true});
 assert.deepEqual(lokaal.onzeker,[]);assert.deepEqual(lokaal.verwijzingen,[]);assert.ok(lokaal.vermeld.includes('/apps/blad.js'));
 for(const code of [
  "const frame=maak('iframe');frame.src=url;",
  "let frame=document.createElement('iframe');frame=ander;frame.src=url;",
  "const frame=document.createElement(tag);frame.src=url;",
  "document.createElement=ander;const frame=document.createElement('iframe');frame.src=url;",
  "const frame=document.createElement('iframe');gebruik(frame);frame.src=url;",
  "const frame=document.createElement('script');frame.src=url;",
  "const frame=document.createElement('link');frame.href=url;"
 ])assert.ok(os.scriptLaadAnalyse(code,{ds:true}).onzeker.some(s=>s.includes('Berekende src/href')),code);
});

test('bewezen native img-src is een beeldbron en geen documentloader',()=>{
 for(const code of [
  "const img=document.createElement('img');img.alt='Voorbeeld';img.src=dataUrl;host.appendChild(img);",
  "const img=new Image();img.onerror=mis;img.onload=verwerk;img.src=dataUrl;function verwerk(){}",
  "const img=window.document.createElement('img');img.loading='lazy';img.src='/shared/beeld.css';document.body.appendChild(img);",
  "function open(){const crop=document.createElement('div'),preview=document.createElement('img');crop.appendChild(preview);function paint(){preview.src=bron;}}"
 ]){const r=os.scriptLaadAnalyse(code,{ds:true});assert.deepEqual(r.onzeker,[],code);assert.deepEqual(r.verwijzingen,[],code);}
 const vermeld=os.scriptLaadAnalyse("const img=document.createElement('img');img.src='/shared/beeld.css';",{ds:true});
 assert.ok(vermeld.vermeld.includes('/shared/beeld.css'));
 for(const code of [
  "const img=maak('img');img.src=dataUrl;",
  "let img=document.createElement('img');img=ander;img.src=dataUrl;",
  "document.createElement=ander;const img=document.createElement('img');img.src=dataUrl;",
  "const Image=ander;const img=new Image();img.src=dataUrl;",
  "const img=document.createElement('img');gebruik(img);img.src=dataUrl;",
  "function open(){const crop=maak('div'),img=document.createElement('img');crop.appendChild(img);function paint(){img.src=bron;}}",
  "function open(){const crop=document.createElement('div'),img=document.createElement('img');crop.appendChild=ander;crop.appendChild(img);function paint(){img.src=bron;}}",
  "const img=document.createElement('img');Object.defineProperty(img,'src',{set:laad});img.src=dataUrl;",
  "const img=document.createElement('img');img.__proto__=ander;img.src=dataUrl;",
  "const img=document.createElement('script');img.src=dataUrl;"
 ])assert.ok(os.scriptLaadAnalyse(code,{ds:true}).onzeker.some(s=>s.includes('Berekende src/href')),code);
});

test('fail-closed HTMLMediaElement-src is een mediabron, geen stylesheetloader',()=>{
 const goed=os.scriptLaadAnalyse(`function kijk(el,pad){if(!(el instanceof HTMLMediaElement))return Promise.resolve({status:400});
  function zet(){el.__rtgKijk={};el.addEventListener('error',()=>{});el.src=pad;}zet();}`,{ds:true});
 assert.deepEqual(goed.onzeker,[]);assert.deepEqual(goed.verwijzingen,[]);
 const tegen=[
  `function kijk(el,pad){el.src=pad;}`,
  `function kijk(el,pad){if(!(el instanceof HTMLElement))return;el.src=pad;}`,
  `function kijk(el,pad){if(!(el instanceof HTMLMediaElement))meld(el);el.src=pad;}`,
  `function kijk(el,pad){if(!(el instanceof HTMLMediaElement))return;const ander=el;el.src=pad;}`,
  `function kijk(el,pad){if(!(el instanceof HTMLMediaElement))return;gebruik(el);el.src=pad;}`,
  `function kijk(el,pad){if(!(el instanceof HTMLMediaElement))return;el.constructor=Ander;el.src=pad;}`,
  `const HTMLMediaElement=Ander;function kijk(el,pad){if(!(el instanceof HTMLMediaElement))return;el.src=pad;}`,
  `HTMLMediaElement.prototype.src=ander;function kijk(el,pad){if(!(el instanceof HTMLMediaElement))return;el.src=pad;}`
 ];
 for(const bron of tegen)assert.ok(os.scriptLaadAnalyse(bron,{ds:true}).onzeker.some(s=>s.includes('Berekende src/href')),bron);
 const werkelijk=os.scriptLaadAnalyse(lees('public/shared/stroom.js'),{ds:true});
 assert.deepEqual(werkelijk.onzeker,[]);
});


test('ankersetters, prototypes en onbekende methodes verbergen geen href-loader',()=>{
 for(const wijziging of [
  "a.__defineSetter__('href',laad);", "a.__proto__=ander;",
  "a['__proto__']=ander;", "a.constructor.prototype.href=pad;",
  "a.onbekend();", "a.click=laad;", "a.remove=laad;",
  "Object.setPrototypeOf(a,ander);", "const proto=a.__proto__;proto.href=pad;"
 ]){
  for(const href of ['pad', "'/shared/actief.css'"]){
   const code=`const a=document.createElement('a');${wijziging}if(voorwaarde){a.href=${href};}`;
   const r=os.scriptLaadAnalyse(code,{ds:true});
   assert.ok(r.onzeker.length>0,code);
   if(href.startsWith("'"))assert.ok(r.verwijzingen.some(v=>v.href==='/shared/actief.css'),code);
  }
 }
});

test('native worker-call classificeert ook root- en relatieve URLs zonder document-CSS te laden',()=>{
 for(const code of [
  "navigator.serviceWorker.register('/sw.js');",
  "window.navigator.serviceWorker.register('./sw.js?v=2');",
  "new Worker('/worker.js');", "new window.SharedWorker('../worker.js');"
 ]){const r=os.scriptLaadAnalyse(code,{ds:true});assert.deepEqual(r.onzeker,[],code);assert.deepEqual(r.verwijzingen,[],code);assert.equal(r.vermeld.length,1,code);}
 for(const code of [
  "const navigator=anders;navigator.serviceWorker.register('/sw.js');",
  "navigator.serviceWorker.register=laad;navigator.serviceWorker.register('/sw.js');",
  "window.navigator=anders;window.navigator.serviceWorker.register('/sw.js');",
  "navigator.serviceWorker[methode]=laad;navigator.serviceWorker.register('/sw.js');",
  "const sw=navigator.serviceWorker;sw.register=laad;navigator.serviceWorker.register('/sw.js');",
  "Object.defineProperty(navigator.serviceWorker,'register',{value:laad});navigator.serviceWorker.register('/sw.js');",
  "function start(Worker){new Worker('./worker.js');}",
  "const Worker=laad;new Worker('/worker.js');",
  "const sw=navigator.serviceWorker;sw.register('/sw.js');"
 ]){const r=os.scriptLaadAnalyse(code,{ds:true});assert.ok(r.onzeker.length,code);assert.equal(r.vermeld.length,0,code);}
});

test('begrensde lokale DOM-loader bewijst alleen letterlijke, niet-ontsnapte script- en stijlcalls',()=>{
 const goed=os.scriptLaadAnalyse(`
   function script(pad){const scriptNode=document.createElement('script');scriptNode.src=pad;scriptNode.async=true;document.head.appendChild(scriptNode)}
   function stijl(pad){const styleNode=document.createElement('link');styleNode.rel='stylesheet';styleNode.href=pad;document.head.appendChild(styleNode)}
   script('/shared/kern.js');stijl('/shared/kern.css');`,{ds:true});
 assert.deepEqual(goed.onzeker,[]);assert.deepEqual(goed.verwijzingen.sort((a,b)=>a.href.localeCompare(b.href)),[
   {href:'/shared/kern.css',soort:'dom'},{href:'/shared/kern.js',soort:'dom'}]);
 for(const code of [
   "function laad(pad){const node=document.createElement('script');node.src=pad;document.head.appendChild(node)}window.laad=laad;laad('/shared/kern.js');",
   "function laad(pad){const node=document.createElement('script');node.src=pad;document.head.appendChild(node)}laad(onbekend);",
   "function laad(pad){const node=document.createElement('script');node.src=pad;houder.appendChild(node)}laad('/shared/kern.js');",
   "document.createElement=ander;function laad(pad){const node=document.createElement('script');node.src=pad;document.head.appendChild(node)}laad('/shared/kern.js');"
 ]) assert.ok(os.scriptLaadAnalyse(code,{ds:true}).onzeker.length,code);
 const werkelijk=os.scriptLaadAnalyse(lees('public/shared/rtg-adaptive-edge-loader.js'),{ds:true});
 assert.deepEqual(werkelijk.onzeker,[]);assert.equal(werkelijk.verwijzingen.length,23);
 assert.ok(werkelijk.verwijzingen.every(v=>v.soort==='dom'));
});

test('native documentnavigatie met vaste veilige prefix is geen berekende stylesheetload',()=>{
 for(const target of ['location.href','window.location.href','globalThis.location.href']){
  const r=os.scriptLaadAnalyse(`${target}='/apps/service-bel.html'+query;`,{ds:true});assert.deepEqual(r.onzeker,[],target);assert.deepEqual(r.verwijzingen,[]);
  const css=os.scriptLaadAnalyse(`${target}='/shared/actief.css';`,{ds:true});assert.deepEqual(css.onzeker,[]);assert.deepEqual(css.verwijzingen,[]);assert.ok(css.vermeld.includes('/shared/actief.css'));
 }
 for(const code of [
  "const location=ander;location.href='/apps/bel.html'+q;",
  "function start(location){location.href='/apps/bel.html'+q;}",
  "window=ander;window.location.href='/apps/bel.html'+q;",
  "window.location=ander;window.location.href='/apps/bel.html'+q;",
  "globalThis.location=ander;location.href='/apps/bel.html'+q;",
  "const doel=location;doel.href='/apps/bel.html'+q;",
  "const l=document.createElement('link');l.href='/apps/bel.html'+q;",
  "location.href=onbekend;", "location.href='javascript:'+code;",
  "location.href=prefix+'/apps/bel.html';"
 ]){const r=os.scriptLaadAnalyse(code,{ds:true});assert.ok(r.onzeker.some(s=>s.includes('Berekende src/href')),code);}
});

test('echte basis verliest alleen bewezen worker- en documentnavigatiemeldingen',()=>{
 const bron=lees('public/shared/basis.js'),r=os.scriptLaadAnalyse(bron,{ds:true});
 assert.match(bron,/navigator\.serviceWorker\.register\('\/sw\.js'\)/);
 assert.match(bron,/location\.href = '\/apps\/service-bel\.html' \+ z/);
 assert.ok(r.vermeld.includes('/sw.js'));
 assert.ok(!r.onzeker.some(s=>s.includes('Lokaal laadadres niet herleid: /sw.js')));
 const regel=bron.slice(0,bron.indexOf("location.href = '/apps/service-bel.html' + z")).split('\n').length;
 assert.ok(!r.onzeker.includes('Berekende src/href op regel '+regel));
 assert.match(bron,/function koppelSpring\(anker, doel\)/);
 assert.match(bron,/anker\.setAttribute\('href', '#' \+ doel\.id\)/);
 assert.ok(!r.onzeker.some(s=>s.includes('Berekende src/href')),'de begrensde bestaande-DOM-springlink blijft een fragmentnavigatie');
 for(const voor of ['wijzig(document);',"window[veld]=ander;"]){const x=os.scriptLaadAnalyse(voor+"const a=document.createElement('a');a.href='#'+id;",{ds:true});assert.ok(x.onzeker.length,voor);}
});

test('Social heeft een statisch herleidbare stijlfallback en begrensde interne routes',()=>{
 const intelligence=os.scriptLaadAnalyse(lees('public/shared/social-intelligence.js'),{ds:true});
 assert.deepEqual(intelligence.onzeker,[]);
 assert.ok(intelligence.verwijzingen.some(v=>v.href==='/shared/social-intelligence.css'&&v.soort==='dom'));
 const suite=os.scriptLaadAnalyse(lees('public/shared/social-suite.js'),{ds:true});
 assert.ok(!suite.onzeker.some(s=>s.includes('Berekende src/href')),suite.onzeker.join('\n'));
});

test('werkelijke Poortgesprek-owner gebruikt op elke host de canonieke DS-presentatie',()=>{
 const bron=lees('public/shared/poortgesprek.js');
 const ds=os.scriptLaadAnalyse(bron,{ds:true});
 assert.deepEqual(ds.onzeker,[]);assert.equal(ds.injecties+ds.mogelijkeInjecties,0);
 assert.ok(ds.uitgesloten.includes('/ds/rtg-ds.css'));
 const legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.ok(legacy.verwijzingen.some(v=>v.href==='/ds/rtg-ds.css'&&v.soort==='dom'));
 assert.doesNotMatch(bron,/poortgesprek-legacy\.css/);
});

test('werkelijke Ondertitelband-owner gebruikt de centrale DS-component',()=>{
 const bron=lees('public/shared/ondertitelband.js');
 const a=os.scriptLaadAnalyse(bron,{ds:false});
 assert.deepEqual(a.onzeker,[]);assert.equal(a.injecties+a.mogelijkeInjecties,0);
 assert.equal(a.verwijzingen.length,0);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|\.textContent\s*=\s*STIJL|ondertitelband\.css/);
 assert.match(lees('public/ds/rtg-ds.css'),/componenten\/ondertitelband\.css/);
 for(const app of ['clips','media','salon','theater','wereld']){
  const html=lees('public/apps/'+app+'.html');
  assert.equal((html.match(/\/shared\/ondertitelband\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/shared\/ondertitelband\.js/g)||[]).length,1,app);
  assert.equal((html.match(/\/ds\/componenten\/ondertitelband\.css/g)||[]).length,1,app);
 }
});

test('werkelijke School-sessie gebruikt de canonieke accountdeur zonder stijlinjectie',()=>{
 const bron=lees('public/shared/rtg-school-session.js');
 const a=os.scriptLaadAnalyse(bron,{ds:false});
 assert.deepEqual(a.onzeker,[]);assert.equal(a.injecties+a.mogelijkeInjecties,0);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|style\.cssText/);
 for(const app of ['foundation/bord','foundation/leren','foundation/school','foundation/schrift','schoolpartner']){
  const html=lees('public/apps/'+app+'.html');
  assert.equal((html.match(/\/ds\/tokens\.css/g)||[]).length,1,app);
  assert.equal((html.match(/\/ds\/componenten\/accountdeur\.css/g)||[]).length,1,app);
 }
 assert.match(bron,/ds-accountdeur ds-accountdeur--school/);
 assert.match(bron,/kind\.inert = true/);
});

test('werkelijke World Home-projectie houdt haar drie bestemmingen bij documentnavigatie',()=>{
 const bron=lees('public/shared/rtg-world-home.js');
 const a=os.scriptLaadAnalyse(bron,{ds:false});
 assert.ok(!a.onzeker.some(s=>s.includes('Berekende src/href')),a.onzeker.join('\n'));
 assert.match(bron,/setAttribute\('href', state === 'guest'/);
 for(const route of ['/apps/app.html','#reizen','/apps/reisbureau.html'])assert.ok(bron.includes(route),route);
});

test('eerste onveranderlijke DS-snapshot mag een latere stijlguard bewijzen vóór eigen documentescape',()=>{
 const bron=`(function(w,d){'use strict';const dsBijStart=document.documentElement.hasAttribute('data-ds');
 function stijl(){if(dsBijStart||d.documentElement.hasAttribute('data-ds'))return;
 const l=document.createElement('link');l.href='/shared/oud.css';document.createElement('style');}
 wijzig(d.documentElement);stijl();})(window,document);`;
 const ds=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/shared/oud.css']);
 const legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.ok(legacy.injecties+legacy.mogelijkeInjecties>0);
 assert.ok(legacy.verwijzingen.some(v=>v.href==='/shared/oud.css'));
 assert.ok(os.telInjectie(bron)>0,'de ruwe bronratel blijft zichtbaar');
});

test('snapshot vereist eerste uitvoering, native read en onoverschaduwde onveranderlijke capture',()=>{
 const read=`document.documentElement.hasAttribute('data-ds')`;
 const body=`const dsBijStart=${read};function stijl(){if(dsBijStart)return;document.createElement('style');}stijl();`;
 const code=`(function(w,d){${body}})(window,document);`;
 const tegen=[
  `wijzig(document.documentElement);${code}`,
  code.replace(`const dsBijStart`, `wijzig(d.documentElement);const dsBijStart`),
  code.replace('const dsBijStart','let dsBijStart'),
  code.replace('const dsBijStart','var dsBijStart'),
  code.replace(read,"document.documentElement.hasAttribute('anders')"),
  code.replace(read,"document.documentElement.hasAttribute('data-ds',wijzig(document.documentElement))"),
  code.replace(read,"d.documentElement.hasAttribute('data-ds')"),
  code.replace('(window,document)','(window,wijzig(document))'),
  code.replace('(w,d)','(w,d=wijzig(document))'),
  code.replace('(w,d)','({w},d)'),
  code.replace('(w,d)','(w,...d)'),
  code.replace('(function(w,d)','(async function(w,d)'),
  code.replace('(function(w,d)','(function* (w,d)'),
  code.replace('(function(w,d)','(function herhaal(w,d)'),
  code.replace('function stijl(){','function stijl(dsBijStart){'),
  code.replace('function stijl(){','function stijl(){dsBijStart=false;'),
  code.replace('function stijl(){','function stijl(){({dsBijStart}=anders);'),
  code.replace('function stijl(){','function stijl(){const dsBijStart=false;'),
  code.replace('function stijl(){','function stijl(){eval(tekst);'),
  code.replace('function stijl(){','function stijl(){gebruik(arguments);'),
  code.replace('function stijl(){if(dsBijStart)return;document.createElement(\'style\');}',
   `function stijl(){try{throw false;}catch(dsBijStart){if(dsBijStart)return;document.createElement('style');}}`),
  code.replace('function stijl(){','function stijl(){class dsBijStart{};'),
  code.replace('function stijl(){','function stijl(){with(anders){if(dsBijStart)return;}'),
  code.replace('(w,d)','(window,d)'),
  code.replace('(w,d)','(w,document)')
 ];
 for(const bron of tegen){const a=os.scriptLaadAnalyse(bron,{ds:true});assert.ok(a.injecties+a.mogelijkeInjecties>0||a.onzeker.length>0,bron);}
 const buiten=os.scriptLaadAnalyse(code+`function elders(){if(dsBijStart)return;document.createElement('style');}`,{ds:true});
 assert.ok(buiten.mogelijkeInjecties>0,'capture geldt niet buiten haar lexicale eigenaar');
});

test('werkelijke Appmenu-owner gebruikt op elke host de canonieke DS-presentatie en bewaakt de late marker',()=>{
 const {bundel}=require('../scripts/bundel');
 const bron=bundel('shared/appmenu.js').toString('utf8');
 assert.match(bron,/function laadAppmenuPresentatie\(pad\)/);
 assert.match(bron,/if \(document\.documentElement\.hasAttribute\('data-ds'\)\) return;/);
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);assert.equal(os.telInjectie(bron),1,'de statische DS-root blijft als laadbron meetbaar');
 // Voer de echte stijl-owner uit met uitsluitend een minimale DOM-poort:
 // legacy blijft laden; ook een pas later gezette DS-marker sluit hem.
 const {parse}=require('../scripts/ast/parser'),{loop}=require('../scripts/ast/walk');
 const functies={};
 loop(parse(bron),n=>{if(n.type==='FunctionDeclaration'&&['laadAppmenuPresentatie','stijl'].includes(n.id?.name))functies[n.id.name]=n;});
 const functie=naam=>{let begin=functies[naam].start;while(typeof begin==='object')begin=begin.start;return bron.slice(begin,functies[naam].end);};
 for(const [eerst,later,aantal] of [[true,true,0],[false,true,0],[false,false,1]]){
  let marker=eerst;const stijlen=[];
  const document={documentElement:{hasAttribute:n=>n==='data-ds'&&marker},getElementById:()=>null,
   createElement:tag=>{assert.equal(tag,'link');return {};},head:{appendChild:s=>stijlen.push(s)}};
  const context=vm.createContext({document,d:document});
  vm.runInContext(`${functie('laadAppmenuPresentatie')}${functie('stijl')}`,context);
  marker=later;vm.runInContext('stijl()',context);
  assert.equal(stijlen.length,aantal,JSON.stringify({eerst,later}));
  if(aantal){assert.equal(stijlen[0].id,'rtgDsRuntimeCss');assert.equal(stijlen[0].rel,'stylesheet');assert.equal(stijlen[0].href,'/ds/rtg-ds.css');}
 }
 assert.doesNotMatch(bron,/appmenu-legacy\.css/);
});

test('no-browser snapshotvorm bewijst alleen de native read en side-effectvrije window/null-argumenten',()=>{
 const read=`typeof document !== 'undefined' && document.documentElement.hasAttribute('data-ds')`;
 const arg=`typeof window !== 'undefined' ? window : null`;
 const code=`(function(root){const dsBijStart=${read};var doc=root.document;
 function stijl(){if(dsBijStart||doc.documentElement.hasAttribute('data-ds'))return;doc.createElement('style');}
 gebruik(doc);stijl();})(${arg});`;
 const goed=os.scriptLaadAnalyse(code,{ds:true});
 assert.equal(goed.injecties+goed.mogelijkeInjecties,0);assert.deepEqual(goed.onzeker,[]);
 assert.ok(os.scriptLaadAnalyse(code,{ds:false}).mogelijkeInjecties>0);
 const tegen=[
  code.replace(read,read.replace("!== 'undefined'","=== 'undefined'")),
  code.replace(read,read.replace("!== 'undefined'","!= 'undefined'")),
  code.replace(read,read.replace('&&','||')),
  code.replace(read,read.replace('typeof document','typeof doc')),
  code.replace(read,read.replace('document.documentElement','root.document.documentElement')),
  code.replace(read,read.replace('document.documentElement','doc.documentElement')),
  code.replace(read,`(wijzig(document),${read})`),
  code.replace(arg,`typeof window !== 'undefined' ? root : null`),
  code.replace(arg,`typeof window !== 'undefined' ? window : wijzig(document)`),
  code.replace(arg,`typeof window === 'undefined' ? window : null`),
  code.replace(arg,`typeof window !== 'undefined' ? wijzig(window) : null`),
  code.replace(arg,`typeof root !== 'undefined' ? window : null`),
  code.replace('(function(root)','(function(document)'),
  code.replace('(function(root)','(function(window)'),
  code.replace('const dsBijStart','var document=anders;const dsBijStart'),
  code.replace('const dsBijStart','var doc=document;wijzig(doc);const dsBijStart'),
  code.replace('const dsBijStart',"var doc=document;doc.documentElement.hasAttribute=()=>false;const dsBijStart"),
  code.replace('const dsBijStart','wijzig(root.document);const dsBijStart'),
  code.replace('function stijl(){','function stijl(dsBijStart){'),
  code.replace('function stijl(){','function stijl(){dsBijStart=false;'),
  code.replace('function stijl(){','function stijl(){eval(tekst);'),
  code.replace('function stijl(){','function stijl(){gebruik(arguments);')
 ];
 for(const bron of tegen){const x=os.scriptLaadAnalyse(bron,{ds:true});assert.ok(x.injecties+x.mogelijkeInjecties>0||x.onzeker.length>0,bron);}
 // Zonder de primitive snapshot blijven ontsnapte of vervangen documentaliassen
 // onbeslist; deze uitbreiding bewijst geen algemene alias/callgraph.
 for(const wijziging of ['gebruik(doc);','doc=anders;','doc.documentElement.hasAttribute=()=>false;','const kopie=doc;gebruik(kopie);']){
  const x=os.scriptLaadAnalyse(`(function(root){var doc=root.document;${wijziging}
   function stijl(){if(doc.documentElement.hasAttribute('data-ds'))return;doc.createElement('style');}stijl();})(${arg});`,{ds:true});
  assert.ok(x.mogelijkeInjecties>0,wijziging);
 }
});

test('werkelijke Overdracht-owner gebruikt op elke host de canonieke DS-presentatie; geen DOM blijft een no-op',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/overdracht.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);assert.equal(os.telInjectie(bron),1);
 assert.match(bron,/if \(document\.documentElement\.hasAttribute\('data-ds'\)\) return;/);
 assert.doesNotMatch(bron,/overdracht-legacy\.css/);
 for(const context of [{},{window:null},{window:{}},{window:{document:null},document:null}]){
  vm.runInNewContext(bron,context);assert.equal(context.window?.__rtgOverdracht,undefined);
 }
});

test('werkelijke Toegang-owner houdt zijn bestaande stylesheet buiten DS',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/toegang.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/shared/toegang.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/shared/toegang.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadToegangLegacyStijl\(pad\)/);
 assert.match(bron,/if \(document\.documentElement\.hasAttribute\('data-ds'\)\) return;/);
});

test('werkelijke Bediening-owner gebruikt op elke host de canonieke DS-presentatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/bediening.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadBedieningStijl\(pad\)/);
 assert.doesNotMatch(bron,/bediening-legacy\.css|bdnCss/);
});

test('werkelijke Volscherm-owner gebruikt centrale DS-geometrie en behoudt bestaande legacycompatibiliteit lokaal',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/volscherm.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,[]);assert.deepEqual(ds.verwijzingen,[]);
 assert.deepEqual(legacy.verwijzingen,[]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,1);
 assert.doesNotMatch(bron,/volscherm-legacy\.css/);
 assert.match(bron,/if \(document\.documentElement\.hasAttribute\('data-ds'\)\) return;/);
});

test('werkelijke Sneltoets-owner gebruikt op elke host de canonieke DS-presentatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/sneltoets.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadSneltoetsPresentatie\(pad\)/);
 assert.doesNotMatch(bron,/sneltoets-legacy\.css/);
});

test('werkelijke Wereldschil houdt links en het tweede paneel bij documentnavigatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/wereldschil.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.match(bron,/function veiligAdres\(href\)/);
 assert.match(bron,/a\.setAttribute\('href', adres\)/);
 assert.ok(bron.indexOf('f.src = href;') < bron.indexOf('window.RTGMedia.kader(f)'),
  'het native iframe blijft aantoonbare navigatie voordat de mediapoort het configureert');
});

test('werkelijke Uitvoer-owner gebruikt op elke host de canonieke DS-presentatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/uitvoer.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadUitvoerPresentatie\(pad\)/);
 assert.doesNotMatch(bron,/uitvoer-legacy\.css/);
});

test('werkelijke Foundation-sessie gebruikt de canonieke DS-presentatie op elke host',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/apps/foundation/sessie.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,
  ['/ds/rtg-ds.css','/shared/wereldschil.css']);
 assert.ok(legacy.verwijzingen.some(({href})=>href==='/ds/rtg-ds.css'));
 assert.ok(legacy.verwijzingen.some(({href})=>href==='/shared/wereldschil.js'),
  'de bestaande Foundation-deelketen blijft zichtbaar voor de laadgraaf');
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadSessiePresentatie\(pad\)/);
 assert.doesNotMatch(bron,/sessie-legacy\.css|style\.cssText/);
});

test('werkelijke Deur-owner gebruikt op elke host de canonieke DS-presentatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/deur.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadDeurPresentatie\(pad\)/);
 assert.doesNotMatch(bron,/deur-legacy\.css/);
});

test('werkelijke levende-kleurmotor gebruikt één canoniek DS-blad voor alle werelden',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/levendekleur.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 for(const analyse of [ds,legacy]){
  assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
  assert.deepEqual(analyse.verwijzingen,[{href:'/ds/levendekleur.css',soort:'dom'}]);
 }
 assert.match(bron,/function laadLevendekleurStijl\(pad\)/);
});

test('werkelijke verbindingsowner houdt de Zaakdoos bij veilige documentnavigatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/verbinding.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.match(bron,/function veiligeDoosBasis\(waarde\)/);
 assert.match(bron,/w\.location\.assign\(u \+ location\.pathname/);
 assert.doesNotMatch(bron,/location\.href\s*=/);
});

test('werkelijke Deelmenu-owner gebruikt op elke host de canonieke DS-presentatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/deelmenu.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadDeelmenuStijl\(pad\)/);
 assert.doesNotMatch(bron,/deelmenu-legacy\.css|rtgdeel-stijl/);
});

test('werkelijke Foundation-Samen houdt meegaan bij begrensde documentnavigatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/apps/foundation/samen.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.match(bron,/function veiligSamenPad\(waarde\)/);
 assert.match(bron,/window\.location\.assign\(pad\)/);
 assert.doesNotMatch(bron,/location\.href\s*=/);
});

test('werkelijke Foundation-OS-schil gebruikt aantoonbare statische DOM-loads',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/apps/foundation/schil-os.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 for(const analyse of [ds,legacy]) {
  assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
  for(const href of ['/shared/wereldschil.js','/shared/glyf.js'])
   assert.ok(analyse.verwijzingen.some(x=>x.href===href&&x.soort==='dom'),href);
 }
 assert.deepEqual(ds.uitgesloten,['/shared/wereldschil.css']);
 assert.ok(legacy.verwijzingen.some(x=>x.href==='/shared/wereldschil.css'&&x.soort==='dom'));
});

test('werkelijke Foundation-palet houdt seizoen actief en dagkleur buiten DS',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/apps/foundation/palet.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 for(const analyse of [ds,legacy]) {
  assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
  assert.ok(analyse.verwijzingen.some(x=>x.href==='/shared/seizoen.js'&&x.soort==='dom'));
 }
 assert.deepEqual(ds.uitgesloten,['/shared/dagkleur.css']);
 assert.ok(legacy.verwijzingen.some(x=>x.href==='/shared/dagkleur.css'&&x.soort==='dom'));
});

test('World Desktop houdt projectiepresentatie buiten de DS-schil',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/rtg-world-desktop.js'),'utf8');
 const projectie=fs.readFileSync(path.join(__dirname,'../public/apps/spelscherm.html'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 const bladen=['/shared/rtg-edge-system.css','/shared/rtg-adaptive-edge.css'];
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);assert.deepEqual(legacy.onzeker,[]);
 for(const href of bladen) {
  assert.equal(ds.verwijzingen.some(x=>x.href===href),false,href+' blijft buiten DS');
  assert.equal(legacy.verwijzingen.some(x=>x.href===href),false,href+' wordt niet meer door runtime geïnjecteerd');
  assert.match(projectie,new RegExp('<link[^>]+href="'+href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"[^>]*>'),href+' heeft één expliciete documenteigenaar');
 }
});

test('werkelijke lege-staatowner begrenst dynamische ankerbestemmingen tot het RTG-huis',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/leeg.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.match(bron,/function veiligPad\(waarde\)/);
 assert.match(bron,/setAttribute\('href', actie\.pad\)/);
 assert.match(bron,/setAttribute\('href', pad\)/);
 assert.doesNotMatch(bron,/\.href\s*=\s*(actie|st)\./);
});

test('werkelijke Plek-owner gebruikt op elke host de canonieke DS-presentatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/plek.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.deepEqual(legacy.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
 assert.match(bron,/function laadPlekPresentatie\(pad\)/);
 assert.doesNotMatch(bron,/plek-legacy\.css/);
});

test('werkelijke Uitstap-owner gebruikt uitsluitend expliciete documentnavigatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/uitstap.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.match(bron,/window\.location\.replace\(WEG\)/);
 assert.match(bron,/window\.location\.assign\(WEG\)/);
 assert.doesNotMatch(bron,/location\.href\s*=/);
});

test('werkelijke Kantoordeur houdt de passkey-eigenaar statisch herleidbaar',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/kantoordeur.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.ok(analyse.verwijzingen.some(x=>x.href==='/shared/passkey.js'&&x.soort==='dom'));
});

test('werkelijke Kantoorgesprek-owner gebruikt één canoniek component en statische deur',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/kantoorgesprek.js'),'utf8');
 const ds=os.scriptLaadAnalyse(bron,{ds:true}),legacy=os.scriptLaadAnalyse(bron,{ds:false});
 assert.equal(ds.injecties+ds.mogelijkeInjecties,0);assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/componenten/kantoorgesprek.css']);
 assert.ok(ds.verwijzingen.some(x=>x.href==='/shared/kantoordeur.js'&&x.soort==='dom'));
 assert.ok(legacy.verwijzingen.some(x=>x.href==='/ds/componenten/kantoorgesprek.css'&&x.soort==='dom'));
 assert.ok(legacy.verwijzingen.some(x=>x.href==='/shared/kantoordeur.js'&&x.soort==='dom'));
 assert.equal(legacy.injecties+legacy.mogelijkeInjecties,0);
});

test('werkelijke publieke platformowners houden media, ankers en kopietaal expliciet',()=>{
 for(const bestand of ['public/site/platform-elements.js','public/site/platform-detail.js']){
  const bron=fs.readFileSync(path.join(__dirname,'..',bestand),'utf8');
  const analyse=os.scriptLaadAnalyse(bron,{ds:true});
  assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0,bestand);
  assert.deepEqual(analyse.onzeker,[],bestand+': '+JSON.stringify(analyse.onzeker));
 }
});

test('werkelijke publieke waarheids- en verhaalowners houden dynamische inhoud bij media en navigatie',()=>{
 for(const bestand of ['public/site/website-truth.js','public/site/storyline-stage.js','public/site/storyline-edge.js']){
  const bron=fs.readFileSync(path.join(__dirname,'..',bestand),'utf8');
  const analyse=os.scriptLaadAnalyse(bron,{ds:true});
  assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0,bestand);
  assert.deepEqual(analyse.onzeker,[],bestand+': '+JSON.stringify(analyse.onzeker));
 }
 const waarheid=fs.readFileSync(path.join(__dirname,'../public/site/website-truth.js'),'utf8');
 assert.match(waarheid,/^\s*if \(!\/\^\\\/apps\\\//m);
 assert.doesNotMatch(waarheid,/\.href\s*=|\.src\s*=/);
});

test('werkelijke werkvloer houdt operatienavigatie en personeelsdeur begrensd',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/apps/werkvloer.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.ok(!analyse.onzeker.some(s=>s.includes('Berekende src/href')),analyse.onzeker.join('\n'));
 assert.doesNotMatch(bron,/\.href\s*=/);
 assert.match(bron,/naar === '\/apps\/personeel\.html'/);
});

test('werkelijke FocusUI-owner gebruikt de centrale DS-component',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/focus.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"](?:style|link)['"]\)|fxStijl|rtgDsRuntimeCss/);
 const ds=fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8');
 assert.match(ds,/componenten\/focus\.css/);
 for(const app of ['app','backoffice','leverancier','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/focus\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/shared\/focus\.js/g)||[]).length,1,app);
  assert.equal((html.match(/\/ds\/componenten\/focus\.css/g)||[]).length,1,app);
 }
});

test('werkelijke Inlogkleur-owner scheidt levende variabelen van statische presentatie',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/inlogkleur.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|inlogkleur-stijl/);
 assert.match(bron,/inlogkleurStijlLink\.href = '\/ds\/rtg-ds\.css'/);
 const ds=fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8');
 assert.match(ds,/componenten\/inlogkleur\.css/);
 for(const app of ['app','backoffice','leverancier','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/inlogkleur\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/shared\/inlogkleur\.js/g)||[]).length,1,app);
 }
});

test('werkelijke Scanknop-owner gebruikt de centrale toegankelijke DS-overlay',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/scanknop.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|rtg-scanknop-stijl/);
 for(const app of ['app','leverancier','pay','foundation/vrienden']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/scanknop\.css/g)||[]).length,0,app);
  assert.equal((html.match(/<script[^>]+src="\/shared\/scanknop\.js"/g)||[]).length,1,app);
 }
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/scanknop\.css/);
});

test('werkelijke Spraak-owner gebruikt één statische 44px bediening',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/spraak.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|rtg-spraak-maat/);
 for(const app of ['app','camera','muziek','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/spraak\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/shared\/spraak\.js/g)||[]).length,1,app);
 }
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/spraak\.css/);
});

test('werkelijke Borden-owner gebruikt één statisch blad zonder inline presentaties',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/borden.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|bordStijl|style=/);
 for(const app of ['app','leverancier','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/borden\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/shared\/borden\.js/g)||[]).length,1,app);
 }
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/borden\.css/);
});

test('werkelijke WerkOS-owner gebruikt één centrale DS-component voor beide schillen',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/werkos.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/const CSS\s*=|createElement\(['"]style['"]\)|stijl\.textContent/);
 for(const app of ['backoffice','leverancier','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/werkos\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/ds\/componenten\/werkos\.css/g)||[]).length,1,app);
 }
 assert.match(bron,/classList\.add\('ds-werkos'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/werkos\.css/);
});

test('werkelijke Kostenbeeld-owner gebruikt één statisch blad voor alle kostenlezers',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/kostenbeeld.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|ksStijl/);
 for(const app of ['geld','kosten','zaakkosten']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/kostenbeeld\.css/g)||[]).length,0,app);
  assert.equal((html.match(/<script[^>]+src="\/shared\/kostenbeeld\.js"/g)||[]).length,1,app);
 }
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/kostenbeeld\.css/);
});

test('werkelijke Rahul-poort-owner gebruikt het centrale Design System op alle werkhosts',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/rahulpoort.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|rpStijl|var CSS\s*=/);
 for(const app of ['leverancier','meldkamer','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/rahulpoort\.css/g)||[]).length,0,app);
 }
 assert.match(bron,/link\.href = '\/ds\/rtg-ds\.css'/);
 assert.match(bron,/<div class="rp ds-rahulpoort">/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/rahulpoort\.css/);
});

test('werkelijke Rahul-mond-owner gebruikt het centrale Design System en expliciete signatuurmond',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/rahul-mond.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"](?:style|script)['"]\)|\.src\s*=/);
 for(const app of ['office','scherm','leverancier']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/rahul-mond\.css/g)||[]).length,0,app);
  assert.ok(html.indexOf('/shared/mond.js')<html.indexOf('/shared/rahul-mond.js'),app);
 }
 assert.match(bron,/link\.href = '\/ds\/rtg-ds\.css'/);
 assert.match(bron,/className = 'rmond rm-weg ds-rahul-mond'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/rahul-mond\.css/);
});

test('werkelijke TeamCall-owner gebruikt één statisch blad zonder inline presentaties',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/teamcall.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|tcStijl|style=/);
 for(const app of ['leverancier','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/teamcall\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/shared\/teamcall\.js/g)||[]).length,1,app);
 }
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/teamcall\.css/);
});

test('werkelijke Split-owner gebruikt het centrale Design System en houdt documentbestemmingen zichtbaar',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/split.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);
 assert.equal(analyse.onzeker.filter(x=>x.includes('Berekende src/href')).length,2,analyse.onzeker.join('\n'));
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|rtgSplitCss/);
 const html=fs.readFileSync(path.join(__dirname,'../public/apps/app.html'),'utf8');
 assert.equal((html.match(/\/shared\/split\.css/g)||[]).length,0);
 assert.equal((html.match(/<script[^>]+src="\/shared\/split\.js"/g)||[]).length,1);
 assert.match(bron,/link\.href = '\/ds\/rtg-ds\.css'/);
 assert.match(bron,/ov\.className = 'ds-split'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/split\.css/);
});

test('werkelijke Leverancier-owner houdt overlays statisch en documentbestemmingen zichtbaar',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/apps/leverancier.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);
 assert.equal(analyse.onzeker.filter(x=>x.includes('Berekende src/href')).length,3,analyse.onzeker.join('\n'));
 assert.equal(analyse.onzeker.length,3,analyse.onzeker.join('\n'));
 assert.doesNotMatch(bron,/(?:zc|aw|tt)StijlEenmalig|createElement\(['"]style['"]\)/);
 const html=fs.readFileSync(path.join(__dirname,'../public/apps/leverancier.html'),'utf8');
 assert.equal((html.match(/\/apps\/leverancier-overlays\.css/g)||[]).length,0);
 assert.equal((html.match(/\/ds\/rtg-ds\.css/g)||[]).length,0);
 assert.match(bron,/function leverancierOverlayPresentatie\(\)/);
 assert.match(bron,/link\.href = '\/ds\/rtg-ds\.css'/);
 assert.match(bron,/ds-leverancier-overlay (?:zc|aw|tt)-ov/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/leverancier-overlays\.css/);
});

test('werkelijke CollegaChat-owner gebruikt het centrale Design System op beide werkhosts',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/collegachat.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/createElement\(['"]style['"]\)|ccStijl|style=/);
 for(const app of ['leverancier','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/collegachat\.css/g)||[]).length,0,app);
  assert.equal((html.match(/\/shared\/collegachat\.js/g)||[]).length,1,app);
 }
 assert.match(bron,/link\.href = '\/ds\/rtg-ds\.css'/);
 assert.match(bron,/el\.className = 'ds-collegachat'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/collegachat\.css/);
});

test('werkelijke Zaak Command-owner gebruikt het centrale Design System op beide werkhosts',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/zaakcommand.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/var CSS\s*=|createElement\(['"]style['"]\)|function stijl|Z\.stijl|style="/);
 for(const app of ['leverancier','personeel']){
  const html=fs.readFileSync(path.join(__dirname,'../public/apps/'+app+'.html'),'utf8');
  assert.equal((html.match(/\/shared\/zaakcommand\.css/g)||[]).length,0,app);
  assert.equal((html.match(/<script[^>]+src="\/shared\/zaakcommand\.js"/g)||[]).length,1,app);
 }
 assert.match(bron,/link\.href = '\/ds\/rtg-ds\.css'/);
 assert.match(bron,/el\.className = 'zc ds-zaakcommand'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/zaakcommand\.css/);
});

test('werkelijke Ondernemer-poort-owner gebruikt het centrale Design System op de leverancierhost',()=>{
 const bron=fs.readFileSync(path.join(__dirname,'../public/shared/ondernemerpoort.js'),'utf8');
 const analyse=os.scriptLaadAnalyse(bron,{ds:true});
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);assert.deepEqual(analyse.onzeker,[]);
 assert.doesNotMatch(bron,/var CSS\s*=|createElement\(['"]style['"]\)|function stijl|\.style\.(?:top|bottom)/);
 const html=fs.readFileSync(path.join(__dirname,'../public/apps/leverancier.html'),'utf8');
 assert.equal((html.match(/\/shared\/ondernemerpoort\.css/g)||[]).length,0);
 assert.equal((html.match(/<script[^>]+src="\/shared\/ondernemerpoort\.js"/g)||[]).length,1);
 assert.match(bron,/link\.href = '\/ds\/rtg-ds\.css'/);
 assert.match(bron,/className = 'poort-band poort-toast ds-ondernemerpoort'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../public/ds/rtg-ds.css'),'utf8'),/componenten\/ondernemerpoort\.css/);
});

test('werkelijke Geld-standen injecteren geen eigen presentatie meer',()=>{
 const bestanden=['balans','bank','labfonds','lidmaatschap','logboek','mecenaat','metier',
  'nalatenschap','overzicht','overzichtb','rtgcodeb','waarde','wallet','wbw'];
 for(const naam of bestanden){
  const bron=fs.readFileSync(path.join(__dirname,'../public/apps/geld/'+naam+'.js'),'utf8');
  const analyse=os.scriptLaadAnalyse(bron,{ds:true});
  assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0,naam+': '+JSON.stringify(analyse.onzeker));
  assert.ok(!analyse.onzeker.some(x=>/Stijlinjectie/.test(x)),naam+': '+JSON.stringify(analyse.onzeker));
 }
 const html=fs.readFileSync(path.join(__dirname,'../public/apps/geld.html'),'utf8');
 assert.equal((html.match(/\/ds\/componenten\/geld\.css/g)||[]).length,1);
 assert.match(html,/<body class="[^"]*\bds-geld\b/);
 assert.doesNotMatch(html,/overzicht-a\.js/);
});

test('werkelijke Geld-laders en CSV-download zijn volledig herleid',()=>{
 const balans=os.scriptLaadAnalyse(lees('public/apps/geld/balans.js'),{ds:true});
 assert.deepEqual(balans.onzeker,[]);
 assert.deepEqual(balans.verwijzingen,[{href:'/shared/toestelkluis.js',soort:'dom'}]);

 const rtgcode=os.scriptLaadAnalyse(lees('public/apps/geld/rtgcode.js'),{ds:true});
 assert.deepEqual(rtgcode.onzeker,[]);
 assert.deepEqual(rtgcode.verwijzingen,[
  {href:'/shared/media.js',soort:'dom'},
  {href:'/shared/qrscan.js',soort:'dom'},
  {href:'/shared/scanner.js',soort:'dom'},
  {href:'/shared/rtgcode.js',soort:'dom'}
 ]);

 const bank=os.scriptLaadAnalyse(lees('public/apps/geld/bank.js'),{ds:true});
 assert.deepEqual(bank.onzeker,[]);
 assert.equal(bank.injecties+bank.mogelijkeInjecties,0);
});
