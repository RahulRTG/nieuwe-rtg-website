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

test('ieder Magnaat-navigatiepad en iedere dynamische werkhandeling declareert een bereikbare UI-stand',()=>{
  for(const attribuut of ['data-mv-diep','data-mv-uitdaging','data-mv-naar','data-mv-nav','data-screen','data-go','data-quick']){
    const knoppen=[...html.matchAll(new RegExp('<button[^>]*'+attribuut+'[^>]*>','g'))].map(x=>x[0]);
    assert.ok(knoppen.length>0,attribuut+' ontbreekt');
    for(const knop of knoppen)assert.match(knop,/data-stand="magnaat-[^"]+"/,knop);
  }
  for(const id of ['mvGaVerder','mvVoerKeuzeUit','mvStartVolledig','mvVolgende','capsMeer']){
    assert.match(html,new RegExp('<button[^>]*id="'+id+'"[^>]*data-stand="magnaat-[^"]+"'));
  }
  assert.match(html,/<button[^>]*id="mvStartVolledig"[^>]*data-stand="magnaat-diep"/);
  assert.doesNotMatch(html,/<button[^>]*id="mvStartVolledig"[^>]*data-hoofdactie/,
    'de volledige missie start pas nadat de herstelbare resultaatacties zijn bewezen');
  assert.match(html,/<button[^>]*id="mvGaVerder"[^>]*data-hoofdactie[^>]*data-contextactie/);
  assert.equal((html.match(/data-mv-uitdaging="[0-2]"[^>]*data-contextactie/g)||[]).length,3);
  assert.match(js,/doorgaan\.toggleAttribute\('data-hoofdactie',!taak\)/);
  assert.match(js,/doorgaan\.toggleAttribute\('data-contextactie',!taak\)/);
  assert.match(html,/<button[^>]*id="mvVolgende"[^>]*data-contextactie/);
  assert.doesNotMatch(html,/<button[^>]*id="mvVolgende"[^>]*data-hoofdactie/);
  assert.match(js,/data-mv-keuze="'\+i\+'" data-stand="magnaat-keuze" data-hoofdactie aria-label="Kies aanpak:/);
  assert.match(html,/data-duty="'\+esc\(x\.functieId\)\+'" data-stand="magnaat-dossier" data-contextactie aria-label="Open dossier/);
  assert.match(html,/if\(actief\)\{TASK=actief;toast\('Rond eerst het actieve dossier af; uw andere dossiers blijven klaarstaan\.'/);
  assert.doesNotMatch(html,/\(klaar\|\|geblokkeerd\)\?'disabled'/);
  assert.match(html,/data-next-duty data-contextactie data-hoofdactie/);
  assert.match(html,/data-start="'\+esc\(c\.id\)\+'" data-stand="magnaat-capability" aria-label="'\+label\+'"/);
  assert.match(html,/const label='Start '\+esc\(c\.naam\)\+' in '\+esc\(c\.software\.naam\)/);
  assert.match(html,/document\.addEventListener\('keydown',e=>\{/);
  assert.match(html,/if\(e\.key!=='Escape'\)return/);
  for(const laag of ['teamOverlay','partnerOverlay','taskOverlay'])assert.ok(html.includes("sluitLaag('#"+laag+"')"),laag);
  for(const label of ['Sluit opdracht','Sluit bedrijfstraining','Sluit teamkamer'])assert.match(html,new RegExp('aria-label="'+label+'"'));
});
