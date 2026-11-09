/* Echte Wonen-host en overdrachtowner, met read-only responsefixtures.
   Clientpresentatie/sessiebinding; geen bewijs van serverautorisatie. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const pw=laadPlaywright();let srv,browser,token;
const brief={verkoper:{naam:'Eigen zaak'},regels:[{titel:'Een lange beschrijving van het meegenomen artikel '.repeat(8),aantal:2,totaalCenten:1234},{titel:'Gratis aanvulling',aantal:1,gratis:true}],brutoCenten:1234,btw:{btwCenten:214,tariefProcent:21},at:0,bedragVan:'Bedrag uit de oorspronkelijke mand.',rtgBevestigtNiet:'RTG bevestigt deze bestelling niet.'};
test.before(async()=>{if(geenBrowser(pw))return;srv=await startServer({env:{SMTP_URL:'',RTG_EXTERNE_AI_UIT:'1',LOCAL_AI_URL:'',OPENAI_API_KEY:'',ANTHROPIC_API_KEY:''}});
 const r=await fetch(srv.base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Overdracht UI',email:'overdracht-ds@example.test',phone:'0612345898',password:'geheim12345',geboortedatum:'1990-01-01',tier:'rtg'})});assert.equal(r.status,200);token=(await r.json()).token;assert.ok(token);browser=await pw.chromium.launch(browserOpties(pw));});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
async function open(antwoord){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');
  // Observeer verwerking door de werkelijke owner zonder productiecode te wijzigen.
  const fetchEcht=window.fetch.bind(window);window.fetch=function(...args){const p=fetchEcht(...args);if(String(args[0]).includes('/api/commerce/overdracht/lees')){
    window.__overdrachtVerwerkt=p.then(async r=>{if(r.ok)await r.clone().json();}).catch(()=>{});
  }return p;};
 },token);
 const page=await context.newPage(),fouten=letOpFouten(page,[]),calls=[];
 await page.route('**/api/commerce/overdracht/lees',async route=>{const q=route.request();calls.push({method:q.method(),auth:q.headers().authorization,body:q.postDataJSON()});await antwoord(route);});
 await page.goto(srv.base+'/apps/wonen.html?overdracht=briefje-eigen',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__rtgOverdracht&&document.body.dataset.rtgDesktopState==='ready');
 return {page,context,fouten,calls};
}
function requestGoed(calls){assert.deepEqual(calls,[{method:'POST',auth:'Bearer '+token,body:{id:'briefje-eigen'}}]);}
test('overdracht DS: echte host, responsief, tekstvergroting en bestaande bediening',{skip:geenBrowser(pw),timeout:45000},async()=>{
 const x=await open(r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,overdracht:brief})}));
 try{const balk=x.page.getByRole('complementary',{name:'Uit je mand meegenomen'});await balk.waitFor();
  for(const width of [390,820,1440])for(const zoom of [100,200]){
   await x.page.setViewportSize({width,height:1000});await x.page.evaluate(n=>{document.documentElement.style.fontSize=n+'%';},zoom);
   const m=await balk.evaluate(el=>({box:el.getBoundingClientRect().toJSON(),client:el.clientWidth,scroll:el.scrollWidth,doelen:[...el.querySelectorAll('button,a')].map(n=>n.getBoundingClientRect().toJSON())}));
   assert.ok(m.box.left>=0&&m.box.right<=width+1&&m.scroll<=m.client+1,JSON.stringify({width,zoom,m}));
   assert.ok(m.doelen.every(n=>n.width>=44&&n.height>=44),JSON.stringify(m.doelen));
  }
  assert.equal(await x.page.locator('#rtg-ovd-stijl').count(),0);assert.equal(await balk.evaluate(el=>el.classList.contains('ds-overdracht')),true);
  assert.match(await balk.textContent(),/€ 12,34/);assert.match(await balk.textContent(),/€ 2,14/);assert.match(await balk.textContent(),/zonder bedrag/);assert.match(await balk.textContent(),/RTG bevestigt deze bestelling niet/);
  assert.equal(await balk.getByRole('link',{name:'Terug naar je mand'}).getAttribute('href'),'/apps/commerce.html');requestGoed(x.calls);
  await balk.getByRole('button',{name:'Sluiten',exact:true}).click();await balk.waitFor({state:'detached'});assert.deepEqual(x.fouten,[]);
 }finally{await x.context.close();}
});
for(const geval of ['HTTP503','andere actor'])test('overdracht: '+geval+' publiceert geen balk',{skip:geenBrowser(pw),timeout:30000},async()=>{
 let pending,ontvangen;const binnen=new Promise(r=>ontvangen=r);
 const x=await open(r=>{pending=r;ontvangen();});
 try{await binnen;if(geval==='andere actor')await x.page.evaluate(()=>localStorage.setItem('rtg_member_token','andere-actor'));
  await pending.fulfill({status:geval==='HTTP503'?503:200,contentType:'application/json',body:JSON.stringify({ok:true,overdracht:brief})});
  await x.page.evaluate(()=>window.__overdrachtVerwerkt);await x.page.waitForLoadState('networkidle');
  assert.equal(await x.page.locator('.ovd').count(),0);assert.equal(await x.page.locator('#rtg-ovd-stijl').count(),0);requestGoed(x.calls);assert.deepEqual(x.fouten,[]);
 }finally{await x.context.close();}
});
