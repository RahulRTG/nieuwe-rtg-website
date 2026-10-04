/* De zichtbare Travel-reis: voorbereiding, antwoordverlies, broncontrole,
   menselijke bevestiging en terugvinden in het reisoverzicht. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),h=require('./helper');
const pw=h.laadPlaywright();let srv,office;
async function api(route,body={},token){const r=await fetch(srv.base+route,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
test.before(async()=>{assert.ok(pw,'Travel Proof vereist een echte browser.');srv=await h.startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});office=await h.kantoorAlsPersoon(srv.base);assert.ok(office);});
test.after(async()=>{if(srv)await h.stop(srv.child);});
for(const width of [390,1440])test(width+'px: Travel bewaart context, herstelt antwoordverlies en toont de bevestigde reis',async()=>{
 const token=(await api('/api/auth/register',{name:'Reisproef',email:'travel-browser-'+width+'-'+Date.now()+'@example.test',phone:'0612345678',password:'geheim12345',geboortedatum:'1980-01-01',tier:'rtg',pasApp:'rtg'})).token;
 const onboarding=await api('/api/onboarding/status',{},token);await api('/api/onboarding/teken',{naam:'Reisproef',akkoord:true,contractVersion:onboarding.contract.versie},token);
 const browser=await pw.chromium.launch(h.browserOpties(pw));
 try{
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');},token);
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(15000);h.letOpFouten(page,errors);
  await page.goto(srv.base+'/apps/reizen.html');await page.waitForSelector('body[data-rtg-desktop-state="ready"]');
  let app;
  if(width<1000){
   await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
   await page.getByRole('tab', { name: 'Heel RTG', exact: true }).click();
   await page.locator('[data-edge-smart-search]').click();
   await page.locator('.rtg-edge-find input:visible').fill('reisbureau');
   await page.locator('.rtg-edge-group a[href="/apps/reisbureau.html"]:visible').click();
   await page.waitForURL('**/apps/werkruimte.html?gebied=reizen&open=reisbureau');
   app=await (await page.waitForSelector('iframe[src*="/apps/reisbureau.html"]:visible')).contentFrame();
   await app.waitForSelector('body.rtg-edge-embed');
   assert.equal(await page.locator('.rtg-adaptive-bar').count(),1,'één Edge rondom de geopende reisapp');
  }else{
   await page.locator('.wd-library .wd-app-controls summary').click();
   await page.locator('.wd-library input[type="search"]').fill('reisbureau');
   await page.locator('.wd-library [data-widget="reisbureau"] .wd-widget-open').click();
   app=await (await page.waitForSelector('.wd-app-frame:not([hidden])')).contentFrame();
  }
  await app.locator('.reis[data-id="ibiza-jetset"]').click();
  const date=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  await app.locator('#rDatum').fill(date);await app.locator('#rPlus').click();
  await app.locator('#travelRemember').check();await app.locator('#rNotitie').fill('Wens blijft alleen in dit formulier');
  await app.locator('#bladTerug').click();await app.locator('.reis[data-id="ibiza-jetset"]').click();
  assert.equal(await app.locator('#rDatum').inputValue(),date);assert.equal(await app.locator('#rAantal').textContent(),'3');
  await app.goto(srv.base+'/apps/reisbureau.html');await app.locator('.reis[data-id="ibiza-jetset"]').click();
  assert.equal(await app.locator('#rDatum').inputValue(),date);assert.equal(await app.locator('#rAantal').textContent(),'3');
  assert.equal(await app.locator('#rNotitie').inputValue(),'','vrije tekst wordt niet opgeslagen');
  let sends=0;
  const out=path.join(__dirname,'../artifacts/experience');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'travel-form-'+width+'.png')});
  await page.route('**/api/reisbureau/boek',async route=>{sends++;await route.fetch();await route.abort('failed');});
  await app.locator('#rReview').click();assert.equal(sends,0,'controleren verstuurt niets');
  assert.match(await app.locator('#rSummary').textContent(),/3 reizigers/);
  await app.locator('#rBoek').click();await app.waitForSelector('#rCheck:not([hidden])');
  assert.match(await app.locator('#rStatus').textContent(),/onbekend/);assert.equal(sends,1);
  assert.equal(await app.locator('#rBoek').isDisabled(),true);assert.equal(await app.locator('#rDatum').inputValue(),date);
  // Een mislukte broncontrole blijft onzeker en veroorzaakt geen tweede mutatie.
  await page.route('**/api/reisbureau/mijn',route=>route.abort('failed'));
  await app.locator('#rCheck').click();await app.waitForFunction(()=>document.querySelector('#rStatus').textContent.includes('Controleren lukt nu niet'));
  assert.equal(sends,1);await page.unroute('**/api/reisbureau/mijn');
  await app.locator('#rCheck').click();await app.waitForSelector('#rTrips:not([hidden])');
  assert.match(await app.locator('#rStatus').textContent(),/nog niet bevestigd/);
  const rows=(await api('/api/reisbureau/mijn',{},token)).aanvragen;assert.equal(rows.length,1);const ref=rows[0].ref;
  assert.equal(rows[0].personen,3);assert.equal(rows[0].vertrek,date);
  await app.waitForSelector('.aanvraag[data-ref="'+ref+'"]',{state:'attached'});
  assert.equal(await app.evaluate(()=>JSON.parse(sessionStorage.getItem('rtg.intent.v1')).rows.filter(r=>r.purpose==='travel'&&r.status==='ACTIVE').length),0);
  await api('/api/office/reisbureau/besluit',{ref,besluit:'bevestigd',bericht:'Uw vertrek is bevestigd.'},office);
  await app.locator('#rTrips').click();
  await app.waitForURL('**/apps/reizen.html#reizen',{waitUntil:'domcontentloaded'});
  await app.waitForSelector('body[data-rtg-world-start="ready"]');
  try { await app.waitForFunction(ref=>{const el=document.querySelector('#komend');return el&&el.innerText.includes(ref)&&el.innerText.toLowerCase().includes('bevestigd');},ref); }
  catch(e) { await page.screenshot({path:path.join(out,'travel-overview-error-'+width+'.png')}); console.log('Reisoverzicht',ref,await app.locator('#komend').innerText(),await app.locator('#komend').textContent()); throw e; }
  assert.match(await app.locator('#komend').innerText(),/Ibiza/);
  assert.equal(await app.locator('body').getAttribute('data-rtg-world'),'travel');
  const visibleTrip=app.locator('#komend .reis[data-sleep-id="'+ref+'"]');
  await visibleTrip.scrollIntoViewIfNeeded();assert.match(await visibleTrip.innerText(),/bevestigd/i);
  await page.screenshot({path:path.join(out,'travel-'+width+'.png')});
  assert.ok(!(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),'geen horizontale overflow');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,'travel-'+width+'.png')});
 }finally{await browser.close();}
});
