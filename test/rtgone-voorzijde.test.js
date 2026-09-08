'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const lees=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=lees('public/apps/rtgone.html');
const gedrag=lees('public/apps/rtgone-voorzijde.js');
const beeld=lees('public/apps/rtgone-voorzijde-weergave.js');
const css=lees('public/shared/rtg-one-2026.css');

test('RTG One opent met Werkdag, Besluitruimte en Overdracht in de WorkOS-stijl',()=>{
  assert.match(html,/class="rtg-work-flow one-voorzijde-actief"/);
  for(const paneel of ['werkdag','besluit','overdracht'])assert.match(html,new RegExp('data-one-paneel="'+paneel+'"'));
  assert.match(html,/Uw werkdag, rustig in beeld\./);
  assert.match(html,/Beslis met zicht op het gevolg\./);
  assert.match(html,/Laat werk doorlopen, zonder alles over te dragen\./);
  assert.equal((html.match(/\/shared\/rtg-one-2026\.css/g)||[]).length,1);
  assert.equal((html.match(/\/apps\/rtgone-voorzijde\.js/g)||[]).length,1);
  assert.equal((html.match(/\/apps\/rtgone-voorzijde-weergave\.js/g)||[]).length,1);
  for(const kleur of ['--one-nacht:#061116','--one-goud:#c99b55','--one-teal:#7d9f98','--one-wijn:#7a1830'])assert.ok(css.includes(kleur),kleur);
  assert.match(css,/\.one-nav\{position:fixed/);
});

test('de rustige voorzijde tekent uitsluitend gegevens uit de bestaande RTG One-stand',()=>{
  for(const bron of ['stand.vandaag','stand.goedkeuringen','stand.overdrachten'])assert.ok(beeld.includes(bron),bron);
  for(const telling of ['t.rtmail','t.agenda','t.goedkeuringen','t.taken'])assert.ok(beeld.includes(telling),telling);
  assert.match(html,/RTGOneVoorzijde\.ontvang\(S,HOUSE\)/);
  assert.doesNotMatch(gedrag,/fetch\s*\(|XMLHttpRequest|\/api\//,'de voorzijde maakt geen tweede gegevensroute');
  assert.doesNotMatch(beeld,/fetch\s*\(|XMLHttpRequest|\/api\//,'de weergave is alleen een projectie');
});

test('besluiten en overdrachten blijven aan de bestaande menselijke bediening gekoppeld',()=>{
  assert.match(gedrag,/w\.act\('goedkeuring\/beslis'/);
  assert.match(gedrag,/w\.decisionForm\(\)/);
  assert.match(gedrag,/w\.openForm\('handover'\)/);
  assert.match(gedrag,/querySelector\('\[data-house=/);
  assert.match(beeld,/Alleen een bevoegde collega kan het besluit nemen/);
  assert.match(beeld,/Geen stille rechtenoverdracht/);
  assert.match(beeld,/het geeft zelf geen nieuwe systeemrechten/);
  assert.match(gedrag,/Rustig overzicht/);
});
