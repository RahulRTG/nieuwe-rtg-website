'use strict';
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
const css=lees('public/shared/rtg-reisboek-2026.css');

test('het Reisboek heeft de drie goedgekeurde, herkenbare TravelOS-momenten',()=>{
  for(const naam of ['vandaag','documenten','wijzigingen'])assert.match(html,new RegExp('data-rb-tabknop="'+naam+'"'));
  assert.match(app,/Uw reis beweegt\\nmet u mee\./);
  assert.match(app,/Alles wat u nodig heeft\.\\nOp zijn plaats\./);
  assert.match(app,/Uw reis blijft\\nkloppen\./);
  assert.match(momenten,/Niets wordt aangepast zonder uw akkoord\./);
  assert.match(css,/--rb-ink:#03101a/);
  assert.match(css,/--rb-gold:#dca45f/);
  assert.match(css,/--rb-burgundy:#7d102e/);
  assert.match(css,/travelos\/ibiza-airport\.jpg/);
  assert.match(css,/travelos\/travel-documents\.jpg/);
  assert.match(css,/travelos\/travel-desk\.jpg/);
});

test('de voorzijde leest de echte reisbronnen en maakt geen tweede boeking',()=>{
  for(const route of ['/api/member/rechterhand/reisboek','/api/reis/reizen','/api/reis/wacht','/api/reis/los'])assert.ok(app.includes(route),route);
  assert.match(app,/\/api\/reis\/los\/doe/);
  assert.match(app,/v\.soort==='taak'/,'alleen een echt taakvoorstel krijgt de uitvoerknop');
  assert.match(momenten,/Dit is een momentopname/);
  assert.doesNotMatch(momenten,/35 min vertraagd|Samir El Amrani|Gate D24|Casa Maris/,'de getekende voorbeeldgegevens worden niet als werkelijkheid ingebakken');
  assert.doesNotMatch(app,/\/api\/(?:vlucht|verblijf|mob)\/(?:boek|wijzig|vraag)/,'het Reisboek boekt of wijzigt geen domeinobjecten');
});

test('privacy, paspoort en bestaande bewerkfuncties blijven intact',()=>{
  assert.match(app,/rtg_member_token/);
  assert.doesNotMatch(app,/localStorage\.getItem\([^)]*(?:office|supplier|partner)/i);
  assert.match(app,/RTGGegevensPoort\.vang/);
  assert.match(app,/RTGDeur\.toon/);
  assert.match(momenten,/Nummers en bewijsstukken worden hier niet getoond/);
  assert.doesNotMatch(momenten,/QR|barcode|paspoortnummer/i);
  for(const route of ['reis/zet','reis/weg','reis/item','reis/item/weg'])assert.ok(beheer.includes('/api/member/rechterhand/'+route),route);
});

test('de bestaande Edge- en Vandaag-contracten blijven exact eenmaal aanwezig',()=>{
  assert.match(html,/data-rtg-world="travel"[^>]+data-rtg-vandaag-luxe="surface"/);
  assert.match(html,/data-rtg-edge-2-context="native-header"/);
  assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.css/g)||[]).length,1);
  assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.js/g)||[]).length,1);
  assert.equal((html.match(/\/shared\/randen\.js/g)||[]).length,1);
});
