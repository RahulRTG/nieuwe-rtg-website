'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/apps/browser.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/ds/componenten/browser.css'),'utf8');
const webblok=fs.readFileSync(path.join(root,'public/ds/componenten/webblok.css'),'utf8');
test('browserchrome en gepubliceerde blokpresentatie gebruiken DS met dezelfde renderer',()=>{
  assert.doesNotMatch(html,/<style\b|\sstyle="/);
  assert.match(html,/<link href="\/ds\/rtg-ds.css"/);
  assert.match(html,/<script src="\/ds\/shell.js"><\/script>/);
  assert.doesNotMatch(html,/\/shared\/webblok.css/);
  assert.match(html,/doek ds-webblok/);
  for(const route of ['sitemaker','krant','redactie'])assert.match(fs.readFileSync(path.join(root,'public/apps/'+route+'.html'),'utf8'),/\/shared\/webblok.css/,'legacy-consument houdt bestaande presentatie');
  assert.doesNotMatch(html,/href="\/shared\/(?:rtg-uniform|rtg-ui|ios|rtg-heritage).css"/);
  for(const id of ['terugKnop','vooruitKnop','herlaadKnop','homeKnop','bwKnop','balk','adres','tabstrip','hoofd','melding'])
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  for(const src of ['rtg-world-desktop','ios','metgezel','uitvoer','basis','adaptief'])assert.ok(html.includes('/shared/'+src+'.js'));
  assert.match(css,/scroll-margin-block-start: 8rem/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(html,/ds-browser-tabselect/);
  assert.doesNotMatch(html,/setAttribute\('role','button'\)/,
    'tabkeuze bevat geen tweede interactieve knop meer');
  const fouten=require('../scripts/ontwerpsysteem').contractFouten({paginas:{}});
  assert.deepEqual(fouten.filter(x=>/componenten\/(browser|webblok)\.css/.test(x)),[]);
  const tokens=fs.readFileSync(path.join(root,'public/ds/tokens.css'),'utf8');
  for(const m of (css+webblok).matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(m[1]+':'),m[1]+' bestaat');
});
test('adresnormalisatie en escaping uit werkelijke browserbron blijven begrensd',()=>{
  const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function parseAdres'));
  assert.doesNotThrow(()=>new Function(script));
  const delen=[script.match(/const esc=.*?;\n/)[0],script.match(/function slug\(v\)\{[^\n]+/)[0],script.slice(script.indexOf('function parseAdres'),script.indexOf('// geschiedenis'))].join('\n');
  const context={};vm.runInNewContext(delen+';resultaat={parseAdres,slug,esc};',context);
  assert.equal(context.resultaat.slug('HTTPS://evil.test'), 'https-evil-test');
  assert.equal(context.resultaat.esc('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.equal(JSON.stringify(context.resultaat.parseAdres('rtg://Mijn Zaak.rtg/contact')), JSON.stringify({adres:'mijn-zaak',pad:'contact'}));
  for(const route of ['gids','zoek','open','bericht'])assert.ok(script.includes("'/api/browser/"+route+"'"));
  assert.match(script,/Authorization:'Bearer '\+TOKEN/);
  assert.match(script,/if\(!r.ok\)throw new Error/);
  assert.match(script,/idem=idem\|\|RTGId\('web'\)/);
});
