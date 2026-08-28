/* Het gedeelde interactieve randenstelsel van WorkOS, TravelOS, LivingOS en
   RTFoundation. Deze toets bewaakt de dunne geometrie, eigen wereldpaletten,
   volledige functieroutes, echte bediening en de maximaal vier actieve
   schermen op desktop en tablet. Ook legt hij vast dat gesloten randpanelen
   nooit de onderliggende applicatiebediening afvangen. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const lees=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=lees('public/shared/rtg-edge-system.css');
const kern=lees('public/shared/rtg-edge-system.js');
const werelden=lees('public/shared/rtg-edge-worlds.js');
const iconen=lees('public/shared/rtg-edge-icons.js');
const bibliotheek=lees('public/shared/rtg-edge-library.js');
const werk=lees('public/apps/werkruimte.html');
const context={window:{}};
vm.runInNewContext(iconen,context);
vm.runInNewContext(werelden,context);
const catalogus=context.window.RTGEdgeWorlds;

test('het randenstelsel heeft een vaste dunne geometrie en maximaal 2 x 2',()=>{
  assert.match(css,/--edge-top:40px;--edge-side:48px;--edge-bottom:48px/);
  assert.match(kern,/\[1, 2, 4\]/);
  assert.match(lees('public/shared/rtg-schil/02-indeling.js'),/var kol = k === 1 \? 1 : 2/);
  assert.match(lees('public/shared/rtg-schil/03-surfaces.js'),/surfaces\.length >= 4/);
  const schilCss=lees('public/shared/rtg-schil.css');
  assert.match(schilCss,/\.rtg-handle button\{[\s\S]*min-width:24px;min-height:24px/);
  assert.match(schilCss,/\.rtg-console \.rijtje button\{[\s\S]*min-width:24px;min-height:24px/);
  assert.match(css,/\.rtg-edge-crumbs button\{min-width:24px;min-height:24px/);
  assert.match(css,/\.rtg-edge-bottom>button,\.rtg-edge-bottom>a,\.rtg-edge-history\{height:var\(--edge-bottom\)/);
  assert.match(css,/\.rtg-edge-bottom\{[^}]*pointer-events:none/,
    'alleen de echte onderrandknoppen mogen apps onder de transparante balk afvangen');
  assert.match(css,/\.rtg-edge-ai-panel\{[^}]*pointer-events:none/,
    'een gesloten gesprek mag geen bediening in de app afvangen');
  assert.match(css,/\.rtg-edge-action button\{min-width:24px;min-height:24px/);
  assert.match(css,/@media\(max-width:767px\)[\s\S]*\.rtg-edge-layout\{display:none!important\}/);
});

test('alle vier werelden delen bediening maar hebben eigen paletten en functies',()=>{
  for(const naam of ['work','travel','living','foundation']){
    assert.ok(catalogus[naam],naam);
    assert.match(css,new RegExp('data-rtg-world="'+naam+'"'));
  }
  for(const functie of ['Presentaties & Office','Vluchten','Decisions','Gezin & beheer'])
    assert.ok(werelden.includes(functie),functie);
  assert.match(css,/--edge-ok:#48c883;--edge-warn:#e6a84b;--edge-danger:#e05a67/);
});

test('de functiebibliotheek bevat alle routes, zonder dode knop of dubbele id',()=>{
  const minima={work:16,travel:13,living:12,foundation:60};
  for(const [wereld,cfg] of Object.entries(catalogus)){
    assert.ok(cfg.all.length>=minima[wereld],wereld+' heeft de volledige catalogus');
    assert.equal(new Set(cfg.all.map(x=>x[0])).size,cfg.all.length,wereld+' heeft unieke functie-id’s');
    for(const item of cfg.all){
      const route=new URL(item[3],'https://rtg.example').pathname;
      assert.ok(fs.existsSync(path.join(__dirname,'../public',route)),wereld+': '+item[3]);
      assert.ok(context.window.RTGEdgeIcons[item[2]],wereld+': icoon '+item[2]);
    }
    for(const snel of cfg.tools)assert.ok(cfg.all.includes(snel),wereld+': rail hoort bij de catalogus');
  }
});

test('zoeken, sneltoetsen, status en breadcrumbs zijn echte bediening',()=>{
  assert.match(bibliotheek,/Functies zoeken/);
  assert.match(bibliotheek,/function filter/);
  assert.match(kern,/metaKey \|\| ev\.ctrlKey/);
  assert.match(kern,/ev\.altKey/);
  assert.match(kern,/rtg-edge-status-panel/);
  assert.match(kern,/L\.crumbs\(e, openIndex, voerActie\)/);
  assert.match(kern,/openFunctions/);
  assert.match(bibliotheek,/fetch\('\/api\/ready'/);
  assert.match(bibliotheek,/fetch\('\/api\/health'/);
  assert.match(bibliotheek,/health\.omgeving === 'magnaat-test'/);
  assert.match(bibliotheek,/Afgeschermde Magnaat-testomgeving/);
  assert.doesNotMatch(bibliotheek,/Demostand|health\.demo/);
});

test('de wereldingangen gebruiken hun gedeelde of eigen OS-rand',()=>{
  assert.match(werk,/rtg-edge-system\.js/);
  assert.ok(werk.indexOf('rtg-edge-icons.js')<werk.indexOf('rtg-edge-system.js'));
  assert.ok(werk.indexOf('rtg-edge-library.js')<werk.indexOf('rtg-edge-system.js'));
  assert.match(werk,/foundation: \{ wereld: 'foundation'/);
  assert.match(kern,/rtg-edge-ai-panel/);
  assert.match(kern,/\.mgz-blok/);
  const travelOs=lees('public/shared/travel-os.js');
  assert.match(travelOs,/body\.classList\.add\('travel-os'\)/);
  assert.match(travelOs,/RTGTravelOSConfig/);
  assert.match(lees('public/apps/living-os.html'),/class="lo-rail"/);
  assert.match(lees('public/shared/randen.js'),/wereld = 'foundation'/);
  assert.match(lees('public/shared/randen.js'),/RTGEdge\.start\(\{ world: wereld/);
});

test('Living OS en Travel OS gebruiken echte serverroutes',()=>{
  const livingData=lees('public/apps/living-os-data.js');
  const livingHtml=lees('public/apps/living-os.html');
  const travel=[
    lees('public/apps/reizen-performance.js'),
    lees('public/apps/reizen-performance-reis.js'),
    lees('public/apps/reizen-performance-boeken.js'),
    lees('public/apps/reizen-performance-taxi.js'),
    lees('public/apps/reizen-performance-rahul.js'),
    lees('public/apps/reizen.html')
  ].join('\n');
  for(const route of ['/api/member/bureau/overzicht','/api/member/bureau/zaak/beslis','/api/geld/cockpit','/api/reis/wereld','/api/agenda/bereik','/api/fluister'])
    assert.ok(livingData.includes(route),'Living OS gebruikt '+route);
  const livingKern=lees('public/apps/living-os.js');
  assert.match(livingKern,/\/api\/instant-reality/);
  assert.match(livingKern,/\/api\/instant-reality\/event/);
  assert.doesNotMatch(travel,/demoReizen|demorit|voorbeeldreis|Ibiza Airport|Sal de Mar/i);
  assert.match(lees('public/apps/reizen-performance-rahul.js'),/\/api\/fluister/);
  assert.equal(catalogus.living.all.find(x=>x[0]==='geld')[3],'/apps/geld.html');
});

test('elk nieuw randbestand blijft klein en zelfstandig',()=>{
  for(const bestand of ['rtg-edge-system.js','rtg-edge-library.js','rtg-edge-worlds.js','rtg-edge-icons.js']){
    assert.ok(fs.statSync(path.join(__dirname,'../public/shared',bestand)).size<10*1024,bestand);
  }
});
