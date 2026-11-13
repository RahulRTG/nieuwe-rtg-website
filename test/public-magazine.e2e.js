'use strict';
// Presentation and navigation proof only; no real provider or purchase qualification.
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {laadPlaywright,startBrowser}=require('./helper');
const root=path.join(__dirname,'..');let server,browser,base;
const edge='.ds-public-edge.ds-edge',edgeSheet=edge+' .rtg-adaptive-sheet';
const pages=['editie','inhoudsopgave','interview','bedoeling','reisverhaal','reisnotities','goedeleven','salon-verhaal','ondernemen','foundation-verhaal','atelier','werelden-gids','code','vertrouwen','eigen-regie','lid-worden','service-gids','tot-ziens'];
const articles=[['interview','artikel-interview'],['reisverhaal','artikel-reizen'],['goedeleven','artikel-leven'],['ondernemen','artikel-ondernemers'],['code','artikel-code'],['vertrouwen','artikel-vertrouwen'],['foundation-verhaal','artikel-foundation'],['atelier','artikel-atelier']];
const storyLeaves=[...articles,['bedoeling','artikel-interview'],['salon-verhaal','artikel-leven'],['eigen-regie','regie']];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
test.before(async()=>{
 server=http.createServer((req,res)=>{
  let route=new URL(req.url,'http://localhost').pathname;
  if(route==='/')route='/index.html';else if(/^\/(ds|fonts|images|shared|site)\//.test(route))route='/public'+route;
  const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(e,bytes)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(e?'missing':bytes);});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await startBrowser(laadPlaywright({eigenDriver:false}));
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
async function pageFor(width,hash='',options={}){
 const context=await browser.newContext({viewport:{width,height:900},locale:'nl-NL',reducedMotion:'reduce',serviceWorkers:'block',...options});
 await context.addInitScript(()=>localStorage.setItem('rtg_lang','nl'));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({status:503,body:'Read-only presentation proof; external providers excluded'}));
 const page=await context.newPage(),errors=[],missing=[];page.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&['image','script','stylesheet','font'].includes(r.request().resourceType()))missing.push(r.url());});
 await page.goto(base+'/'+hash,{waitUntil:'networkidle'});
 if(options.javaScriptEnabled!==false)await page.waitForFunction(()=>!!window.RTGPublicApp);
 await page.evaluate(()=>document.fonts.ready);
 if(options.javaScriptEnabled!==false){
  await settle(page);
  await page.evaluate(()=>{window.__originalMagazinePager=document.querySelector('.ds-issue-controls');window.__originalMagazineFooter=document.querySelector('.ds-magazine-footer');});
 }
 return {context,page,errors,missing};
}
async function status(page,n){await page.waitForFunction(({n,total})=>!document.getElementById('magazineHome').hidden&&document.querySelector('[data-carousel-status]').textContent.trim()===n+' / '+total,{n,total:pages.length});}
async function showPage(page,id){await page.evaluate(id=>window.RTGPublicApp.shell.page(id),id);await status(page,pages.indexOf(id)+1);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function overflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'alleen het magazine, niet het document, schuift horizontaal');}
async function decode(image){await image.evaluate(e=>e.decode());}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function hit(control){return control.evaluate(node=>{const r=node.getBoundingClientRect();return r.width>=43.9&&r.height>=43.9&&r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=-.5&&r.bottom<=innerHeight+.5&&node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));});}
function edgeButton(page,action){return page.locator(edge+' .rtg-adaptive-bar [data-rtg-adaptive-action="'+action+'"]');}
async function edgeAction(page,action){if(!await page.locator(edge+' .rtg-adaptive-bar').isVisible()){await page.locator('.ds-public-edge-toggle').click();await settle(page);}const button=edgeButton(page,action);assert.equal(await hit(button),true,action+' is echte bereikbare Edge-bediening');await button.focus();await page.keyboard.press('Enter');await settle(page);}
async function seekEdge(page,target){
 const sheet=page.locator(edgeSheet),previous=sheet.locator('[data-edge-page="-1"]'),next=sheet.locator('[data-edge-page="1"]');
 async function turn(button){const before=await sheet.locator('.ds-edge-page-status').innerText();await button.click();await page.waitForFunction(before=>document.querySelector('.ds-edge-page-status').textContent!==before,before);await settle(page);}
 for(let n=0;n<80&&!await previous.isDisabled();n++)await turn(previous);
 for(let n=0;n<80;n++){if(await hit(target))return;if(await next.isDisabled())break;await turn(next);}
 assert.fail('de bediening is op geen werkelijk menublad bereikbaar: '+await target.textContent());
}
async function openActions(page){
 await edgeAction(page,'context');
 assert.equal(await page.locator(edgeSheet+' .rtg-adaptive-sheet-head h2').innerText(),'Deze editie');
 assert.equal(await page.evaluate(()=>document.querySelector('.pp-menu-panel .ds-issue-controls')===window.__originalMagazinePager),true,'de oorspronkelijke pager blijft dezelfde node bij heropenen');
}
async function editionAction(page,label){await openActions(page);const button=page.locator(edgeSheet).getByRole('button',{name:label,exact:true});await seekEdge(page,button);await button.click();await settle(page);}
async function completeLeaf(page,id){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const card=page.locator('#'+id),compact=await card.evaluate(e=>e.classList.contains('ds-issue-condensed'));
 if(compact){
  await card.locator('[data-read-leaf="'+id+'"]').click();
  await page.waitForFunction(id=>document.body.dataset.magazineView==='article'&&document.querySelector('#magazineDetailContent > #'+id)?.classList.contains('ds-issue-reader'),id);
 }
 return compact;
}
async function returnedFocus(page,leaf,trigger,compact){
 await status(page,pages.indexOf(leaf)+1);
 const selector=compact?'#'+leaf+' [data-read-leaf="'+leaf+'"]':trigger;
 await page.waitForFunction(selector=>document.activeElement===document.querySelector(selector),selector);
}
async function openInfo(page){
 await editionAction(page,'Service, informatie en colofon');
 await page.waitForFunction(()=>document.body.dataset.magazineView==='article'&&!!document.querySelector('#magazineDetailContent > .ds-magazine-footer'));
 assert.equal(await page.evaluate(()=>document.querySelector('#magazineDetailContent > .ds-magazine-footer')===window.__originalMagazineFooter),true,'Info gebruikt de oorspronkelijke publicatiebron');
}
for(const width of [320,390,768,1024,1440,1920])test('magazine: achttien complete bladen, compacte merkrollen en geen body-overflow op '+width+'px',async()=>{
 const {context,page,errors,missing}=await pageFor(width);try{
  assert.equal(await page.locator('main').count(),1);
  assert.deepEqual(await page.locator('h1').evaluateAll(nodes=>nodes.map(node=>node.id).sort()),['hoofdtitel','issue-cover-title'],'de cover en de verborgen oorspronkelijke bron behouden elk hun eigen kop');
  assert.equal(await page.locator('#inhoud').isVisible(),false,'de oorspronkelijke bron staat niet als tweede zichtbare cover onder het magazine');
  const compactCover=await page.locator('#editie').evaluate(e=>e.classList.contains('ds-issue-condensed'));
  assert.equal(await page.locator(compactCover?'#editie .ds-issue-preview h2':'#editie h1').isVisible(),true,'de actuele cover heeft een zichtbare, benoemde kop');
  assert.equal(await page.locator('.rtg-adaptive-edge').count(),1);
  assert.equal(await page.locator('link[rel=stylesheet]').count(),2);
  assert.equal(await page.locator('#issueTrack > [data-issue-page]').count(),18);
  assert.deepEqual(await page.locator('#issueTrack > [data-issue-page]').evaluateAll(es=>es.map(e=>e.id)),pages);
  assert.equal(await page.locator('#issueTrack figcaption').count(),0);
  assert.doesNotMatch(await page.locator('#issueTrack').innerText(),/AI-gegenereerd|veeg (?:naar|om)/i);
  const track=await page.locator('#issueTrack').evaluate(e=>({snap:getComputedStyle(e).scrollSnapType,overflow:getComputedStyle(e).overflowX,scrollWidth:e.scrollWidth,width:e.clientWidth}));
  assert.match(track.snap,/(?:inline|x) mandatory/);assert.equal(track.overflow,'auto');assert.ok(track.scrollWidth>track.width*(pages.length-1));
  assert.equal(await page.locator('.ds-magazine-masthead').isVisible(),false,'geen tweede websiteheader naast de app-Edge');
  assert.equal(await page.locator('.ds-issue-topline').isVisible(),false,'geen extra editie-navigatiebalk');
  const nativeBar=page.locator(edge+' .rtg-adaptive-bar.ds-edge__balk');
  assert.equal(await nativeBar.isVisible(),false,'standaard blijft alleen de kleine lippenknop zichtbaar');
  assert.equal(await hit(page.locator('.ds-public-edge-toggle')),true);
  await page.locator('.ds-public-edge-toggle').click();await settle(page);
  assert.equal(await nativeBar.isVisible(),true);
  assert.deepEqual(await nativeBar.locator('button.ds-edge__knop').evaluateAll(nodes=>nodes.map(node=>node.dataset.rtgAdaptiveAction)),['home','worlds','ai','context','menu']);
  for(const button of await nativeBar.locator('button').all())assert.equal(await hit(button),true,'alle vijf native Edge-knoppen zijn minimaal 44px en bereikbaar');
  assert.equal(await nativeBar.locator('.rtg-adaptive-lips').count(),1,'één compact Rahul-submerk in de gedeelde Edge');
  await page.locator('.ds-public-edge-toggle').click();await settle(page);
  assert.equal(await page.locator('.ds-magazine-footer').isVisible(),false,'de oorspronkelijke footer is alleen via Info zichtbaar');
  for(const id of pages){
   await showPage(page,id);
   const state=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect(),t=e.parentElement.getBoundingClientRect();return {width:r.width,track:t.width,left:r.left,trackLeft:t.left,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};});
   assert.ok(Math.abs(state.width-state.track)<2,id+' vult één blad');
   assert.ok(Math.abs(state.left-state.trackLeft)<2,id+' is niet half afgesneden');
   assert.ok(state.scrollWidth<=state.clientWidth+1,id+' heeft geen interne horizontale clipping');
   const compact=await completeLeaf(page,id);
   for(const image of await page.locator('#'+id+' img').all()){
    await decode(image);
    assert.equal(await image.evaluate(e=>e.complete&&e.naturalWidth>0&&e.getBoundingClientRect().width>0),true);
   }
   if(id==='interview')assert.equal(await page.locator('#interview .ds-issue-portrait img').evaluate(e=>getComputedStyle(e).objectFit),'contain','het complete portret wordt niet als coverbeeld bijgesneden');
   await overflow(page);
   if(compact){await page.locator('#magazineBack').click();await status(page,pages.indexOf(id)+1);}
  }
  await openInfo(page);
  const footer=page.locator('.ds-magazine-footer-brand img');await decode(footer);
  assert.match(await footer.getAttribute('src'),/rahul-travel-group-logo\.jpg$/);
  assert.equal(await footer.getAttribute('alt'),'Rahul Travel Group — EXPERIENCE THE ELITE CLASS');
  assert.equal(await footer.evaluate(e=>Math.abs(e.getBoundingClientRect().width/e.getBoundingClientRect().height-1280/470)<.01),true);
  await page.locator('#magazineBack').click();await status(page,pages.length);
  await edgeAction(page,'menu');
  assert.equal(await edgeButton(page,'menu').getAttribute('aria-expanded'),'true');
  const membership=page.locator('#explorePanel').getByRole('link',{name:'Lidmaatschap',exact:true});await seekEdge(page,membership);await membership.click();
  assert.equal(await page.locator('#passen').isVisible(),true);
  assert.equal(await edgeButton(page,'menu').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#magazineHome').isVisible(),false);
  assert.match(await page.locator('#passen').innerText(),/747,50/);await overflow(page);
  await page.locator('#magazineBack').click();assert.equal(await page.locator('#magazineHome').isVisible(),true);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 }finally{await context.close();}
});
for(const width of [390,1440])test('alle acht artikelen openen als dezelfde bronnode en keren terug naar blad, leescontext en focus op '+width+'px',async()=>{
 const {context,page,errors}=await pageFor(width);try{
  await page.evaluate(()=>{window.__articleSources=new Map(Array.from(document.querySelectorAll('[data-issue-article]'),e=>[e.id,e]));});
  for(const [leaf,id] of articles){
   await showPage(page,leaf);
   const compact=await completeLeaf(page,leaf);
   const trigger='#'+leaf+' a[href="#'+id+'"]';
   await page.locator(trigger).first().click();
   assert.equal(await page.locator('#magazineHome').isVisible(),false);
   assert.equal(await page.locator('#magazineDetailContent > #'+id).count(),1);
   assert.equal(await page.locator('#inhoud #'+id).count(),0);
   assert.equal(await page.evaluate(id=>document.getElementById(id)===window.__articleSources.get(id),id),true,'niet gekopieerd: '+id);
   await page.waitForFunction(()=>document.activeElement===document.getElementById('magazineDetailTitle'));
   assert.ok((await page.locator('#'+id+' .ds-issue-prose').innerText()).length>120);
   const sources=page.locator('#'+id+' .ds-issue-sources');
   await sources.locator('summary').click();assert.equal(await sources.evaluate(e=>e.open),true);
   if(id==='artikel-interview'){
    assert.deepEqual(await page.locator('#'+id+' dd').allTextContents(),['“Reizen, de mens en ondernemers”','“Verrast door schoonheid, kunst en nieuwe perspectieven”','“Een ingewikkeld systeem dat alleen voor een kleine elite werkt”']);
    const portrait=page.locator('#'+id+' img');await decode(portrait);
    assert.deepEqual(await portrait.evaluate(e=>[e.naturalWidth,e.naturalHeight]),[960,1280]);
    assert.equal(await portrait.evaluate(e=>getComputedStyle(e).objectFit),'contain','ook in het interview blijft het portret compleet');
   }
   await overflow(page);await page.locator('#magazineBack').click();await returnedFocus(page,leaf,trigger,compact);
   assert.equal(await page.locator('#inhoud #'+id).count(),1);
   assert.equal(await page.evaluate(id=>document.getElementById(id)===window.__articleSources.get(id),id),true);
   const reopenedCompact=await completeLeaf(page,leaf);
   await page.locator(trigger).first().click();assert.equal(await sources.evaluate(e=>e.open),true,'bronverantwoording bewaart leescontext');
   await page.locator('#magazineBack').click();await returnedFocus(page,leaf,trigger,reopenedCompact);
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
for(const width of [390,1440])test('verhaalfoto’s en titels zijn echte klikbare ingangen op '+width+'px',async()=>{
 const {context,page,errors}=await pageFor(width);try{
  for(const [leaf,id] of storyLeaves){
   await showPage(page,leaf);
   await completeLeaf(page,leaf);
   const sheet=page.locator('#'+leaf),images=sheet.locator('img');
   const heading=sheet.locator('h2').first();
   assert.equal(await heading.evaluate((e,id)=>{const a=e.closest('a')||e.querySelector('a');return !!a&&a.getAttribute('href')==='#'+id;},id),true,leaf+' heeft een native titelanker');
   await heading.click();assert.equal(await page.locator('#magazineDetailContent > #'+id).isVisible(),true,leaf+' opent via zijn titel');
   await page.locator('#magazineBack').click();await status(page,pages.indexOf(leaf)+1);
   for(let i=0;i<await images.count();i++){
    await completeLeaf(page,leaf);
    const image=images.nth(i);
    assert.equal(await image.evaluate((e,id)=>{const a=e.closest('a');return !!a&&a.getAttribute('href')==='#'+id&&!!(a.getAttribute('aria-label')||e.alt||a.textContent.trim());},id),true,leaf+' beeld '+i+' heeft een benoemde native verhaalbestemming');
    await image.click();assert.equal(await page.locator('#magazineDetailContent > #'+id).isVisible(),true,leaf+' opent via foto '+i);
    await page.locator('#magazineBack').click();await status(page,pages.indexOf(leaf)+1);
   }
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('reisnotities openen het reisverhaal via foto en titel en houden TravelOS als afzonderlijk dossier',async()=>{
 const {context,page,errors,missing}=await pageFor(390);try{
  for(const trigger of ['#reisnotities h2 a','#reisnotities .ds-issue-visual']){
   await showPage(page,'reisnotities');
   await completeLeaf(page,'reisnotities');
   assert.equal(await page.locator(trigger).getAttribute('href'),'#artikel-reizen');
   await page.locator(trigger).click();
   assert.equal(await page.locator('#magazineDetailContent > #artikel-reizen').isVisible(),true);
   await page.locator('#magazineBack').click();await status(page,pages.indexOf('reisnotities')+1);
  }
  await completeLeaf(page,'reisnotities');
  const dossier=page.locator('#reisnotities a[href="./public/site/werelden/travelos.html"]').first();
  await dossier.click();await page.waitForURL('**/site/werelden/travelos.html');
  assert.equal(await page.locator('#verhaal').isVisible(),true);
  assert.equal(await page.locator('body').getAttribute('data-world'),'travel');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 }finally{await context.close();}
});
test('de native Edge houdt Home, Rahul en het navigatiemenu als afzonderlijke benoemde ingangen',async()=>{
 const {context,page,errors}=await pageFor(390,'#passen');try{
  const home=edgeButton(page,'home'),rahul=edgeButton(page,'ai'),menu=edgeButton(page,'menu');
  assert.equal(await home.getAttribute('aria-label'),'Home');
  assert.ok(await rahul.getAttribute('aria-label'));assert.ok(await menu.getAttribute('aria-label'));
  assert.equal(await home.locator('.rtg-adaptive-lips').count(),0);
  assert.equal(await rahul.locator('.rtg-adaptive-lips').count(),1,'de app houdt haar herkenbare, afzonderlijke Rahul-bediening');
  await edgeAction(page,'home');assert.equal(await page.locator('#magazineHome').isVisible(),true);
  assert.equal(await page.locator('#magazineDetail').isVisible(),false);await status(page,1);
  await edgeAction(page,'ai');assert.equal(await page.locator('#intent').isVisible(),true);
  assert.equal(await page.locator('#explorePanel').isVisible(),false,'Rahul opent geen navigatiemenu');
  await edgeAction(page,'menu');assert.equal(await menu.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#explorePanel').isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
  await settle(page);assert.equal(await page.locator('.ds-public-edge-toggle').evaluate(node=>node===document.activeElement),true,'sluiten herstelt focus op de zichtbare Edge-ingang');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('directe prijs-/commissieankers en zoekresultaten openen canonieke inhoud, geen nieuwe kopieën',async()=>{
 const {context,page,errors}=await pageFor(390,'#commissie');try{
  assert.equal(await page.locator('#commissie').isVisible(),true);assert.equal(await page.locator('#commissie').getAttribute('open'),'');
  await page.locator('#magazineBack').click();await editionAction(page,'Zoek in RTG');
  await page.locator('#commandSearch').fill('RTG Graph');await page.locator('#commandResults a').first().click();
  assert.equal(await page.locator('#graph').isVisible(),true);assert.equal(await page.locator('#commandDialog').isVisible(),false);
  await page.goto(base+'/#prijsbeleid');await page.waitForFunction(()=>!!window.RTGPublicApp);
  assert.equal(await page.locator('#prijsbeleid').isVisible(),true);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('directe artikellink opent leesinhoud; paginalink opent een magazineblad',async()=>{
 const {context,page,errors}=await pageFor(390,'#artikel-code');try{
  assert.equal(await page.locator('#magazineDetailContent > #artikel-code').isVisible(),true);
  assert.equal(await page.locator('#magazineHome').isVisible(),false);
  await page.goto(base+'/#interview');await page.waitForFunction(()=>!!window.RTGPublicApp);
  await status(page,3);assert.equal(await page.locator('#magazineHome').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('demo-invoer, scenario en toestemmingen blijven bestaan; bevestiging is alleen een voorbeeld',async()=>{
 const {context,page,errors}=await pageFor(390);try{
  await page.evaluate(()=>window.RTGPublicApp.open('rahul'));await page.locator('#intent').fill('Ik wil samen op reis');
  await page.locator('#magazineBack').click();await page.evaluate(()=>window.RTGPublicApp.open('rahul'));
  assert.equal(await page.locator('#intent').inputValue(),'Ik wil samen op reis');
  await page.evaluate(()=>window.RTGExperience.choose('dinner',false));await page.evaluate(()=>window.RTGPublicApp.open('moment'));
  assert.equal(await page.evaluate(()=>window.RTGExperience.snapshot().scenario),'dinner');
  await editionAction(page,'Bekijk het voorstel');assert.equal(await page.locator('#summaryPanel').isVisible(),true);
  const confirm=page.locator('#confirmExample');await seekEdge(page,confirm);await confirm.click();assert.match(await page.locator('#exampleReceipt').innerText(),/geen|niets|uitsluitend|voorbeeld/i);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('skiplink, taalkeuze, menu en bestaande actielijst blijven bedienbaar',async()=>{
 const {context,page,errors}=await pageFor(390);try{
  // On macOS WebKit, Option-Tab includes links; ordinary Tab only visits
  // controls under the default keyboard preference. Exercise the native key.
  await page.keyboard.press(browser.browserType().name()==='webkit'?'Alt+Tab':'Tab');assert.equal(await page.locator('.ds-magazine-skip').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Enter');assert.equal(await page.locator('#editie').evaluate(e=>e===document.activeElement&&!!e.closest('main')),true,'de skiplink focust het eerste blad binnen de hoofdinhoud');
  const menu=edgeButton(page,'menu');
  await edgeAction(page,'menu');await edgeAction(page,'menu');assert.equal(await menu.getAttribute('aria-expanded'),'false');
  await edgeAction(page,'menu');const language=page.locator('#experienceLanguage');await seekEdge(page,language);await language.click();
  assert.equal(await page.locator('[role=dialog],dialog').filter({visible:true}).count()>0,true);
  assert.equal(await menu.getAttribute('aria-expanded'),'false');await page.keyboard.press('Escape');
  await edgeAction(page,'menu');const actions=page.locator('[data-magazine-actions]');await seekEdge(page,actions);await actions.click();await settle(page);
  assert.equal(await page.locator('#explorePanel').isVisible(),false,'de actielijst vervangt het menu binnen dezelfde native Edge');
  assert.equal(await page.locator(edgeSheet+' .rtg-adaptive-sheet-head h2').innerText(),'Deze editie');
  assert.equal(await page.evaluate(()=>document.querySelector('.pp-menu-panel .ds-issue-controls')===window.__originalMagazinePager),true);
  for(const label of ['Inhoud van deze editie','Zoek in RTG','Service, informatie en colofon','Bekijk het voorstel','Waarom zie ik dit?']){
   const action=page.locator(edgeSheet).getByRole('button',{name:label,exact:true});await seekEdge(page,action);assert.equal(await hit(action),true,label+' blijft bedienbaar via de bestaande actielijst');
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
for(const rtl of [false,true])test('native horizontale scroll, pijltoetsen, Home/End en begrensde bediening in '+(rtl?'RTL':'LTR'),async()=>{
 const {context,page,errors}=await pageFor(390);try{
  if(rtl)await page.evaluate(()=>document.documentElement.dir='rtl');
  await showPage(page,'editie');const track=page.locator('#issueTrack'),prev=page.locator('[data-carousel-prev]'),next=page.locator('[data-carousel-next]');
  await openActions(page);await seekEdge(page,prev);
  assert.equal(await prev.getAttribute('aria-disabled'),'true');assert.equal(await prev.evaluate(e=>e.disabled),false,'ARIA-grens zonder native disabled');
  await prev.focus();assert.equal(await prev.evaluate(e=>document.activeElement===e),true,'controle blijft focusbaar');
  const initialHash=new URL(page.url()).hash;
  await next.click();await status(page,2);assert.equal(new URL(page.url()).hash,initialHash,'bladeren vervuilt de URL niet');
  await track.focus();await page.keyboard.press(rtl?'ArrowLeft':'ArrowRight');await status(page,3);
  await page.keyboard.press(rtl?'ArrowRight':'ArrowLeft');await status(page,2);
  await page.keyboard.press('End');await status(page,pages.length);assert.equal(await next.getAttribute('aria-disabled'),'true');
  await page.keyboard.press(rtl?'ArrowLeft':'ArrowRight');await status(page,pages.length);
  await page.keyboard.press('Home');await status(page,1);assert.equal(await prev.getAttribute('aria-disabled'),'true');
  await track.evaluate(e=>{const target=e.querySelectorAll('[data-issue-page]')[1],r=target.getBoundingClientRect(),t=e.getBoundingClientRect();e.scrollBy({left:r.left+r.width/2-(t.left+t.width/2),behavior:'instant'});});
  await status(page,2);await overflow(page);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('snelle herhaalde keuzes onder volledige animatie blijven begrensd en houden de gekozen bladzijde',async()=>{
 const {context,page,errors}=await pageFor(390,'',{reducedMotion:'no-preference'});try{
  await openActions(page);await seekEdge(page,page.locator('[data-carousel-next]'));
  await page.evaluate(()=>{const next=document.querySelector('[data-carousel-next]');next.click();next.click();next.click();});
  await status(page,4);
  await page.evaluate(()=>window.RTGPublicApp.shell.next(100));await status(page,pages.length);
  await openActions(page);await seekEdge(page,page.locator('[data-carousel-next]'));
  await page.locator('[data-carousel-next]').focus();await page.keyboard.press('Enter');await status(page,pages.length);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.RTGPublicApp.shell.next(-100));await status(page,1);
  await openActions(page);await seekEdge(page,page.locator('[data-carousel-prev]'));
  await page.locator('[data-carousel-prev]').focus();await page.keyboard.press('Enter');await status(page,1);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('colofon en praktische informatie zijn compacte native disclosures, met volledige merken en bronnen',async()=>{
 const {context,page,errors}=await pageFor(390);try{
  await openInfo(page);
  for(const id of ['magazineService','colofon']){
   const fold=page.locator('#'+id);assert.equal(await fold.evaluate(e=>e.tagName==='DETAILS'&&!e.open),true);
   await fold.locator(':scope > summary').click();assert.equal(await fold.evaluate(e=>e.open),true);
  }
  assert.match(await page.locator('#colofon').innerText(),/AI-gegenereerde sfeerillustraties/);
  assert.match(await page.locator('#colofon').innerText(),/echte interviewportret/);
  assert.equal(await page.locator('#colofon a[href$="PROVENANCE.json"]').count(),1);
  assert.equal(await page.locator('#colofon a[href$="ink-provenance.json"]').count(),1);
  await page.locator('#magazineService a[href="#prijsbeleid"]').click();assert.equal(await page.locator('#prijsbeleid').isVisible(),true);
  await page.locator('#magazineBack').click();await status(page,1);await openInfo(page);
  await page.locator('.ds-magazine-footer-brand').click();assert.equal(await page.locator('#magazineHome').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('zonder JavaScript blijven alle achttien bladen, acht artikelen en bronverantwoording leesbaar',async()=>{
 const {context,page,missing}=await pageFor(390,'',{javaScriptEnabled:false});try{
  assert.equal(await page.locator('#issueTrack > [data-issue-page]').count(),18);
  assert.equal(await page.locator('[data-issue-article]').count(),8);
  assert.equal(await page.locator('#inhoud').isVisible(),true);
  assert.equal(await page.locator('.ds-issue-controls').isVisible(),false);
  await page.locator('#editie a[href="#inhoudsopgave"]').first().click();assert.equal(new URL(page.url()).hash,'#inhoudsopgave');
  await page.locator('#journal a[href="#artikel-interview"]').first().click();assert.equal(new URL(page.url()).hash,'#artikel-interview');
  assert.equal(await page.locator('#artikel-interview').isVisible(),true);
  assert.match(await page.locator('#artikel-interview').innerText(),/Verrast door schoonheid, kunst en nieuwe perspectieven/);
  await page.locator('#colofon > summary').click();assert.equal(await page.locator('#colofon').evaluate(e=>e.open),true);
  await overflow(page);assert.deepEqual(missing,[]);
 }finally{await context.close();}
});
test('200% tekst en een laag landschapscherm houden covers vast en openen de volledige originele inhoud zonder verloren acties',async()=>{
 const {context,page,errors}=await pageFor(667,'',{viewport:{width:667,height:375}});try{
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  const primary={
   editie:['#inhoudsopgave','#artikel-interview','#artikel-code'],
   interview:['#artikel-interview'],
   'lid-worden':['#passen',...['community','rtg-pass','business-lite','business-pass','lifestyle-pass'].map(id=>'./public/site/passen/'+id+'.html')],
   'tot-ziens':['#begin','#inhoudsopgave']
  };
  for(const id of ['editie','interview','lid-worden','tot-ziens']){
   await showPage(page,id);
   const sheet=page.locator('#'+id);
   assert.equal(await sheet.evaluate(e=>getComputedStyle(e).overflowY),'hidden','een cover heeft geen eigen verticale scroll');
   assert.equal(await page.evaluate(()=>scrollY),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),true,'de cover past binnen het viewport');
   const compact=await completeLeaf(page,id);
   if(compact){
    assert.equal(await sheet.evaluate(e=>getComputedStyle(e).overflowY),'visible','de expliciet geopende reader mag verder lopen');
    assert.equal(await page.locator('body').getAttribute('data-magazine-view'),'article');
    await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));
    await page.waitForFunction(()=>scrollY>100);
   }
   for(const href of primary[id])assert.ok(await sheet.locator('a[href="'+href+'"]:visible').count()>0,id+' behoudt zijn primaire ingang '+href);
   // A deliberately omitted mobile cover teaser is not an interactive target.
   // Require the primary entrances above, then hit-test every displayed action.
   for(const link of await sheet.locator('a:visible').all()){
    if(compact){
     await link.scrollIntoViewIfNeeded();
     // A reader can scroll a link away from the floating Edge. Exercise that
     // actual scroll, not just Playwright's viewport-intersection heuristic.
     const box=await link.boundingBox();await page.mouse.move(12,12);
     await page.mouse.wheel(0,box.y+box.height/2-page.viewportSize().height/2);await settle(page);
    }
    const hit=await link.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,target=document.elementFromPoint(x,y);return r.width>0&&r.height>0&&!!target&&(target===e||e.contains(target));});
    assert.equal(hit,true,id+' houdt acties zichtbaar en aanklikbaar: '+await link.getAttribute('href')+' '+await link.innerText());
   }
   await overflow(page);
   if(compact){await page.locator('#magazineBack').click();await status(page,pages.indexOf(id)+1);}
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
