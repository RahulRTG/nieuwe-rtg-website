'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const lees=bestand=>fs.readFileSync(path.join(root,bestand),'utf8');

test('Aankomst & Chauffeur draagt het goedgekeurde TravelOS-drieluik',()=>{
  const html=lees('public/apps/rit.html'),momenten=lees('public/apps/rit-momenten.js');
  assert.match(html,/rtg-arrival-experience/);
  assert.match(html,/rtg-aankomst-2026\.css/);
  assert.match(html,/Van aankomst<br>naar bestemming\./);
  for(const id of ['aanvragen','chauffeur','aankomst'])assert.match(html,new RegExp('data-t="'+id+'"'));
  assert.match(momenten,/Uw chauffeur wordt gezocht\./);
  assert.match(momenten,/Uw verblijf neemt het over\./);
});

test('de drie momenten blijven op echte vervoer- en verblijfskernen',()=>{
  const js=lees('public/apps/rit.js');
  for(const pad of ['/api/mob/plekken','/api/mob/vraag','/api/mob/mijn','/api/mob/volg','/api/verblijf/mijn'])assert.match(js,new RegExp(pad));
  assert.match(js,/rtg_member_token/);
  assert.match(js,/Uw chauffeur wordt persoonlijk bevestigd/);
});

test('chauffeur, voertuig en sleutel worden niet als belofte verzonnen',()=>{
  const js=lees('public/apps/rit-momenten.js');
  assert.match(js,/r\.chauffeur\|\|'Nog niet toegewezen'/);
  assert.match(js,/r\.voertuig\|\|'Voertuig volgt na bevestiging'/);
  assert.match(js,/v\.status==='ingecheckt'\?'Beschikbaar':'Na check-in'/);
  assert.doesNotMatch(js,/Samir El Amrani|Zwarte Mercedes/);
});

test('de nieuwe aankomstvoorzijde blijft in kleine modules en gebruikt de systeemvorm',()=>{
  const bestanden=['public/apps/rit.js','public/apps/rit-momenten.js','public/shared/rtg-aankomst-2026.css','public/shared/rtg-aankomst-momenten-2026.css'];
  for(const bestand of bestanden)assert.ok(Buffer.byteLength(lees(bestand))<10*1024,bestand+' is te groot');
  assert.match(lees('public/shared/rtg-heritage-experiences.css'),/rtg-arrival-experience \.rit-nav/);
  assert.match(lees('public/shared/travel-os-config.js'),/AANKOMST & CHAUFFEUR/);
});
