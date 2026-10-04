/* Browserbewijs van de pilot, met echte server en echte domeinmutaties.
   Een verloren HTTP-antwoord wordt gesimuleerd nadat de server heeft verwerkt. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./helper');let srv,token,supplier;
const pw=h.laadPlaywright();
async function api(route,body={},auth=token){const r=await fetch(srv.base+route,{method:'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
test.before(async()=>{
 assert.ok(pw,'Een echte browser is vereist voor Experience Proof.');
 srv=await h.startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});
 token=(await api('/api/auth/register',{name:'Avondproef',email:'experience-browser-'+Date.now()+'@example.test',phone:'0612345678',password:'geheim12345',geboortedatum:'1980-01-01',tier:'rtg',pasApp:'rtg'},null)).token;
 const status=await api('/api/onboarding/status');await api('/api/onboarding/teken',{naam:'Avondproef',akkoord:true,contractVersion:status.contract.versie});
 const roster=await api('/api/supplier/roster',{code:'KIKUNOI'},null),manager=roster.staff.find(x=>x.role==='manager');
 supplier=(await api('/api/supplier/login',{code:'KIKUNOI',staffId:manager.id,pin:'1234'},null)).token;
});
test.after(async()=>{if(srv)await h.stop(srv.child);});
for(const width of [390,1440])test(width+'px: context, verloren antwoord, broncontrole, bevestiging en agenda',async()=>{
 const browser=await pw.chromium.launch(h.browserOpties(pw));
 try{
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(token=>{localStorage.setItem('rtg_member_token',token);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');},token);
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(12000);h.letOpFouten(page,errors);
  await page.goto(srv.base+'/apps/app.html');await page.waitForSelector('body[data-rtg-desktop-state="ready"]');
  // Mobiel opent de zichtbare Edge-catalogus de app; desktop vergroot de widget.
  let app;
  if(width===390){
   await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
   await page.locator('button[data-edge-face="all"]').click();
   await page.locator('[data-edge-smart-search]').click();
   await page.locator('.rtg-edge-find input').fill('Food Court');
   await page.locator('.rtg-edge-global-original a[href="/apps/foodcourt.html"]').click();
   await page.waitForURL('**/apps/foodcourt.html');app=page;
   assert.equal(await page.locator('.rtg-adaptive-bar').count(),1);
  }else{
   await page.locator('.wd-library [data-widget="foodcourt"] .wd-widget-open').click();
   const el=await page.waitForSelector('.wd-app-frame:not([hidden])');app=await el.contentFrame();
   await app.waitForSelector('body.rtg-edge-embed');
  }
  await app.waitForSelector('.resto[data-code="KIKUNOI"]');
  await app.locator('#intentRemember').check();
  fs.mkdirSync(path.join(__dirname,'../artifacts/experience'),{recursive:true});
  await app.locator('.resto[data-code="KIKUNOI"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(__dirname,'../artifacts/experience/before-'+width+'.png')});
  await app.locator('.resto[data-code="KIKUNOI"]').click();
  const date=new Date(Date.now()+(width===390?3:4)*86400000).toISOString().slice(0,10);
  await app.locator('#rDatum').fill(date);await app.locator('#rDatum').dispatchEvent('change');
  await app.locator('#rPlus').click();await app.waitForSelector('.slot:not([disabled])');
  await app.locator('#bladTerug').click();
  await app.locator('.resto[data-code="KIKUNOI"]').click();
  assert.equal(await app.locator('#rDatum').inputValue(),date);assert.equal(await app.locator('#rAantal').textContent(),'3');
  // Reloading the embedded page restores only explicit, still valid intent.
  await app.goto(srv.base+'/apps/foodcourt.html');await app.waitForSelector('.resto[data-code="KIKUNOI"]');
  await app.locator('.resto[data-code="KIKUNOI"]').click();
  assert.equal(await app.locator('#rDatum').inputValue(),date);assert.equal(await app.locator('#rAantal').textContent(),'3');
  await app.waitForSelector('.slot[data-tijd="19:00"]:not([disabled])');
  await app.locator('.slot[data-tijd="19:00"]').click();
  assert.match(await app.locator('#rSummary').textContent(),/3 personen/);
  let calls=0;
  await page.route('**/api/reserveer',async route=>{calls++;await route.fetch();await route.abort('failed');});
  await app.locator('#rSubmit').click();await app.waitForSelector('#rCheck:not([hidden])');
  assert.equal(calls,1);assert.match(await app.locator('#rStatus').textContent(),/onbekend/);
  assert.equal(await app.locator('#rDatum').inputValue(),date);
  await app.locator('#rCheck').click();await app.waitForSelector('#rAgenda:not([hidden])');
  assert.match(await app.locator('#rStatus').textContent(),/nog niet bevestigd/);
  const reservations=(await api('/api/reserveringen/mijn')).reserveringen.filter(r=>r.datum===date&&r.tijd==='19:00');
  assert.equal(reservations.length,1);assert.equal(reservations[0].personen,3);
  assert.equal(await app.evaluate(()=>JSON.parse(sessionStorage.getItem('rtg.intent.v1')).rows.filter(r=>r.status==='ACTIVE').length),0);
  await api('/api/supplier/reservering/beslis',{id:reservations[0].id,action:'bevestig'},supplier);
  await app.locator('#rAgenda').click();
  await app.waitForURL('**/apps/agenda.html?datum='+date,{waitUntil:'domcontentloaded'});
  await app.waitForFunction(()=>document.body.innerText.includes('Tafel bij')&&document.body.innerText.includes('bevestigd'));
  if(width===1440){
   await page.waitForFunction(()=>/Agenda/.test(document.querySelector('.wd-focus-head h2').textContent));
   assert.match(await page.locator('.wd-focus-head h2').textContent(),/Agenda/);
  }else{
   await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
   assert.equal(await page.locator('.rtg-adaptive-bar').count(),1,'de agenda houdt dezelfde enkele Edge');
  }
  assert.ok(await app.locator('.litem .wat').first().evaluate(el=>el.getBoundingClientRect().width)>=120,'afspraaktitel houdt leesruimte');
  assert.ok(!(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),'geen horizontale overflow');
  assert.deepEqual(errors,[]);
  const out=path.join(__dirname,'../artifacts/experience');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'dinner-'+width+'.png')});
 }finally{await browser.close();}
});
