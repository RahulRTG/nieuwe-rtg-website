'use strict';
/* TravelOS Reisboek: de drie momenten, de echte bronnen, privacy en de deur.
   Sinds de TravelOS-migratie staat het scherm op het RTG Design System
   (TRAVELOS-MIGRATIE.md); test/reisboek-ds.e2e.js bewijst het in een browser. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const lees=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=lees('public/apps/reisboek.html');
const app=lees('public/apps/reisboek.js');
const momenten=lees('public/apps/reisboek-momenten.js');
const beheer=lees('public/apps/reisboek-beheer.js');

test('het Reisboek heeft de drie goedgekeurde, herkenbare TravelOS-momenten',()=>{
  for(const naam of ['vandaag','documenten','wijzigingen'])assert.match(html,new RegExp('data-rb-tabknop="'+naam+'"'));
  assert.match(app,/Uw reis beweegt\\nmet u mee\./);
  assert.match(app,/Alles wat u nodig heeft\.\\nOp zijn plaats\./);
  assert.match(app,/Uw reis blijft\\nkloppen\./);
  assert.match(momenten,/Niets wordt aangepast zonder uw akkoord\./);
  assert.match(html,/\/ds\/rtg-ds\.css/);
  assert.match(html,/<body[^>]+data-rtg-world="travel"/);
  assert.match(momenten,/\/images\/worlds\/heritage\/travel-heritage-v2\.jpg/,'het grote beeld is in-huis beeld met herkomst');
});

test('de voorzijde leest de echte reisbronnen en maakt geen tweede boeking',()=>{
  for(const route of ['/api/member/rechterhand/reisboek','/api/reis/reizen','/api/reis/wacht','/api/reis/los'])assert.ok(app.includes(route),route);
  assert.match(app,/\/api\/reis\/los\/doe/);
  assert.match(app,/v\.soort==='taak'/,'alleen een echt taakvoorstel krijgt de uitvoerknop');
  assert.match(momenten,/Dit is een momentopname/);
  assert.doesNotMatch(momenten,/35 min vertraagd|Samir El Amrani|Gate D24|Casa Maris/,'de getekende voorbeeldgegevens worden niet als werkelijkheid ingebakken');
  assert.doesNotMatch(app,/\/api\/(?:vlucht|verblijf|mob)\/(?:boek|wijzig|vraag)/,'het Reisboek boekt of wijzigt geen domeinobjecten');
});

test('privacy, paspoort, de deur en bestaande bewerkfuncties blijven intact',()=>{
  assert.match(app,/rtg_member_token/);
  assert.doesNotMatch(app,/localStorage\.getItem\([^)]*(?:office|supplier|partner)/i);
  assert.match(app,/RTGGegevensPoort\.vang/);
  /* De deur (de 403-tak): dezelfde woorden als shared/deur.js, die zelf stijl
     zet en daarom op een ds-scherm niet laadt. Geen knop die toegang verleent. */
  assert.match(app,/e\.status===403\)\{gate\(\)/);
  assert.match(momenten,/uitsluitend op uitnodiging of na goedkeuring, en dat besluit nemen mensen bij RTG/);
  assert.match(momenten,/\/api\/gids\/app/);
  assert.match(momenten,/Nummers en bewijsstukken worden hier niet getoond/);
  assert.doesNotMatch(momenten,/QR|barcode|paspoortnummer/i);
  for(const route of ['reis/zet','reis/weg','reis/item','reis/item/weg'])assert.ok(beheer.includes('/api/member/rechterhand/'+route),route);
});

test('het scherm heeft één Edge en geen eigen stijl',()=>{
  assert.equal((html.match(/\/ds\/shell\.js/g)||[]).length,1);
  assert.doesNotMatch(html,/<style|style="|\/shared\/[\w-]+\.css|randen\.js|deur\.js/);
  for(const f of [app,momenten,beheer])assert.doesNotMatch(f,/style="|\.style\./);
});
