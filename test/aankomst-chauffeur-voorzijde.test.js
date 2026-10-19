'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const lees=bestand=>fs.readFileSync(path.join(root,bestand),'utf8');

test('Aankomst & Chauffeur draagt het TravelOS-drieluik op het Design System',()=>{
  /* Het drieluik (aanvragen, chauffeur, aankomst) staat sinds batch 4 van
     TRAVELOS-MIGRATIE.md op /ds/: Taak, Detail en Status. De teksten en de
     drie momenten zijn dezelfde gebleven. */
  const html=lees('public/apps/rit.html'),momenten=lees('public/apps/rit-momenten.js'),js=lees('public/apps/rit.js');
  assert.match(html,/href="\/ds\/rtg-ds\.css"/);
  assert.match(html,/data-ds-schermtype="taak"/);
  assert.match(js,/Van aankomst\\nnaar bestemming\./);
  for(const id of ['aanvragen','chauffeur','aankomst'])assert.match(html,new RegExp('data-t="'+id+'"'));
  assert.match(momenten,/Uw chauffeur wordt gezocht\./);
  assert.match(js,/Uw verblijf\\nneemt het over\./);
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

test('de aankomstvoorzijde blijft in kleine modules en gebruikt de systeemvorm',()=>{
  const bestanden=['public/apps/rit.js','public/apps/rit-momenten.js','public/apps/rit-ontvangst.js'];
  for(const bestand of bestanden)assert.ok(Buffer.byteLength(lees(bestand))<10*1024,bestand+' is te groot');
  /* Geen eigen blad en geen oude vormlaag: alleen /ds/ (ONTWERPSYSTEEM.md). */
  const html=lees('public/apps/rit.html');
  assert.doesNotMatch(html,/<style|style=|\/shared\/[\w-]+\.css/);
  for(const bestand of bestanden)assert.doesNotMatch(lees(bestand),/style=/,bestand+' zet een stijlattribuut');
});
