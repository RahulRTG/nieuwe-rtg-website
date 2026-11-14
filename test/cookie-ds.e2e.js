/* Echte Browser-consument; Wonen is expliciet een bestaande-owner hostfixture.
   Geen algemene cookie-entry of server/privacykwalificatie wordt hiermee geclaimd. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const pw=laadPlaywright(),skip=geenBrowser(pw);let srv,browser,token;
test.before(async()=>{if(skip)return;srv=await startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});
 const r=await fetch(srv.base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Cookie presentatie',email:'cookie-ds@example.test',phone:'0612345827',password:'geheim12345',geboortedatum:'1990-01-01',tier:'rtg'})});assert.equal(r.status,200);token=(await r.json()).token;assert.ok(token);browser=await pw.chromium.launch(browserOpties(pw));});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
for(const route of ['browser','wonen'])test('cookie DS '+route+(route==='wonen'?' expliciete hostfixture':''),{skip,timeout:45000},async()=>{
 const ctx=await browser.newContext({serviceWorkers:'block',locale:'nl-NL',viewport:{width:390,height:900},reducedMotion:'reduce'});
 await ctx.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_lang','nl');},token);
 const page=await ctx.newPage(),errors=[];letOpFouten(page,errors,{eigenZeef:true});
 try{
  await page.goto(srv.base+'/apps/'+route+'.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.rtgDesktopState==='ready');
  if(route==='wonen')await page.addScriptTag({url:srv.base+'/shared/cookie.js'});
  const melding=page.locator('.ds-cookie');await melding.waitFor({state:'visible'});
  assert.equal(await melding.count(),1);assert.equal(await melding.getAttribute('role'),'region');
  assert.equal(await melding.getByRole('link',{name:'Privacy',exact:true}).getAttribute('href'),'/apps/juridisch/privacy.html');
  for(const width of [390,820,1440])for(const zoom of [100,200]){
   await page.setViewportSize({width,height:1000});await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',zoom);
   const m=await melding.evaluate(el=>{const box=el.getBoundingClientRect(),vlak=el.closest('.wd-page')||document.body,main=vlak.querySelector('main');return {box:box.toJSON(),main:main&&main.getBoundingClientRect().toJSON(),nativeDs:vlak===document.body&&document.documentElement.hasAttribute('data-ds'),parent:el.parentElement.className,client:el.clientWidth,scroll:el.scrollWidth,doelen:[...el.querySelectorAll('a,button')].map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height,raak:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}),legacy:[...document.querySelectorAll('style')].some(n=>n.textContent.includes('#rtg-cookie{')),ruimte:document.documentElement.style.getPropertyValue('--rtg-cookieruimte')};});
   assert.ok(m.box.top>=0&&m.box.bottom<=1000&&m.box.left>=0&&m.box.right<=width+1,JSON.stringify({width,zoom,m}));
   assert.ok(m.scroll<=m.client+1);assert.ok(m.parent.includes('wd-page')||m.nativeDs);
   assert.ok(m.main&&m.main.top>=m.box.bottom-1,'melding blijft vóór echte inhoud: '+JSON.stringify(m));
   assert.ok(m.doelen.every(d=>d.w>=44&&d.h>=44&&d.raak),JSON.stringify(m.doelen));assert.equal(m.legacy,false);assert.equal(m.ruimte,'');
  }
  const knop=melding.getByRole('button',{name:'Prima',exact:true});await knop.focus();assert.equal(await knop.evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Enter');await melding.waitFor({state:'detached'});
  assert.ok(await page.evaluate(()=>!Number.isNaN(Date.parse(localStorage.getItem('rtg_cookieinfo_v1')))));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.rtgDesktopState==='ready');if(route==='wonen')await page.addScriptTag({url:srv.base+'/shared/cookie.js'});assert.equal(await page.locator('.ds-cookie').count(),0);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});

test('cookie centrale owner op oudere 404-host',{skip,timeout:45000},async()=>{
 const ctx=await browser.newContext({serviceWorkers:'block',locale:'nl-NL',viewport:{width:390,height:900},reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];letOpFouten(page,errors,{eigenZeef:true});
 try{
  await page.goto(srv.base+'/site/404.html',{waitUntil:'domcontentloaded'});
  const melding=page.locator('.ds-cookie--overlay');await melding.waitFor({state:'visible'});
  assert.equal(await page.locator('html[data-ds]').count(),0);
  assert.equal(await page.locator('style').evaluateAll(xs=>xs.some(n=>n.textContent.includes('#rtg-cookie{'))),false);
  const centraal=await page.evaluate(()=>{function zoek(regels){for(const r of regels||[]){if(r.selectorText&&r.selectorText.includes('.ds-cookie--overlay'))return true;if(r.cssRules&&zoek(r.cssRules))return true;}return false;}return[...document.styleSheets].some(s=>{try{return zoek(s.cssRules);}catch(e){return false;}});});
  assert.equal(centraal,true);
  const tekstBasis=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
  for(const width of [320,390,820])for(const zoom of [100,200]){
   await page.setViewportSize({width,height:900});await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',zoom);
   /* De legacy-host animeert ook tekstmaat kort bij reduced motion. Een oude,
      grotere layout is geen bewijs voor de gevraagde zoomstand. Wacht op de
      echte tekstmaat, afgeronde overgangen én de reservering. */
   await page.waitForFunction(({w,font})=>{const el=document.querySelector('.ds-cookie--overlay');if(!el)return false;const r=el.getBoundingClientRect(),ruimte=parseFloat(document.documentElement.style.getPropertyValue('--rtg-cookieruimte')),beweging=[...document.documentElement.getAnimations(),...el.getAnimations({subtree:true})].some(a=>a.playState==='running'||a.pending);return !beweging&&parseFloat(getComputedStyle(document.documentElement).fontSize)===font&&r.left>=0&&r.right<=w+1&&r.top>=0&&r.bottom<=900&&el.scrollWidth<=el.clientWidth+1&&ruimte>=r.height;},{w:width,font:tekstBasis*zoom/100});
   const m=await melding.evaluate(el=>{const r=el.getBoundingClientRect();return{r:r.toJSON(),client:el.clientWidth,scroll:el.scrollWidth,host:document.body.classList.contains('ds-cookie-host'),ruimte:document.documentElement.style.getPropertyValue('--rtg-cookieruimte'),doelen:[...el.querySelectorAll('a,button')].map(n=>{const b=n.getBoundingClientRect();return{w:b.width,h:b.height,raak:n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};})};});
   assert.ok(m.r.left>=0&&m.r.right<=width+1&&m.r.top>=0&&m.r.bottom<=900,JSON.stringify({width,zoom,m}));
   assert.ok(m.scroll<=m.client+1);assert.equal(m.host,true);assert.ok(parseFloat(m.ruimte)>=m.r.height,JSON.stringify({width,zoom,m}));
   assert.ok(m.doelen.every(d=>d.w>=44&&d.h>=44&&d.raak),JSON.stringify(m.doelen));
  }
  /* Een host kan de tekstmaat tussen twee frames wijzigen. De observer moet
     de nieuwe maat al verwerken in dezelfde microtaskronde, niet pas in een
     latere frame: anders kan grotere tekst tijdelijk over de inhoud vallen. */
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:820,height:900});
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');
  await page.waitForFunction(font=>{const el=document.querySelector('.ds-cookie--overlay');return parseFloat(getComputedStyle(document.documentElement).fontSize)===font&&parseFloat(document.documentElement.style.getPropertyValue('--rtg-cookieruimte'))===Math.ceil(el.getBoundingClientRect().height)+12;},tekstBasis);
  const vergroot=await melding.evaluate(async el=>{
   const voor={hoogte:el.getBoundingClientRect().height,ruimte:parseFloat(document.documentElement.style.getPropertyValue('--rtg-cookieruimte')),font:getComputedStyle(document.documentElement).fontSize};
   document.documentElement.style.fontSize='200%';
   await Promise.resolve();
   return{voor,hoogte:el.getBoundingClientRect().height,ruimte:parseFloat(document.documentElement.style.getPropertyValue('--rtg-cookieruimte')),font:getComputedStyle(document.documentElement).fontSize};
  });
  assert.equal(parseFloat(vergroot.voor.font),tekstBasis);assert.equal(parseFloat(vergroot.font),tekstBasis*2);
  assert.ok(vergroot.ruimte>=vergroot.hoogte,'tekstvergroting reserveert meteen voldoende ruimte: '+JSON.stringify(vergroot));
  const knop=melding.getByRole('button',{name:'Prima',exact:true});await knop.focus();await page.keyboard.press('Enter');await melding.waitFor({state:'detached'});
  assert.equal(await page.locator('body.ds-cookie-host').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--rtg-cookieruimte')),'');assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
