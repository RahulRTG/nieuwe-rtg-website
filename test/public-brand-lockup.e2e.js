'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {laadPlaywright,startBrowser,letOpFouten}=require('./helper');
const root=path.join(__dirname,'..'),hosts=[...['community','rtg-pass','business-lite','business-pass','lifestyle-pass'].map(id=>'/public/site/passen/'+id+'.html'),...['livingos','travelos','workos','foundationos'].map(id=>'/public/site/werelden/'+id+'.html'),'/public/site/techniek/techniek.html','/explore/index.html'];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};let server,browser,base;
const edge='.ds-public-edge',bar=edge+' .rtg-adaptive-bar',sheet=edge+' .rtg-adaptive-sheet',door=edge+' .ds-public-edge-toggle';
test.before(async()=>{
 server=http.createServer((req,res)=>{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}let route=new URL(req.url,'http://localhost').pathname;if(route==='/')route='/index.html';else if(/^\/(ds|fonts|images|shared|site)\//.test(route))route='/public'+route;const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':bytes);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await startBrowser(laadPlaywright({eigenDriver:false}));
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
async function hit(locator){return locator.evaluate(node=>{const b=node.getBoundingClientRect();return b.width>=44&&b.height>=44&&b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight+1&&node.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2));});}
async function menu(page){
 if(!await page.locator(bar).isVisible())await page.locator(door).click();
 const button=page.locator(bar+' [data-rtg-adaptive-action="menu"]');assert.equal(await hit(button),true);
 await button.focus();await page.keyboard.press('Enter');await page.locator(sheet).waitFor({state:'visible'});
}
for(const width of [320,390,1440])test('publieke merkrollen op '+width+'px: elf hosts, transparante lippeningang, intacte lockup en bereikbare taalkeuze',async()=>{
 const context=await browser.newContext({viewport:{width,height:900},locale:'nl-NL',reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('rtg_lang','nl'));
 await context.route('**/*',route=>new URL(route.request().url()).origin===base&&['GET','HEAD'].includes(route.request().method())?route.continue():route.fulfill({status:503,body:'External services and writes blocked in this presentation test'}));
 const page=await context.newPage(),errors=[],missing=[];page.setDefaultTimeout(10000);letOpFouten(page,errors);
 page.on('response',response=>{if(response.status()>=400&&['image','script','stylesheet','font'].includes(response.request().resourceType()))missing.push(response.url());});
 try{for(const host of hosts){
  await page.goto(base+host,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.body.dataset.publicEdgeReady==='true');
  // The original home mark remains the route source. Edge replaces the
  // static header; the latter must not become a second navigation owner.
  const mark=page.locator('.ds-brand-lockup-header .ds-brand-mark');
  assert.equal(await mark.count(),1,host+' canonieke microbron');assert.equal(await mark.isVisible(),false,host+' geen tweede bovenbalk');
  const source=await mark.evaluate(link=>({href:link.href,src:link.querySelector('img').getAttribute('src'),width:link.querySelector('img').naturalWidth,height:link.querySelector('img').naturalHeight}));
  assert.match(source.src,/images\/brand\/rtg-mark\.svg$/);assert.equal(source.href,base+'/');assert.equal(source.width,40);assert.equal(source.height,32);
  assert.equal(await page.locator(door).getAttribute('aria-expanded'),'false');assert.equal(await hit(page.locator(door)),true);
  const lips=await page.locator(door+' img').evaluate(img=>{const b=img.getBoundingClientRect();return {src:img.src,loaded:img.complete&&img.naturalWidth>0,fit:getComputedStyle(img).objectFit,width:b.width,height:b.height,ground:getComputedStyle(img.parentElement).backgroundColor};});
  assert.match(lips.src,/rtg-edge-lips\.webp$/);assert.equal(lips.loaded,true);assert.equal(lips.fit,'contain');assert.ok(lips.width>0&&lips.height>0);assert.equal(lips.ground,'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('.world-shell').count(),1);assert.equal(await page.locator('h1:visible').count(),1);
  assert.equal(await page.locator('.wd-people, .wd-favorites, .wd-greeting').count(),0);assert.equal(await page.locator('link[rel="stylesheet"]').count(),2);
  await menu(page);
  const panel=page.locator('.story-edge-panel nav[aria-label="Ontdek RTG"]');assert.equal(await panel.isVisible(),true);
  assert.deepEqual(await panel.locator('a').evaluateAll(rows=>rows.slice(0,4).map(row=>new URL(row.href).pathname)),['livingos','travelos','workos','foundationos'].map(id=>'/public/site/werelden/'+id+'.html'));
  const lang=panel.locator('[data-language-picker]');await lang.scrollIntoViewIfNeeded();assert.equal(await hit(lang),true,host+' taalkeuze via dezelfde Edge');
  if(host.endsWith('/community.html')){
   await lang.click();await page.waitForFunction(()=>!!document.querySelector('dialog[open],[role="dialog"]:not([hidden])'));
   await page.keyboard.press('Escape');await menu(page);
  }
  const info=panel.locator('[data-public-info]');await info.scrollIntoViewIfNeeded();assert.equal(await hit(info),true);await info.click();
  const logo=page.locator('#publicPageInfo .ds-brand-lockup__image');await logo.scrollIntoViewIfNeeded();
  const lockup=await logo.evaluate(img=>{const b=img.getBoundingClientRect();return {src:img.src,ratio:b.width/b.height,natural:img.naturalWidth/img.naturalHeight,fit:getComputedStyle(img).objectFit,visible:b.width>0&&b.height>0};});
  assert.match(lockup.src,/rahul-travel-group-logo\.jpg$/);assert.equal(lockup.visible,true);assert.ok(Math.abs(lockup.ratio-1280/470)<.01);assert.ok(Math.abs(lockup.natural-1280/470)<.01);assert.equal(lockup.fit,'contain');
  await page.locator(sheet+' [data-rtg-adaptive-close]').click();await page.locator(sheet).waitFor({state:'hidden'});
  await menu(page);await page.keyboard.press('Escape');await page.locator(sheet).waitFor({state:'hidden'});
  assert.equal(await page.locator(door).evaluate(node=>node===document.activeElement),true,host+' Escape herstelt bereikbare lippenfocus');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 }}finally{await context.close();}
});
