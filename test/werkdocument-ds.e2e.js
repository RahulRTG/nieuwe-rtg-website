/* Echte Room-routes/controllers en via de API opgebouwde lokale dossiers.
   Bewijst presentatie en navigatie; geen financiële/rolkwalificatie of besluiten. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const {startWerkdocumentFixture}=require('./lib/werkdocument-fixture');
const {nativeModalTab,bladen}=require('./lib/ds-toets');
const pw=laadPlaywright();let fixture,browser,token,office,srv;
test.before(async()=>{if(geenBrowser(pw))return;fixture=await startWerkdocumentFixture();
 ({token,office,srv}=fixture);browser=await pw.chromium.launch(browserOpties(pw));});
test.after(async()=>{try{if(browser)await browser.close();}finally{if(fixture)await fixture.sluit();}});
for(const [naam,route,prefix,standen] of [['project-room','/apps/project-room.html','pr',['uitvoering','dossier','oplevering']],['decision-room','/apps/decision-room.html','dr',['agenda','afweging','besluit','archief']]]){
 test(naam+': responsieve DS-presentatie, echte navigatiehooks en bestaande intake',{skip:geenBrowser(pw),timeout:60000},async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'nl-NL',serviceWorkers:'block',reducedMotion:'reduce'});
  try{
   await context.addInitScript(({token,office})=>{localStorage.setItem('rtg_member_token',token);localStorage.setItem('rtg_office_token',office);localStorage.setItem('rtg_cookieinfo_v1','1');localStorage.setItem('rtg_lang','nl');},{token,office});
   const page=await context.newPage(),fouten=letOpFouten(page,[]),calls=[];
   page.on('request',request=>{if(new URL(request.url()).pathname==='/api/rtgone/state')calls.push({body:request.postDataJSON(),authorization:request.headers().authorization});});
   await page.goto(srv.base+route,{waitUntil:'domcontentloaded'});
   await page.locator('.'+prefix+'-focus').waitFor();await page.waitForFunction(()=>document.body.dataset.rtgDesktopState==='ready');
   const fonts=await page.evaluate(async()=>{const css=getComputedStyle(document.documentElement),out=[];for(const token of ['--ds-letter-display','--ds-letter-tekst']){const family=css.getPropertyValue(token).trim().split(',')[0],faces=await document.fonts.load('400 16px '+family,'RTG werkruimte');out.push({token,family,status:faces.map(f=>f.status)});}return out;});assert.ok(fonts.every(f=>f.family&&f.status.length>0&&f.status.every(s=>s==='loaded')),JSON.stringify(fonts));
   const bron=prefix==='pr'?fixture.huizen.rtg.project:fixture.huizen.rtg.besluit;
   assert.ok((await page.locator('.'+prefix+'-focus').innerText()).includes(bron.titel),'het echte API-dossier is zichtbaar');
   for(const width of [390,820,1440])for(const zoom of [100,200]){
    await page.setViewportSize({width,height:1000});await page.evaluate(n=>{document.documentElement.style.fontSize=n+'%';},zoom);
    for(const stand of standen){await page.locator('.'+prefix+'-nav [data-'+prefix+'-open="'+stand+'"]').click();
     assert.equal(await page.locator('[data-'+prefix+'-paneel="'+stand+'"]').isVisible(),true);
     const geometry=await page.locator('.ds-werkdocument-app').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,buttons:[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))}));
     if(geometry.scroll>geometry.client+1)geometry.overloop=await page.locator('.ds-werkdocument-app').evaluate(el=>[...el.querySelectorAll('*')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>el.getBoundingClientRect().right+1).slice(0,12).map(e=>({tag:e.tagName,id:e.id,klasse:e.className,tekst:e.textContent.slice(0,140),rect:e.getBoundingClientRect().toJSON()})));
     assert.ok(geometry.scroll<=geometry.client+1,JSON.stringify({width,zoom,stand,geometry}));assert.ok(geometry.buttons.every(b=>b.w>=44&&b.h>=44),JSON.stringify(geometry.buttons));
     if(process.env.RTG_SCREENSHOT_DIR&&zoom===100&&stand===standen[0]&&width!==820){fs.mkdirSync(process.env.RTG_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RTG_SCREENSHOT_DIR,naam+'-'+width+'.png'),fullPage:true});}
    }
   }
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='100%';});
   await page.locator('[data-'+prefix+'-huis="rtf"]').click();await page.waitForFunction(p=>document.querySelector('[data-'+p+'-huis="rtf"]').getAttribute('aria-pressed')==='true',prefix);
   assert.ok(calls.some(c=>c.body.huis==='rtf'));assert.ok(calls.every(c=>c.authorization==='Bearer '+office));
   if(prefix==='pr')await page.locator('.pr-nav [data-pr-open="oplevering"]').click();
   const opener=prefix==='dr'?page.locator('.dr-kop [data-dr-nieuw]'):page.locator('[data-pr-bewijs]');
   const dialog=page.locator(prefix==='dr'?'#drIntake':'#prBewijsLaag');
   const form=page.locator(prefix==='dr'?'#drIntakeForm':'#prBewijsForm');
   await opener.click();await dialog.waitFor();assert.equal(await dialog.evaluate(e=>e.matches(':modal')),true);
   await form.locator('[name=titel]').fill('Onopgeslagen concept');
   for(let i=0;i<18;i++)await nativeModalTab(page,dialog);
   await opener.evaluate(e=>e.focus());assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true,'achtergrondfocus blijft geblokkeerd');
   assert.equal(await form.locator('[name=titel]').inputValue(),'Onopgeslagen concept');
   // HTML required accepteert spaties, de echte servertrim weigert ze.
   // Dit beproeft de modal-foutplek zonder mockresponse of opgeslagen besluit.
   await form.locator('[name=titel]').fill('   ');await form.locator(prefix==='pr'?'[name=uitleg]':'[name=reden]').fill('Deze onderbouwing blijft na afwijzing behouden.');
   const afgewezen=page.waitForResponse(r=>new URL(r.url()).pathname===(prefix==='pr'?'/api/rtgone/project/bewijs':'/api/rtgone/goedkeuring'));
   await form.locator('[type=submit]').click();const response=await afgewezen;assert.equal(response.status(),400);
   const foutplek=form.locator('[role=alert]');await foutplek.waitFor();
   assert.equal(await foutplek.textContent(),(await response.json()).error);assert.equal(await dialog.evaluate(e=>e.matches(':modal')),true);
   assert.equal(await form.locator(prefix==='pr'?'[name=uitleg]':'[name=reden]').inputValue(),'Deze onderbouwing blijft na afwijzing behouden.');
   await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await opener.evaluate(e=>e===document.activeElement),true);
   await opener.click();await form.locator('[data-'+prefix+'-sluit]').first().click();assert.equal(await dialog.isVisible(),false);assert.equal(await opener.evaluate(e=>e===document.activeElement),true);
   await opener.click();await page.mouse.click(1,1);assert.equal(await dialog.isVisible(),false);assert.equal(await opener.evaluate(e=>e===document.activeElement),true);

   const css=await bladen(page);assert.ok(css.includes('/ds/rtg-ds.css'));assert.ok(css.every(p=>/^\/(ds|fonts)\//.test(p)),JSON.stringify(css));
   assert.deepEqual(fouten,[]);
   for(const huis of ['rtg','rtf']){const state=await fixture.state(huis);assert.equal(state.projecten.length,1);assert.equal(state.goedkeuringen.length,1);assert.equal(state.goedkeuringen[0].status,'wacht');assert.deepEqual(state.goedkeuringen[0].stemmen,[]);}
  }finally{await context.close();}
 });
}
