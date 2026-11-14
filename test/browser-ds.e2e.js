/* Browserchrome op echte lokale routes, gepubliceerde zaaksite en ledenlogin.
   De blokinhoud en formulierstand krijgen hun gerichte proef in webblok-ds. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten,wachtOpSchil}=require('./helper');
const pw=laadPlaywright(),skip=geenBrowser(pw);
let srv,browser,token,adres;
async function post(route,body,auth){const r=await fetch(srv.base+route,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body||{})});const d=await r.json();assert.equal(r.status,200,route+': '+JSON.stringify(d));return d;}
test.before(async()=>{
  if(skip)return;
  srv=await startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});
  browser=await pw.chromium.launch(browserOpties(pw));
  const roster=await post('/api/supplier/roster',{code:'ESVEDRA'});
  const zaak=(await post('/api/supplier/login',{code:'ESVEDRA',staffId:roster.staff.find(s=>s.role==='manager').id,pin:'1234'})).token;
  adres=(await post('/api/supplier/site/genereer',{},zaak)).adres;
  token=(await post('/api/auth/register',{name:'Browser Proef',email:'browser-ds@test.example',phone:'0612345621',password:'browsergeheim12',geboortedatum:'1990-01-01',tier:'rtg'})).token;
  assert.ok(token&&adres);
});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
for(const breedte of [390,1280])test('browserchrome '+breedte+': adres, geschiedenis, tabs, bookmarks, zoeken en zaakacties',{skip,timeout:60000},async()=>{
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:breedte,height:900},reducedMotion:'reduce'});
  await ctx.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');},token);
  const page=await ctx.newPage(),errors=[];letOpFouten(page,errors,{eigenZeef:true});
  try{
    await page.goto(srv.base+'/apps/browser.html',{waitUntil:'domcontentloaded'});
    await page.locator('#rooster .kaart').first().waitFor();
    await wachtOpSchil(page);
    assert.equal(await page.locator('html').getAttribute('data-ds'),'1');
    assert.ok(await page.evaluate(()=>!!window.RTGiOS),'bestaande iOS API actief');
    const oudMenu=page.locator('#osMenuBtn'),menu=page.locator('.ds-edge__balk [data-ds-edge="menu"]');
    assert.equal(await oudMenu.isVisible(),false,'het legacy-menu blijft gemonteerd voor compatibiliteit maar bezit de presentatie niet');
    assert.equal(await menu.isVisible(),true,'de centrale DS Edge bezit de zichtbare systeemdeur');
    await menu.click();await page.locator('#dsEdgeBlad:not([hidden])').waitFor({state:'visible'});
    await page.keyboard.press('Escape');await page.locator('#dsEdgeBlad').waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.activeElement===document.querySelector('.ds-edge__balk [data-ds-edge="menu"]'));
    await page.locator('#adres').fill(adres+'.rtg');await page.locator('#balk button').click();
    await page.locator('.zaakbalk .zn').waitFor();
    assert.match(await page.locator('.zaakbalk .zn').textContent(),/Es Vedra/);
    assert.ok(await page.locator('.zaakbalk a[href="/apps/app.html"]').count());
    await page.locator('#bwKnop').click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rtg_web_bladwijzers'))[0].adres),adres);
    await page.getByRole('button',{name:'Aanbod',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#adres').value.endsWith('/aanbod'));
    await page.locator('.paginanav button[aria-current="page"]').filter({hasText:'Aanbod'}).waitFor();
    assert.equal(await page.locator('.paginanav').evaluate(e=>getComputedStyle(e).scrollMarginBlockStart),'128px');
    await page.locator('#terugKnop').click();
    await page.locator('.paginanav button[aria-current="page"]').filter({hasText:'Home'}).waitFor();
    await page.locator('#vooruitKnop').click();
    await page.locator('.paginanav button[aria-current="page"]').filter({hasText:'Aanbod'}).waitFor();
    await page.locator('#homeKnop').click();await page.locator('#bwRij .kaart').first().waitFor();
    await page.locator('#bwRij .kaart').first().click();await page.locator('.zaakbalk .zn').waitFor();
    await page.locator('#tabstrip .plus').click();await page.locator('#zoekIn').waitFor();
    assert.equal(await page.locator('#tabstrip .tb').count(),2);
    const eersteTab=page.locator('#tabstrip .tb').first();
    assert.equal(await eersteTab.locator('button').count(),2,'tabkeuze en sluiten zijn nevengeschikte knoppen');
    await eersteTab.locator('.ds-browser-tabselect').focus();await page.keyboard.press('Enter');
    await page.locator('.zaakbalk .zn').waitFor();
    const sluit=page.locator('#tabstrip .tb.aan .x');
    assert.equal(await sluit.getAttribute('aria-label'),'Tab sluiten');
    await sluit.click();await page.locator('#zoekIn').waitFor();
    assert.equal(await page.locator('#tabstrip .tb').count(),1);
    await page.locator('#zoekIn').fill('Vedra');await page.locator('#zoekGroot button').click();
    await page.locator('#zoekUit .kaart').first().waitFor();
    assert.match(await page.locator('#zoekUit').innerText(),/Vedra/);
    const maten=await page.locator('#homeKnop').boundingBox();assert.ok(maten.width>=44&&maten.height>=44);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'geen horizontale overloop');
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});

for(const mislukt of [false,true])test('verlaten startpagina ontvangt geen late gids'+(mislukt?'fout':'inhoud'),{skip,timeout:30000},async()=>{
  const ctx=await browser.newContext({serviceWorkers:'block'});
  await ctx.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');},token);
  const page=await ctx.newPage(),errors=[];letOpFouten(page,errors,{eigenZeef:true});
  let geefVrij,bereikt;const wacht=new Promise(r=>geefVrij=r),gestart=new Promise(r=>bereikt=r);
  try{
    await page.goto(srv.base+'/apps/browser.html',{waitUntil:'domcontentloaded'});
    await page.locator('#rooster .kaart').first().waitFor();
  await page.route('**/api/browser/gids',async route=>{bereikt();await wacht;await route.fulfill({status:mislukt?503:200,contentType:'application/json',body:JSON.stringify(mislukt?{error:'Tijdelijk onbereikbaar'}:{lijst:[{adres:'oud',titel:'Verouderde gids'}]})});});
    await page.evaluate(()=>{window.__startAfgerond=toonStart();});await gestart;
    await page.locator('#adres').fill(adres+'.rtg');await page.locator('#balk button').click();
    await page.locator('.zaakbalk .zn').waitFor();
    geefVrij();await page.evaluate(()=>window.__startAfgerond);
    assert.match(await page.locator('.zaakbalk .zn').textContent(),/Es Vedra/);
    assert.equal(await page.getByText('Verouderde gids',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
  }finally{geefVrij();await ctx.close();}
});
