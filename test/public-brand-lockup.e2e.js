'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {laadPlaywright,browserOpties}=require('./helper');
const root=path.join(__dirname,'..'),hosts=[...['community','rtg-pass','business-lite','business-pass','lifestyle-pass'].map(id=>'/public/site/passen/'+id+'.html'),...['livingos','travelos','workos','foundationos'].map(id=>'/public/site/werelden/'+id+'.html'),'/public/site/techniek/techniek.html','/explore/index.html'];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};let server,browser,base;
test.before(async()=>{
 server=http.createServer((req,res)=>{let route=new URL(req.url,'http://localhost').pathname;if(route==='/')route='/index.html';else if(/^\/(ds|fonts|images|shared|site)\//.test(route))route='/public'+route;const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':bytes);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const pw=laadPlaywright();browser=await pw.chromium.launch(browserOpties(pw));
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
for(const width of [320,390,1440])test('publiek sublogo op '+width+'px: elf hosts, 40×32 beeld, bronroutes en werkende taalkeuze',async()=>{
 const context=await browser.newContext({viewport:{width,height:900},locale:'nl-NL',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('rtg_lang','nl'));
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:503,body:'External service outside this presentation test'}));
 const page=await context.newPage();
 try{for(const host of hosts){
  await page.goto(base+host,{waitUntil:'networkidle'});await page.locator('.ds-brand-lockup-header').waitFor();
  const proof=await page.locator('.ds-brand-lockup-header').evaluate(header=>{const link=header.querySelector('.ds-brand-mark'),img=link.querySelector('img'),rect=img.getBoundingClientRect(),lr=link.getBoundingClientRect(),hr=header.getBoundingClientRect();return {source:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth===40&&img.naturalHeight===32,width:rect.width,height:rect.height,clickWidth:lr.width,clickHeight:lr.height,href:link.href,fit:getComputedStyle(img).objectFit,top:rect.top,headerTop:hr.top,headerRight:hr.right,headerBottom:hr.bottom,imageBottom:rect.bottom,visibleLogos:document.querySelectorAll('.ds-brand-lockup-header').length};});
  assert.equal(proof.loaded,true,host);assert.match(proof.source,/images\/brand\/rtg-mark\.svg$/);assert.equal(proof.fit,'contain');
  assert.equal(await page.locator('.ds-brand-lockup-header').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)',host+' bordeaux merk op lichte grond');
  assert.equal(proof.width,40,host+' beeldbreedte');assert.equal(proof.height,32,host+' beeldhoogte');assert.equal(proof.href,base+'/',host+' oorspronkelijke startpagina-route');
  assert.ok(proof.clickWidth>=44&&proof.clickHeight>=44,host+' minimaal 44px klikvlak');
  assert.ok(proof.top>=0,host+' logo boven zichtbare rand');assert.ok(proof.headerRight<=width+1,host+' header past op scherm');assert.ok(proof.imageBottom<=proof.headerBottom+1,host+' hele markering binnen kop');assert.equal(proof.visibleLogos,1);
  assert.equal(await page.locator('.world-shell').count(),1,host+' oorspronkelijke inhoud blijft bestaan');
  assert.equal(await page.locator('h1:visible').count(),1,host+' geen duplicaat van de artikeltitel in een desktopzijbalk');
  assert.equal(await page.locator('.wd-people, .wd-favorites, .wd-greeting').count(),0,host+' de publieke site krijgt geen parallel bureaublad');
  assert.equal(await page.locator('link[rel="stylesheet"]').count(),2,host+' volledige DS-migratie');
  const lang=page.locator('.ds-brand-lockup-header [data-language-picker]');assert.equal(await lang.isVisible(),true,host+' taalknop behouden');
  if(host.endsWith('/community.html')){await lang.click();assert.ok(await page.locator('[role=dialog],dialog').filter({visible:true}).count()>0);await page.keyboard.press('Escape');}
  if(width===390){
   const menu=page.locator('[data-public-menu]');assert.equal(await menu.isVisible(),true,host+' menu blijft een echte knop');
   async function expanded(value,action){try{await page.waitForFunction(expected=>document.querySelector('[data-public-menu]').getAttribute('aria-expanded')===expected,String(value),{timeout:5000});}catch(error){throw new Error(host+' menu '+action+' ontbreekt',{cause:error});}}
   await menu.focus();await page.keyboard.press('Enter');await expanded(true,'openen met Enter');
   const panel=page.locator('.story-edge-panel nav[aria-label="Ontdek RTG"]');assert.equal(await panel.isVisible(),true,host+' menu opent via toetsenbord');
   const links=await panel.locator('a').evaluateAll(rows=>rows.slice(0,4).map(row=>new URL(row.href).pathname));assert.deepEqual(links,['livingos','travelos','workos','foundationos'].map(id=>'/public/site/werelden/'+id+'.html'),host+' bronroutes blijven in dezelfde menu-owner');
   await menu.click();await expanded(false,'sluiten met dezelfde knop');assert.equal(await panel.isVisible(),false,host+' dezelfde knop sluit');
   await menu.focus();await page.keyboard.press('Enter');await expanded(true,'heropenen met Enter');
   await page.keyboard.press('Escape');await expanded(false,'sluiten met Escape');assert.equal(await panel.isVisible(),false,host+' Escape sluit');
  }
 }}finally{await context.close();}
});
