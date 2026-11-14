'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const details=[...['community','rtg-pass','business-lite','business-pass','lifestyle-pass'].map(id=>'public/site/passen/'+id+'.html'),...['livingos','travelos','workos','foundationos'].map(id=>'public/site/werelden/'+id+'.html'),'public/site/techniek/techniek.html','explore/index.html'];
const hosts=['index.html',...details,'public/site/404.html'];
function attr(tag,name){const match=tag.match(new RegExp('\\b'+name+'="([^"]*)"'));return match&&match[1];}
function assetPath(host,url){const route=url.split(/[?#]/)[0];if(route.startsWith('/'))return path.join(root,route.startsWith('/public/')?route.slice(1):'public'+route);return path.resolve(root,path.dirname(host),route);}
test('alle dertien openbare bronnen laden uitsluitend huisletters en de ene DS-root',()=>{
 assert.equal(hosts.length,13);
 for(const host of hosts){const html=read(host),links=[...html.matchAll(/<link\b[^>]*>/g)].map(match=>match[0]).filter(tag=>attr(tag,'rel')==='stylesheet');
  assert.match(html,/<html\b[^>]*\bdata-ds(?:\s|>)/,host+' activeert DS');
  assert.equal(links.length,2,host+' heeft precies twee stijlbronnen');
  assert.deepEqual(links.map(tag=>assetPath(host,attr(tag,'href'))),['public/fonts/fonts.css','public/ds/rtg-ds.css'].map(file=>path.join(root,file)),host+' geen legacy CSS');
  assert.doesNotMatch(html,/<style\b|\sstyle="/i,host+' geen inline stijllaag');
  assert.match(html,/<body\b[^>]*data-rtg-world="living"/,host+' publieke merkwereld blijft living');
  if(host!=='index.html')assert.match(html,/<body\b[^>]*class="[^"]*\bds-public-story\b/,host);
 }
});
test('het geschilderde signatuurbeeld en de volledige footerlockup zijn statische inhoud op alle detailhosts',()=>{
 for(const host of details){const html=read(host),art=[...html.matchAll(/<img\b[^>]*src="[^"]*rtg-painted-(?:colourfield|horizon)\.webp"[^>]*>/g)].map(match=>match[0]),footer=html.match(/<footer\b[\s\S]*?<\/footer>/);
  assert.ok(art.length,host+' heeft ook zonder JavaScript een geschilderd signatuurbeeld');assert.ok(footer,host+' behoudt een footer');
  for(const tag of art){
   if(/colourfield/.test(tag)){assert.match(tag,/width="960" height="1200"/);assert.match(html,/RTG[\s\S]*AI-gegenereerd/);}
   else {
    assert.match(tag,/width="1536" height="512"/);
    if(/\bds-public-volume\b/.test(html))assert.ok((attr(tag,'alt')||'').length>10,'het zelfstandige schilderblad heeft een beeldalternatief');
    else assert.equal(attr(tag,'alt'),'','de kleine horizonstrook is decoratief');
   }
  }
  assert.match(footer[0],/rahul-travel-group-logo\.jpg/);assert.match(footer[0],/width="1280" height="470"/);assert.match(footer[0],/EXPERIENCE THE ELITE CLASS/);
  for(const tag of [...art,...[...footer[0].matchAll(/<img\b[^>]*>/g)].map(match=>match[0])])assert.ok(fs.existsSync(assetPath(host,attr(tag,'src'))),host+' '+attr(tag,'src'));
 }
});
test('de nieuwe publieke presentatie houdt domeinidentiteit, prijzen en demo-eigenaars apart van de merkkleur',()=>{
 for(const [world,scenario] of [['living','dinner'],['travel','travel'],['work','work'],['foundation','family']]){
  const html=read('public/site/werelden/'+world+'os.html');
  assert.match(html,new RegExp('data-world="'+world+'"'));assert.match(html,new RegExp('data-story-demo="'+scenario+'"'));
  for(const owner of ['website-truth.js','storyline-world.js','storyline-stage.js','experience-core.js'])assert.equal((html.match(new RegExp('src="[^"]*/'+owner.replace(/\./g,'\\.')+'"','g'))||[]).length,1,world+' behoudt '+owner);
  assert.match(html,/data-story-fallback/,'zonder JavaScript blijft de echte demonstratiegrens leesbaar');
 }
 const passIds={'community':'community','rtg-pass':'rtg','business-lite':'business-lite','business-pass':'business','lifestyle-pass':'lifestyle'};
 for(const [page,id] of Object.entries(passIds)){const html=read('public/site/passen/'+page+'.html');assert.match(html,new RegExp('data-pass="'+id+'"'));assert.match(html,/data-commercial-policy="2026-11-12\.1"/);assert.match(html,/data-policy-price/);assert.match(html,/data-policy-billing/);}
 const explore=read('explore/index.html');assert.match(explore,/id="exploreSearch"/);assert.match(explore,/id="toolGrid"/);assert.match(explore,/src="\.\.\/public\/site\/explore\.js"/);
 for(const world of ['living','travel','work','foundation'])assert.match(explore,new RegExp('<button[^>]*data-world="'+world+'"'));
});
test('de detailrenderer verplaatst canonieke inhoud zonder tweede h1, bureaublad of dynamische CSS-loader',()=>{
 const script=read('public/site/platform-detail.js');
 assert.match(script,/source=d\.querySelector\('\.world-shell'\)/);assert.match(script,/source\.querySelector\('\.ds-brand-mark'\)/);assert.match(script,/data-language-picker/);
 assert.doesNotMatch(script,/node\('h1'|wd-greeting|wd-people|wd-favorites|cloneNode|createElement\('(?:script|style|link)'\)/);
});
test('de 404 is dezelfde publieke stijl met bereikbare herstelroutes, geen apart app-bureaublad',()=>{
 const html=read('public/site/404.html');
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/404/);assert.match(html,/rtg-mark\.svg/);assert.match(html,/rahul-travel-group-logo\.jpg/);
 assert.match(html,/href="\/"/,'de onbekende route heeft een ondubbelzinnige weg naar de voordeur');
 assert.doesNotMatch(html,/rtg-world-desktop\.js|rtg-uniform\.css|seizoen\.(?:css|js)|\/shared\/basis\.js/);
});
test('publieke wereldkeuze bewaart Living zonder de bestaande niet-magazine wereldthema’s te wijzigen',()=>{
 for(const file of ['public/site/start/experience-graph.js','public/site/start/experience.js','public/site/platform-app.js']){
  const script=read(file);
  assert.equal((script.match(/d\.body\.dataset\.rtgWorld\s*=/g)||[]).length,1,file+' heeft één thema-mutatie');
  assert.match(script,/if\s*\(\s*!d\.body\.classList\.contains\('ds-magazine-page'\)[^;\n]*d\.body\.dataset\.rtgWorld\s*=/,file+' beschermt uitsluitend de publieke magazinehost');
 }
});
