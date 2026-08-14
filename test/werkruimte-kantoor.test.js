'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bron=fs.readFileSync(path.join(__dirname,'../public/apps/werkruimte.html'),'utf8');
const personeel=fs.readFileSync(path.join(__dirname,'../public/apps/personeel.html'),'utf8');
const personeelJs=fs.readFileSync(path.join(__dirname,'../public/apps/personeel.js'),'utf8');
const office=fs.readFileSync(path.join(__dirname,'../public/apps/office.html'),'utf8');
const klok=fs.readFileSync(path.join(__dirname,'../public/shared/klok.js'),'utf8');

test('RTG Work OS opent de echte kantoorsoftware als zelfstandige surfaces',()=>{
  for(const url of ['/apps/kantoor.html','/apps/kantoren.html','/apps/personeel.html?kantoor=1',
    '/apps/office.html?werk=kantoor','/apps/agenda.html','/apps/rtmail.html',
    '/apps/bestanden.html','/apps/backoffice.html','/apps/command.html'])assert.ok(bron.includes(url),url);
  assert.match(bron,/gebied.*kantoor/);
  assert.match(bron,/id: 'vandaag'[\s\S]*id: 'afdelingen'/);
});

test('de kantoorstand blijft een meubelplan en maakt AI niet verplicht',()=>{
  assert.match(bron,/alle[\s\S]*handelingen blijven zonder AI volledig bruikbaar/);
  assert.doesNotMatch(bron,/anthropic|openai|claude/i);
  assert.match(bron,/RTGSchil\.open/);
});

test('de originele personeelsklok blijft volledig binnen een Work OS-paneel',()=>{
  assert.match(personeel,/window\.self!==window\.top/);
  assert.match(personeel,/data-rtg-oppervlak="1"[\s\S]*--rtg-klok-maat:min\(11\.5rem,42vh,62vw\)/);
  assert.match(personeel,/data-rtg-oppervlak="1"[\s\S]*justify-content:flex-start/);
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
