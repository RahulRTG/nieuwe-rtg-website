'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const lees=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=lees('public/apps/magnaat.html');
const js=lees('public/apps/magnaat-voorzijde.js');
const css=lees('public/shared/rtg-magnaat-2026.css');

test('Magnaat opent met de drie goedgekeurde oefenmomenten in WorkOS-stijl',()=>{
  assert.match(html,/class="magnaat-voorzijde-actief"/);
  for(const paneel of ['wereld','missie','resultaat'])assert.match(html,new RegExp('data-mv-paneel="'+paneel+'"'));
  assert.match(html,/Leer ondernemen door het echt te doen\./);
  assert.match(html,/Echte keuzes\. Synthetische gegevens\. Geen risico voor klanten of geld\./);
  assert.match(html,/Van bericht naar duidelijke opvolging\.|Uw keuze bracht rust op de vloer\./);
  assert.equal((html.match(/\/shared\/rtg-magnaat-2026\.css/g)||[]).length,1);
  assert.equal((html.match(/\/apps\/magnaat-voorzijde\.js/g)||[]).length,1);
  for(const kleur of ['--mv-nacht:#06131d','--mv-goud:#d8ac69','--mv-wijn:#7a1830','--mv-groen:#7c9a83'])assert.ok(css.includes(kleur),kleur);
  assert.match(css,/hotel-executive\.jpg/);
  assert.match(css,/position:fixed[^}]+mv-navigatie|\.mv-navigatie\{position:fixed/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('de rustige voorzijde gebruikt echte Magnaat-bronnen en bewaart geen schijnresultaat',()=>{
  for(const bron of ['speler.dienst.dossiers','speler.actieveTaak','BRON.catalogus','wereld.gebeurtenis'])assert.ok(js.includes(bron),bron);
  assert.match(html,/Oefenresultaat · nog niet opgeslagen/);
  assert.match(html,/Pas bij “Start volledige missie” wordt een echt synthetisch Magnaat-dossier geopend/);
  assert.match(js,/typeof startTask==='function'/);
  assert.match(js,/typeof openTask==='function'/);
  assert.doesNotMatch(js,/fetch\s*\(|XMLHttpRequest|\/api\//,'de voorzijde omzeilt de bestaande Magnaat-bediening niet');
  assert.match(html,/RTGMagnaatVoorzijde\.ontvang\(DATA\)/);
});

test('de volledige bestaande wereld blijft bereikbaar en de veiligheidsgrens blijft zichtbaar',()=>{
  for(const scherm of ['werkplek','speelhal','wereld','economie','home'])assert.ok(js.includes("openDiep('"+scherm)||html.includes('data-mv-diep="'+scherm+'"'),scherm);
  assert.match(html,/data-magnaat-voorzijde-open/);
  assert.match(html,/Geen klantdata, echte betalingen en productieacties blijven buiten bereik|Klantdata, echte betalingen en productieacties blijven buiten bereik/);
  assert.match(html,/Persoonsgegevens en productieacties komen nooit in de game/);
  assert.match(html,/sandbox="allow-scripts allow-same-origin"/);
  assert.match(html,/payment 'none'/);
});
