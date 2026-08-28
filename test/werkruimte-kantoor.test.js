'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bron=fs.readFileSync(path.join(__dirname,'../public/apps/werkruimte.html'),'utf8');
const personeel=fs.readFileSync(path.join(__dirname,'../public/apps/personeel.html'),'utf8');
const personeelJs=fs.readFileSync(path.join(__dirname,'../public/apps/personeel.js'),'utf8');
const office=fs.readFileSync(path.join(__dirname,'../public/apps/office.html'),'utf8');
const agenda=fs.readFileSync(path.join(__dirname,'../public/apps/agenda.html'),'utf8');
const notities=fs.readFileSync(path.join(__dirname,'../public/apps/notities.html'),'utf8');
const bestanden=fs.readFileSync(path.join(__dirname,'../public/apps/bestanden.html'),'utf8');
const klok=fs.readFileSync(path.join(__dirname,'../public/shared/klok.js'),'utf8');
const cookie=fs.readFileSync(path.join(__dirname,'../public/shared/cookie.js'),'utf8');
const werelden=fs.readFileSync(path.join(__dirname,'../public/shared/rtg-edge-worlds.js'),'utf8');

test('RTG Work OS opent de echte kantoorsoftware als zelfstandige surfaces',()=>{
  for(const url of ['/apps/kantoor.html','/apps/kantoren.html','/apps/personeel.html?kantoor=1',
    '/apps/office.html?werk=kantoor','/apps/agenda.html','/apps/rtmail.html',
    '/apps/bestanden.html','/apps/backoffice.html','/apps/command.html'])assert.ok(werelden.includes(url),url);
  assert.match(bron,/gebied.*kantoor/);
  assert.match(bron,/appsVan\('work'\)/);
  assert.match(bron,/RTGEdgeWorlds\[wereld\]\.all/);
  assert.match(bron,/data-rtg-schil="standaard"/);
});

test('de kantoorstand blijft een meubelplan en maakt AI niet verplicht',()=>{
  assert.match(bron,/alle[\s\S]*handelingen blijven zonder AI volledig bruikbaar/);
  assert.doesNotMatch(bron,/anthropic|openai|claude/i);
  assert.match(bron,/RTGSchil\.open/);
});

test('de originele personeelsklok blijft volledig binnen een Work OS-paneel',()=>{
  assert.match(personeel,/window\.self!==window\.top/);
  assert.match(personeel,/data-rtg-oppervlak="1"[\s\S]*--rtg-klok-maat:min\(12\.75rem,45vh,66vw\)/);
  assert.match(personeel,/data-rtg-oppervlak="1"[\s\S]*justify-content:flex-start/);
  assert.match(personeel,/data-rtg-oppervlak="1"\] #gateStep\{margin-top:\.65rem;/);
  assert.match(personeel,/data-rtg-oppervlak="1"\] #gate \.badge\{display:none;/);
  assert.doesNotMatch(personeel,/data-rtg-oppervlak="1"\][^}]*\.rr-naam/);
  assert.match(klok,/naam\.textContent = 'RAHUL TRAVEL GROUP'/);
});

test('de kantooraccount-ingang kan niet dubbel worden toegevoegd',()=>{
  assert.match(personeelJs,/if \(\$\('#kaAccountVerder'\)\) return;/);
  assert.match(personeelJs,/b\.id = 'kaAccountVerder'/);
});

test('RTG Office gebruikt in Work OS geen dubbele of uitgerekte bovenbalk',()=>{
  assert.match(office,/window\.self!==window\.top/);
  assert.match(office,/data-rtg-oppervlak="1"\] \.kop\{display:none !important;/);
  assert.match(office,/body\.setAttribute\('data-ios-uit',''\)/);
});

test('de standaard schil heeft links, boven en onder en geeft de app het hele werkvlak',()=>{
  const schilJs=fs.readFileSync(path.join(__dirname,'../public/shared/rtg-schil.js'),'utf8');
  const schilCss=fs.readFileSync(path.join(__dirname,'../public/shared/rtg-schil.css'),'utf8');
  assert.match(schilJs,/el\('nav', 'rtg-tabbar'/);
  assert.match(schilJs,/el\('nav', 'rtg-onderbalk'/);
  assert.match(schilJs,/m\.h - tabhoog - onderhoog/);
  assert.doesNotMatch(bron,/\.rtg-werkruimte\{display:none;\}/,
    'Work OS mag op mobiel niet verdwijnen');
  assert.match(schilJs,/Sluit ' \+ esc\(s\.naam\)/);
  assert.match(schilCss,/data-rtg-schil="standaard"[\s\S]*\.rtg-console/);
  assert.match(schilCss,/data-rtg-schil="standaard"[\s\S]*\.rtg-tab\[data-actief\]/);
  assert.match(schilCss,/data-rtg-schil="standaard"[\s\S]*\.rtg-onderbalk/);
  assert.match(cookie,/window\.self !== window\.top/,'surfaces mogen geen dubbele opslagmelding tonen');
  assert.match(cookie,/data-rtg-schil="standaard"[\s\S]*66px/,
    'de ene melding hoort boven de vaste onderbalk te staan');
});

test('Agenda, Notities en Bestanden dragen dezelfde kantoorlaag in en buiten Work OS',()=>{
  for(const [naam,pagina] of [['Agenda',agenda],['Notities',notities],['Bestanden',bestanden]]){
    assert.match(pagina,/kantoor-tools\.css/,naam+' mist de gedeelde enterprise-laag');
    assert.match(pagina,/data-kantoor-tool=/,naam+' mist zijn toolcontext');
    assert.match(pagina,/dataset\.rtgOppervlak='1'/,naam+' verbergt dubbele chrome niet');
    assert.match(pagina,/body\.setAttribute\('data-ios-uit',''\)/,naam+' mag geen tweede mobiele appbalk maken');
    assert.match(pagina,/class="kantoor-intro"/,naam+' mist de rustige werkhiërarchie');
  }
  assert.match(office,/presentation-enterprise\.css/,
    'Presentatie hoort zijn eigen responsive regietafel te laden');
});
