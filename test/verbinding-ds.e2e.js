/* Echte Foundation-host en echte gezinssessie. /api/doos/status is uitsluitend
   een gemarkeerde presentatiefixture; geen bewijs van Zaakdoos-transport/auth.
   Offline komt van de browsercontext, niet van een gesimuleerd online-event. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,keurLidGoed}=require('./helper');
const {registreerGratis}=require('../scripts/lib/gratisaccount');
const pw=laadPlaywright(),skip=geenBrowser(pw);let srv,browser,tmp,gezin;
test.before(async()=>{
 if(skip)return;
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-verbinding-ds-'));
 srv=await startServer({env:{RTG_DATA_DIR:tmp,RTG_DEMO:'1',SMTP_URL:'',RTG_EXTERNE_AI_UIT:'1',RTG_AI_UIT:'1',LOCAL_AI_URL:'',OPENAI_API_KEY:'',ANTHROPIC_API_KEY:''}});
 const ouder=await registreerGratis(srv.base);assert.ok(ouder);
 await keurLidGoed(srv.base,ouder.token,ouder.codenaam,'1985-05-05');
 const r=await fetch(srv.base+'/api/rtf/eigen-gezin/maak',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ouder.token},body:JSON.stringify({gezinsnaam:'Netwerkproef',naam:'Ouder',bevoegdGezin:true,privacyAkkoord:true})});
 assert.equal(r.status,200);gezin=await r.json();assert.ok(gezin.token&&gezin.profiel);
 browser=await pw.chromium.launch(browserOpties(pw));
});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);if(tmp)fs.rmSync(tmp,{recursive:true,force:true});});
async function hit(locator){
 const info=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return{rect:r.toJSON(),hit:!!h&&(h===el||el.contains(h)),cover:h?.tagName+' '+h?.className};});
 assert.ok(info.hit&&info.rect.width>=44&&info.rect.height>=44,JSON.stringify(info));
}
test('verbinding: offline/herstel, bereikbare bediening en bestaande meldingprioriteit op echte DS-host',{skip,timeout:120000},async()=>{
 const ctx=await browser.newContext({viewport:{width:390,height:1000},locale:'nl-NL',serviceWorkers:'block',reducedMotion:'reduce'});
 const errors=[],requests=[];let page;
 try{
  await ctx.addInitScript(s=>{localStorage.setItem('rtf_sessie',JSON.stringify({code:s.code,token:s.token,profiel:s.profiel}));localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');},gezin);
  page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/doos/status',async route=>{requests.push(route.request().method());await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({doos:true})});});
  await page.goto(srv.base+'/apps/foundation/studie.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.RTGNet&&window.Satelliet&&!document.documentElement.classList.contains('rtf-toegang-dicht')&&document.body.dataset.rtgDesktopState==='ready');
  await page.locator('#rtg-doos-pill').waitFor();assert.deepEqual(requests,['GET']);
  assert.equal(await page.locator('#rtg-doos-pill').textContent(),'● Zaakdoos');
  for(const width of [390,820,1440])for(const zoom of [100,200]){
   await page.setViewportSize({width,height:1000});await page.evaluate(z=>document.documentElement.style.fontSize=z+'%',zoom);
   await ctx.setOffline(true);await page.waitForFunction(()=>navigator.onLine===false&&!document.getElementById('rtg-net-banner').hidden);
   await page.evaluate(()=>Satelliet.zetStand('aan'));
   const rail=page.locator('.ds-net');await rail.waitFor();
   const m=await rail.evaluate(el=>({r:el.getBoundingClientRect().toJSON(),w:el.clientWidth,s:el.scrollWidth,inline:[...el.children].map(n=>n.style.cssText)}));
   assert.ok(m.r.left>=0&&m.r.right<=width+1&&m.s<=m.w+1,JSON.stringify({width,zoom,m}));assert.ok(m.inline.every(s=>s===''));
   // Geen forceclick of wegscrollen van de rail: zichtbare hoofdbediening moet bereikbaar blijven.
   await hit(page.locator('#sbProf'));await page.locator('#sbProf').click();
   await page.locator('#sbMenu').waitFor();await page.keyboard.press('Escape');
   await hit(page.locator('#osMenuBtn'));await page.locator('#osMenuBtn').click();
   await page.locator('.amn-blad').waitFor();await page.keyboard.press('Escape');
   const uit=page.locator('#rtg-sat-balkje button');await hit(uit);await uit.click();
   await page.locator('#rtg-sat-balkje').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>localStorage.getItem('rtg_sat')),'uit');
   await ctx.setOffline(false);await page.waitForFunction(()=>navigator.onLine===true&&document.getElementById('rtg-net-banner').hidden);
  }
  await page.evaluate(()=>{window.__oudeToast=window.toast;window.toast=undefined;RTGNet.fout('Netwerkproef foutmelding');});
  const toast=page.locator('.ds-melding').filter({hasText:'Netwerkproef foutmelding'});await toast.waitFor();
  assert.equal(await toast.evaluate(el=>el.classList.contains('toon')&&getComputedStyle(el).pointerEvents==='none'),true);
  await page.waitForFunction(()=>![...document.querySelectorAll('.ds-melding')].find(n=>n.textContent==='Netwerkproef foutmelding').classList.contains('toon'));
  await page.evaluate(()=>{window.__meldingen=[];window.toast=t=>window.__meldingen.push(t);RTGNet.fout('Eigen appmelding');});
  assert.deepEqual(await page.evaluate(()=>window.__meldingen),['Eigen appmelding']);
  assert.equal(await page.getByText('Eigen appmelding',{exact:true}).count(),0,'bestaande appowner krijgt melding zonder tweede toast');
  await page.evaluate(()=>window.toast=window.__oudeToast);assert.deepEqual(errors,[]);
 }finally{await ctx.setOffline(false);await ctx.close();}
});
