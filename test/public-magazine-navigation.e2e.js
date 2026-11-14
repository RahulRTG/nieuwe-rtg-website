'use strict';
// Reader-only proof. A static local fixture, with no provider or mutation traffic.
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {laadPlaywright,startBrowser,letOpFouten}=require('./helper');
const root=path.join(__dirname,'..');let server,browser,base;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
test.before(async()=>{
 server=http.createServer((req,res)=>{
  let route=new URL(req.url,'http://localhost').pathname;
  if(route==='/')route='/index.html';else if(/^\/(ds|fonts|images|shared|site)\//.test(route))route='/public'+route;
  const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':bytes);});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 browser=await startBrowser(laadPlaywright({eigenDriver:false}));
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function reader(hash='',blockedStorage=false){
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'nl-NL',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(blocked=>{
  localStorage.setItem('rtg_lang','nl');
  if(blocked)Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Storage refused','SecurityError');}});
 },blockedStorage);
 await context.route('**/*',route=>new URL(route.request().url()).origin===base&&['GET','HEAD'].includes(route.request().method())?route.continue():route.fulfill({status:503,body:'Reader fixture: external traffic excluded'}));
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);letOpFouten(page, errors);
 await page.goto(base+'/'+hash,{waitUntil:'networkidle'});await ready(page);
 return {context,page,errors};
}
async function ready(page){await page.waitForFunction(()=>!!window.RTGPublicApp&&!!history.state?.rtgMagazine);await page.evaluate(()=>document.fonts.ready);}
async function leaf(page,id){await page.waitForFunction(id=>!document.getElementById('magazineHome').hidden&&document.querySelector('[data-issue-caption]').textContent===document.getElementById(id).dataset.issueLabel,id);}
async function article(page,id){await page.waitForFunction(id=>document.getElementById('magazineHome').hidden&&document.getElementById('magazineDetailContent').firstElementChild?.id===id,id);}
async function scrollAndSave(page,y){
 await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);
 await page.waitForFunction(()=>Math.abs(history.state.rtgMagazine.scroll-window.scrollY)<2&&window.scrollY>100);
 return page.evaluate(()=>window.scrollY);
}
async function restoredScroll(page,y){await page.waitForFunction(y=>Math.abs(window.scrollY-y)<3,y);}

test('browser-terug en vooruit bewaren het blad, dezelfde artikelnode, focus en verticale leesplek',async()=>{
 const {context,page,errors}=await reader('#interview');try{
  await leaf(page,'interview');
  await page.evaluate(()=>{window.__originalArticle=document.getElementById('artikel-interview');});
  const entry=page.locator('#interview a[href="#artikel-interview"]').last();await entry.click();await article(page,'artikel-interview');
  const y=await scrollAndSave(page,410);
  await page.goBack();await leaf(page,'interview');
  await page.waitForFunction(()=>document.activeElement===Array.from(document.querySelectorAll('#interview a[href="#artikel-interview"]')).at(-1));
  await page.goForward();await article(page,'artikel-interview');await restoredScroll(page,y);
  assert.equal(await page.evaluate(()=>document.getElementById('artikel-interview')===window.__originalArticle),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('een nieuwe bladkeuze direct na terug wordt niet overschreven door uitgesteld leesplekherstel',async()=>{
 const {context,page,errors}=await reader('#interview');try{
  await page.locator('#interview a[href="#artikel-interview"]').last().click();await article(page,'artikel-interview');
  const result=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const home=document.getElementById('magazineHome');
   const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Magazine did not return within three seconds'));},3000);
   // Observe the actual return transition, before either delayed restore frame.
   // Polling for visibility can miss this race entirely on a fast machine.
   const observer=new MutationObserver(()=>{
    if(home.hidden)return;observer.disconnect();window.RTGPublicApp.shell.page('ondernemen');
    requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
     const leaf=document.getElementById('ondernemen'),track=leaf.parentElement;
     clearTimeout(timeout);
     resolve({id:history.state.rtgMagazine.id,caption:document.querySelector('[data-issue-caption]').textContent,
      expected:leaf.dataset.issueLabel,offset:Math.abs(leaf.getBoundingClientRect().left-track.getBoundingClientRect().left)});
    })));
   });
   observer.observe(home,{attributes:true,attributeFilter:['hidden']});document.getElementById('magazineBack').click();
  }));
  assert.equal(result.id,'ondernemen');assert.equal(result.caption,result.expected);assert.ok(result.offset<2);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('Het magazine keert ook na twee onderling gelinkte artikelen terug naar de oorspronkelijke ingang',async()=>{
 const {context,page,errors}=await reader('#interview');try{
  await page.locator('#interview a[href="#artikel-interview"]').last().click();await article(page,'artikel-interview');
  await page.locator('#artikel-interview a[href="#artikel-reizen"]').click();await article(page,'artikel-reizen');
  assert.equal(await page.evaluate(()=>history.state.rtgMagazine.depth),2);
  await page.locator('#magazineBack').click();await leaf(page,'interview');
  await page.waitForFunction(()=>document.activeElement===Array.from(document.querySelectorAll('#interview a[href="#artikel-interview"]')).at(-1));
  await page.goForward();await article(page,'artikel-interview');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('inhoud is vanuit een artikel bereikbaar en browser-terug brengt de lezer naar exact dezelfde passage',async()=>{
 const {context,page,errors}=await reader('#interview');try{
  await page.locator('#interview a[href="#artikel-interview"]').last().click();await article(page,'artikel-interview');
  const y=await scrollAndSave(page,350);
  // The fixed Edge is the current contents entrance. Clicking the offscreen
  // old reader header first scrolls the document to 0 (also on the live parent)
  // and correctly saves 0, so it cannot prove preservation of this passage.
  await page.locator('.ds-public-edge-toggle').click();
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
  const contents=page.locator('.ds-public-edge .pp-menu-panel').getByRole('button',{name:'Inhoud van deze editie',exact:true});
  assert.equal(await contents.count(),1,'de leesstand heeft één oorspronkelijke inhoudsactie');
  await contents.focus();
  assert.equal(await page.evaluate(()=>scrollY),y,'de Edge verplaatst de artikelpassage niet');
  await contents.click();await leaf(page,'inhoudsopgave');
  await page.goBack();await article(page,'artikel-interview');await restoredScroll(page,y);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('herladen herstelt de artikelpassage en de eigen terugknop blijft na herladen coherent',async()=>{
 const {context,page,errors}=await reader('#interview');try{
  await page.locator('#interview a[href="#artikel-interview"]').last().click();await article(page,'artikel-interview');
  const y=await scrollAndSave(page,460);await page.reload({waitUntil:'networkidle'});await ready(page);
  await article(page,'artikel-interview');await restoredScroll(page,y);
  await page.locator('#magazineBack').click();await leaf(page,'interview');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('tablokale leescoordinaten herstellen zonder historystate en bevatten geen vrije invoer',async()=>{
 const {context,page,errors}=await reader('#interview');try{
  await page.locator('#interview a[href="#artikel-interview"]').last().click();await article(page,'artikel-interview');
  const y=await scrollAndSave(page,320);
  const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rtg-magazine-reading-v1:'+location.pathname)));
  assert.deepEqual(Object.keys(stored).sort(),['v','edition','kind','id','page','scroll','leaf','returnScroll','returnLeaf','entry','entryIndex','depth','hash'].sort());
  await page.evaluate(()=>history.replaceState(null,'',location.pathname));await page.reload({waitUntil:'networkidle'});await ready(page);
  await article(page,'artikel-interview');await restoredScroll(page,y);
  await page.locator('#magazineBack').click();await leaf(page,'interview');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('storageweigering en een gedeelde directe artikellink blokkeren nooit lezen of terugkeren',async()=>{
 const {context,page,errors}=await reader('#artikel-interview',true);try{
  await article(page,'artikel-interview');await page.locator('#magazineBack').click();await leaf(page,'interview');
  await page.locator('#interview a[href="#artikel-interview"]').last().click();await article(page,'artikel-interview');
  await page.goBack();await leaf(page,'interview');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('bladherstel volgt stabiele IDs na refresh en schermrotatie zonder de blader-URL te veranderen',async()=>{
 const {context,page,errors}=await reader();try{
  const hash=new URL(page.url()).hash;
  await page.evaluate(()=>window.RTGPublicApp.shell.next(4));
  await page.waitForFunction(()=>history.state.rtgMagazine.id===document.querySelectorAll('[data-issue-page]')[4].id);
  const id=await page.evaluate(()=>history.state.rtgMagazine.id);assert.equal(new URL(page.url()).hash,hash);
  await page.reload({waitUntil:'networkidle'});await ready(page);await leaf(page,id);
  await page.setViewportSize({width:844,height:390});await leaf(page,id);
  const alignment=await page.locator('#'+id).evaluate(element=>Math.abs(element.getBoundingClientRect().left-element.parentElement.getBoundingClientRect().left));
  assert.ok(alignment<2);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
