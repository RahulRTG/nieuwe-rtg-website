'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {laadPlaywright,startBrowser,letOpFouten}=require('./helper');
const {action:edgeAction,focusVisible,seek}=require('./public-edge-interactions');
const {voorNode}=require('../server/middleware/landing');
const root=path.join(__dirname,'..'),details=[...['community','rtg-pass','business-lite','business-pass','lifestyle-pass'].map(id=>'/public/site/passen/'+id+'.html'),...['livingos','travelos','workos','foundationos'].map(id=>'/public/site/werelden/'+id+'.html'),'/public/site/techniek/techniek.html','/explore/index.html'];
const hosts=['/',...details,'/public/site/404.html'],truth=JSON.parse(fs.readFileSync(path.join(root,'public/site/website-truth.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};let server,browser,base;
test.before(async()=>{
 server=http.createServer((req,res)=>{let route=new URL(req.url,'http://localhost').pathname;if(route==='/node-preview'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(voorNode(fs.readFileSync(path.join(root,'index.html'),'utf8')));}if(route==='/')route='/index.html';else if(/^\/(ds|fonts|images|shared|site)\//.test(route))route='/public'+route;const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404,{'Content-Type':'text/html'});return res.end(fs.readFileSync(path.join(root,'public/site/404.html')));}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 const pw=laadPlaywright({eigenDriver:false});assert.ok(pw,'een echte browserdriver is verplicht');browser=await startBrowser(pw);
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function session(width,javaScriptEnabled=true){
 const context=await browser.newContext({viewport:{width,height:900},locale:'nl-NL',reducedMotion:'reduce',serviceWorkers:'block',javaScriptEnabled});
 if(javaScriptEnabled)await context.addInitScript(()=>localStorage.setItem('rtg_lang','nl'));
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:503,body:'External providers excluded from this public-presentation proof'}));
 const page=await context.newPage(),errors=[],missing=[];letOpFouten(page, errors);page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400&&['stylesheet','script','image','font'].includes(response.request().resourceType()))missing.push(response.status()+' '+response.url());});
 return {context,page,errors,missing};
}
async function loadedPictures(page,host){
 for(const image of await page.locator('img:visible').all()){
  await image.scrollIntoViewIfNeeded();const state=await image.evaluate(async el=>{await el.decode();const r=el.getBoundingClientRect();return {source:el.getAttribute('src'),loaded:el.complete&&el.naturalWidth>0,width:r.width,height:r.height,fit:getComputedStyle(el).objectFit};});
  assert.equal(state.loaded,true,host+' '+state.source);assert.ok(state.width>0&&state.height>0,host+' beeld heeft zichtbare afmetingen');
  if(/rahul-travel-group-logo|rtg-mark\.svg|rtg-ink-artwork|rtg-edge-lips/.test(state.source))assert.equal(state.fit,'contain',host+' hele merkelement blijft zichtbaar');
  if(/rtg-painted-/.test(state.source))await paintedFit(image,host);
 }
}
async function paintedFit(image,label){
 const state=await image.evaluate(el=>({fit:getComputedStyle(el).objectFit,bleed:!!el.closest('.ds-cover-art,.ds-issue-index-images,.ds-volume-sheet--horizon')&&!el.closest('.ds-issue-reader'),ratio:el.getBoundingClientRect().width/el.getBoundingClientRect().height,natural:el.naturalWidth/el.naturalHeight,source:el.getAttribute('src')}));
 if(state.fit==='fill'&&!state.bleed){assert.ok(Math.abs(state.ratio-state.natural)<.01,label+': natuurlijke afbeelding blijft volledig en proportioneel '+JSON.stringify(state));return;}
 assert.equal(state.fit,state.bleed?'cover':'contain',label+': redactionele uitsnede tot de rand, vrijstaande kunst volledig');
}
for(const width of [390,1440])for(const javaScriptEnabled of [true,false])test('hele www: '+width+'px, dertien bronnen '+(javaScriptEnabled?'met runtime':'zonder JavaScript'),async()=>{
 const {context,page,errors,missing}=await session(width,javaScriptEnabled);
 try{for(const host of hosts){
  await page.goto(base+host,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  if(javaScriptEnabled)await page.locator('.ds-public-edge-toggle').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-ds')!==null,true,host+' DS-host');
  assert.equal(await page.locator('body').getAttribute('data-rtg-world'),'living',host+' publieke merkkleur');
  const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(el=>new URL(el.href).pathname));
  assert.equal(styles.length,2,host+' geen dynamisch toegevoegde legacy CSS');assert.ok(styles[0].endsWith('/fonts/fonts.css')&&styles[1].endsWith('/ds/rtg-ds.css'),host+' uitsluitend huisletters en DS');
  const h1=await page.locator('h1:visible').count();if(javaScriptEnabled)assert.equal(h1,1,host+' één zichtbare hoofdtitel');else assert.ok(h1>=1,host+' leesbare fallbacktitel');
  const brand=page.locator('a.ds-brand-mark').first();
  if(javaScriptEnabled){
   assert.equal(await brand.isVisible(),false,host+' Edge vervangt de statische header');
   const door=page.locator('.ds-public-edge-toggle');assert.equal(await door.isVisible(),true,host+' geschilderd navigatiemerk');
   assert.match(await door.locator('img').getAttribute('src'),/rtg-edge-lips\.webp$/);
   const mark=await door.boundingBox();assert.ok(mark.width>=44&&mark.height>=44,host+' transparante ingang heeft een volwaardig klikdoel');
   assert.equal(await door.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)',host+' standaard gesloten ingang is transparant');
  }else{
   assert.equal(await brand.isVisible(),true,host+' no-JS houdt het navigatiemerk');
   const mark=await brand.locator('img').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));assert.equal(mark.width,40);assert.equal(mark.height,32);
  }
  assert.equal(await page.locator('footer img[src$="rahul-travel-group-logo.jpg"]').count(),1,host+' volledige lockup in footer');
  await loadedPictures(page,host);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,host+' geen horizontale overflow');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--ds-accent').trim().toUpperCase()),'#7F1634',host+' bordeaux accent, geen appwereldthema');
  if(details.includes(host)){
   assert.equal(await page.locator('.world-shell').count(),1);
   assert.ok(await page.locator('img[src*="rtg-painted-"]').count()>0,'een statisch geschilderd signatuurbeeld');
   if(host==='/explore/index.html'){assert.equal(await page.locator('.ds-public-story-art img').count(),1);assert.match(await page.locator('.ds-public-story-art figcaption').innerText(),/RTG[\s\S]*AI-gegenereerd/);}
   else {assert.equal(await page.locator('.ds-public-cover img').count(),1);if(await page.locator('body.ds-public-volume').count()){const credit=await page.locator('#colofon').textContent();assert.match(credit,/RTG/);assert.match(credit,/AI-gegenereerd/);assert.ok(await page.locator('#colofon a[href*="provenance" i]').count()>0);}else{assert.match(await page.locator('.ds-public-cover figcaption').innerText(),/RTG|AI/);assert.equal(await page.locator('.ds-public-stroke').count(),1);}}
  }
  if(javaScriptEnabled){
   await edgeAction(page,'menu');
   const language=host==='/'?page.locator('#experienceLanguage'):page.locator('[data-language-picker]').filter({visible:true}).first();
   assert.equal(await language.isVisible(),true,host+' taalkiezer behouden');await seek(page,language);await page.keyboard.press('Enter');assert.ok(await page.locator('[role=dialog],dialog').filter({visible:true}).count()>0,host+' taal opent via toetsenbord');await page.keyboard.press('Escape');
   // De bestaande i18n-owner geeft focus in een volgende event-loop terug.
   // Bewijs eerst die herstelstap voordat de volgende toetsenbordhandeling begint.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await page.locator('[role=dialog],dialog').filter({visible:true}).count(),0,host+' Escape sluit de taalkeuze');
   await focusVisible(page);
   try{await edgeAction(page,'home',false,url=>url.pathname==='/');}catch(error){throw new Error(host+' Edge-home-toetsenbordroute mislukt op '+page.url(),{cause:error});}assert.equal(await page.locator('#magazineHome').isVisible(),true,host+' Edge-home herstelt de voordeur via toetsenbord');
  }
  assert.deepEqual(errors,[],host+' runtimefouten');assert.deepEqual(missing,[],host+' lokale assets');
 }}finally{await context.close();}
});
test('Explore houdt vier bronwerelden, zoekresultaten en canonieke app-links in dezelfde eigenaar',async()=>{
 const {context,page,errors}=await session(390);try{
  await page.goto(base+'/explore/index.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#toolGrid a'));
  for(const world of ['living','travel','work','foundation']){await page.locator('button[data-world="'+world+'"]').click();assert.equal(await page.locator('body').getAttribute('data-explore-world'),world);assert.equal(await page.locator('body').getAttribute('data-rtg-world'),'living');assert.equal(await page.locator('#worldTitle').innerText(),truth.worlds[world].name);assert.equal(await page.locator('#toolGrid a').count(),truth.worlds[world].tools.length);}
  const term=truth.worlds.work.tools[0].name;await page.locator('#exploreSearch').fill(term);assert.equal(await page.locator('#worldTitle').innerText(),'Zoekresultaten');assert.ok(await page.locator('#toolGrid a').count()>0);assert.match(await page.locator('#toolGrid').innerText(),new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const href of await page.locator('#toolGrid a').evaluateAll(links=>links.map(link=>link.href)))assert.ok(href.startsWith('https://app.rahultravelgroup.com/apps/'));
  await page.locator('#exploreSearch').fill('geen-bestaand-onderdeel-rtg-xyz');assert.equal(await page.locator('#toolGrid a').count(),0);assert.match(await page.locator('#toolGrid').innerText(),/Geen onderdeel gevonden/);
  await page.locator('#exploreSearch').fill('');assert.equal(await page.locator('#worldTitle').innerText(),truth.worlds.foundation.name);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
for(const width of [390,1440])test('homepage blijft Living na #werelden, #explore, wereldkeuze en asynchrone appwaarheid op '+width+'px',async()=>{
 const {context,page,errors}=await session(width);
 async function living(label){assert.equal(await page.locator('body').getAttribute('data-rtg-world'),'living',label);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--ds-accent').trim().toUpperCase()),'#7F1634',label+' bordeaux');}
 try{
  await page.goto(base+'/#werelden',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.RTGPublicApp&&document.documentElement.dataset.websiteTruth==='actueel');
  assert.equal(await page.locator('#werelden').isVisible(),true);await living('na directe wereldenroute en geladen appwaarheid');
  await page.locator('.ds-public-world-choices [data-select-world="travel"]').click();assert.equal(await page.evaluate(()=>window.RTGExperience.currentWorld()),'travel');assert.equal(await page.locator('[data-room="travel"]').isVisible(),true);assert.equal(await page.locator('.ds-public-world-choices [aria-pressed="true"]').count(),1);assert.equal(await page.locator('.ds-public-world-choices [data-select-world="travel"]').getAttribute('aria-pressed'),'true');await living('na TravelOS kiezen via zichtbare bediening');
  await page.evaluate(()=>window.RTGExperience.nextWorld(1));assert.equal(await page.evaluate(()=>window.RTGExperience.currentWorld()),'work');assert.equal(await page.locator('[data-room="work"]').isVisible(),true);await living('na volgende wereld');
  await page.goto(base+'/#explore',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.RTGPublicApp&&document.documentElement.dataset.websiteTruth==='actueel');assert.equal(await page.locator('#explore').isVisible(),true);await living('na directe Explorereoute');
  for(const world of ['travel','work','foundation','living']){await page.locator('#explore [data-explore-world="'+world+'"]').click();assert.equal(await page.locator('#exploreName').innerText(),truth.worlds[world].name);await living('na cataloguswereld '+world);}
  await page.locator('#explore [data-explore-world="work"]').click();
  await page.evaluate(async()=>{const source=new URL('site/website-truth.json',window.RTGPublicPlatform.asset()),response=await fetch(source,{credentials:'same-origin'});if(!response.ok)throw new Error('appwaarheid niet beschikbaar');window.RTGWebsiteTruthRefresh(await response.json());});
  assert.equal(await page.locator('#exploreName').innerText(),truth.worlds.work.name);await living('na asynchrone herlevering van de echte appwaarheid');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('mobiele prijzen houden leesbare kolommen in een toetsenbord-scrollbare tabel zonder pagina-overflow',async()=>{
 for(const width of [320,390]){
  const {context,page,errors,missing}=await session(width);try{
   await page.goto(base+'/#passen',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.RTGPublicApp);
   const region=page.getByRole('region',{name:'Alle vijf passen vergelijken',exact:true});await region.scrollIntoViewIfNeeded();
   const size=await region.evaluate(el=>{const table=el.querySelector('table'),rem=parseFloat(getComputedStyle(document.documentElement).fontSize);return {client:el.clientWidth,scroll:el.scrollWidth,table:table.getBoundingClientRect().width,rem,overflow:getComputedStyle(el).overflowX,cells:Array.from(table.querySelectorAll('th,td')).map(cell=>({min:parseFloat(getComputedStyle(cell).minInlineSize),wrap:getComputedStyle(cell).overflowWrap,wordBreak:getComputedStyle(cell).wordBreak}))};});
   assert.ok(size.scroll>size.client,width+'px: tabel heeft een eigen horizontaal scrollvlak');assert.equal(size.overflow,'auto');assert.ok(size.table>=64*size.rem,width+'px: tabel behoudt 64rem leesbreedte');
   for(const cell of size.cells){assert.ok(cell.min>=12*size.rem,width+'px: cel behoudt 12rem');assert.equal(cell.wrap,'normal');assert.equal(cell.wordBreak,'normal');}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+'px: alleen de tabel scrolt');
   await region.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('[aria-label="Alle vijf passen vergelijken"]').scrollLeft>0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+'px: scrollen verbreedt de pagina niet');assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  }finally{await context.close();}
 }
});
test('Living-demostappen gebruiken de volle desktopgridbreedte en één mobiele kolom',async()=>{
 for(const width of [390,1440]){
  const {context,page,errors}=await session(width);try{
   await page.goto(base+'/public/site/werelden/livingos.html#proberen',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.RTGWorldStory);await page.locator('[data-story-demo]').waitFor({state:'visible'});
   const layout=await page.locator('[data-story-demo] .simulation-main').evaluate(main=>{const steps=main.querySelector('.connection-steps'),m=main.getBoundingClientRect(),s=steps.getBoundingClientRect(),ms=getComputedStyle(main),ss=getComputedStyle(steps);return {main:{left:m.left,right:m.right,width:m.width,columns:ms.gridTemplateColumns.split(/\s+/).length},steps:{left:s.left,right:s.right,width:s.width,columns:ss.gridTemplateColumns.split(/\s+/).length,start:ss.gridColumnStart,end:ss.gridColumnEnd}};});
   assert.ok(Math.abs(layout.main.left-layout.steps.left)<=1,width+'px: stappen beginnen aan de linkerrand van de demogrid');assert.ok(Math.abs(layout.main.right-layout.steps.right)<=1,width+'px: stappen eindigen aan de rechterrand van de demogrid');
   assert.equal(layout.steps.start,'1');assert.equal(layout.steps.end,'-1');assert.equal(layout.main.columns,width<768?1:3,width+'px: hoofdgridkolommen');assert.equal(layout.steps.columns,width<768?1:3,width+'px: stappenpaneelkolommen');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+'px: demo veroorzaakt geen pagina-overflow');assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
});
test('geïsoleerde Node-HTML-projectie via echte voorNode laadt kunst en DS met behoud van Living',async()=>{
 for(const width of [390,1440]){
  const {context,page,errors,missing}=await session(width);try{
   const response=await page.goto(base+'/node-preview',{waitUntil:'networkidle'});assert.equal(await response.text(),voorNode(fs.readFileSync(path.join(root,'index.html'),'utf8')),'de proef serveert de werkelijke transformatie, geen tweede HTML-bron');
   await page.waitForFunction(()=>!!window.RTGPublicApp&&document.documentElement.dataset.websiteTruth==='actueel');await page.evaluate(()=>document.fonts.ready);
   for(const name of ['rtg-api-base','rtg-app-base','rtg-asset-base'])assert.equal(await page.locator('meta[name="'+name+'"]').getAttribute('content'),'/');
   assert.deepEqual(await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(el=>new URL(el.href).pathname)),['/fonts/fonts.css','/ds/rtg-ds.css']);
   const art=page.locator('#magazineHome img[src*="rtg-painted-"]');assert.equal(await art.count(),3);
   for(const image of await art.all()){
    await image.scrollIntoViewIfNeeded();const state=await image.evaluate(async el=>{await el.decode();return {source:el.getAttribute('src'),loaded:el.complete&&el.naturalWidth>0};});assert.match(state.source,/^\/images\/brand\/rtg-painted-/);assert.equal(state.loaded,true);await paintedFit(image,'Node-projectie');
   }
   assert.equal(await page.locator('[data-app-path="/apps/app.html"]').first().evaluate(el=>el.href),base+'/apps/app.html','de oorspronkelijke app-link blijft na runtimeherleiding op dezelfde origin, ook buiten de cover');
   await page.evaluate(()=>window.RTGPublicApp.open('world:travel'));assert.equal(await page.evaluate(()=>window.RTGExperience.currentWorld()),'travel');assert.equal(await page.locator('body').getAttribute('data-rtg-world'),'living');assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--ds-accent').trim().toUpperCase()),'#7F1634');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  }finally{await context.close();}
 }
});
for(const [world,scenario] of [['living','dinner'],['travel','travel'],['work','work'],['foundation','family']])test(world+' behoudt zijn eigen demonstratie, keuze, toestemming en herstel',async()=>{
 const {context,page,errors}=await session(390);try{
  await page.goto(base+'/public/site/werelden/'+world+'os.html#proberen',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.RTGWorldStory);await page.locator('[data-story-demo]').waitFor({state:'visible'});
  const demo=page.locator('[data-story-demo]'),select=demo.locator('select'),initial=await select.inputValue();assert.equal(await demo.locator('[data-story-scenario]').getAttribute('data-story-scenario'),scenario);
  const options=await select.locator('option').evaluateAll(rows=>rows.map(row=>row.value));assert.equal(options.length,2);const before=await demo.locator('.connection-steps').innerText();
  await demo.locator('.connection-steps summary').first().click();await select.selectOption(options[1]);assert.notEqual(await demo.locator('.connection-steps').innerText(),before);assert.equal(await demo.locator('.connection-steps details').first().getAttribute('open'),'');
  await demo.locator('.story-permission input').uncheck();assert.match(await demo.locator('.connection-steps').innerText(),/Geen|niet gedeeld/i);assert.equal(await page.locator('body').getAttribute('data-rtg-world'),'living');
  await page.evaluate(()=>window.RTGWorldStory.reset());assert.equal(await select.inputValue(),initial);assert.equal(await demo.locator('.story-permission input').isChecked(),true);assert.match(await demo.innerText(),/niets geboekt, betaald of gedeeld/);
  await page.evaluate(()=>window.RTGWorldStory.proposal());assert.equal(await select.evaluate(el=>el===document.activeElement),true);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('404 werkt als direct statisch document én als antwoord op een diepe onbekende Node-route',async()=>{
 const {context,page,errors,missing}=await session(390);try{
  for(const route of ['/public/site/404.html','/site/404.html','/onbekend/diep/niet-bestaand']){const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),route.startsWith('/onbekend/')?404:200);assert.match(await page.locator('h1').innerText(),/andere route/i);assert.match(await page.locator('.world-lead').innerText(),/Deze pagina bestaat niet/);await loadedPictures(page,route);assert.equal(await page.locator('a.ds-brand-mark').first().getAttribute('href'),'/');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 }finally{await context.close();}
});
