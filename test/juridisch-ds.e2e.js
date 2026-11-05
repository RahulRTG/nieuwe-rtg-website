'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const {decodeer,PAD}=require('../server/middleware/stijlbundel-rij');
const {BRON}=require('../scripts/a11ykeuring');
const pw=laadPlaywright(),skip=geenBrowser(pw);
const docs=[['/apps/juridisch/voorwaarden.html','Algemene voorwaarden'],['/apps/juridisch/privacy.html','Privacybeleid'],['/apps/juridisch/partnervoorwaarden.html','Partnervoorwaarden']];
let srv,browser;
test.before(async()=>{if(skip)return;srv=await startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});browser=await pw.chromium.launch(browserOpties(pw));});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
async function context(width,height=900){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce',locale:'nl-NL',deviceScaleFactor:1,isMobile:false,hasTouch:false});
  await ctx.addInitScript(()=>{localStorage.setItem('rtg_cookieinfo_v1','1');localStorage.setItem('rtg_lang','nl');});
  return ctx;
}
async function open(page,route){
  const response=await page.goto(srv.base+route,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.locator('.ds-edge__balk [data-ds-edge="rahul"]').waitFor({state:'visible'});
  await page.evaluate(()=>document.fonts.ready);
  return response;
}
async function geenOverloop(page,label){
  const meting=await page.evaluate(()=>{
    const root=document.documentElement,viewport={width:innerWidth,height:innerHeight};
    const past=root.scrollWidth<=viewport.width+1;
    if(past)return {past};
    const nodes=[...document.querySelectorAll('body,body *')].flatMap(el=>{
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height||!(r.right>innerWidth+1||r.left<-1||el.scrollWidth>el.clientWidth+1))return [];
      const s=getComputedStyle(el);
      return [{tag:el.tagName,id:el.id,class:el.getAttribute('class'),
        bounds:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right},
        clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,font:s.font,fontSize:s.fontSize,
        display:s.display,position:s.position,minInlineSize:s.minInlineSize,maxInlineSize:s.maxInlineSize,
        gridColumns:s.gridTemplateColumns,overflowX:s.overflowX,whiteSpace:s.whiteSpace,
        overflowWrap:s.overflowWrap,wordBreak:s.wordBreak,text:el.children.length?undefined:el.textContent.trim().slice(0,100)}];
    });
    return {past,url:location.href,viewport,documentWidth:root.scrollWidth,rootFont:getComputedStyle(root).fontSize,
      scrollX:window.scrollX,overflowNodes:nodes.length,nodes:nodes.slice(0,40)};
  });
  assert.equal(meting.past,true,label+'\n'+JSON.stringify(meting,null,2));
}
const experienceContract=require('../experience-architecture/coverage-contract.json');
const deviceConfigurations=experienceContract.configurationCoverage['continuity:destination'].deviceConfigurations;
for(const device of experienceContract.devices){
  const {viewport}=deviceConfigurations[device];
  test(`Juridisch destination normal: ${device}`,{skip},t=>
    require('./juridisch-destination-helper')(t,{context,open,browser,base:srv.base,device,viewport}));
}
for(const width of [390,820,1440])test('juridische documentfamilie: centrale DS, leesbaar en bruikbaar op '+width+' px',{skip},async()=>{
  const ctx=await context(width),page=await ctx.newPage(),errors=letOpFouten(page,[]);
  try{
    for(const [route,title] of [['/apps/juridisch.html','Juridisch'],...docs]){
      await open(page,route);
      assert.equal(await page.locator('h1').count(),1,'geen tweede geïnjecteerde documenttitel');
      assert.equal(await page.locator('main h1').innerText(),title);
      assert.equal(await page.locator('.ds-edge__balk').count(),1,'één centrale bediening');
      const sheets=await page.evaluate(()=>[...document.styleSheets].map(s=>s.href).filter(Boolean));
      const active=[];
      for(const href of sheets){const u=new URL(href);const paths=u.pathname===PAD?decodeer(u.searchParams.get('f')):[u.pathname];
        for(const file of paths){active.push(file);assert.ok(file.startsWith('/ds/')||file.startsWith('/fonts/'),route+' laadt erfenis: '+file);}}
      assert.ok(active.includes('/ds/rtg-ds.css'),'centrale DS moet daadwerkelijk geladen zijn');
      await geenOverloop(page,route+' geen horizontale overloop');
      const audit=await page.evaluate('(function(){'+BRON+'\nreturn window.__a11yKeur()})()');
      assert.deepEqual(audit.overtredingen,[],route+' structurele toegankelijkheid');
      assert.deepEqual(audit.contrast,[],route+' oplosbaar tekstcontrast');
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      await geenOverloop(page,route+' tekstvergroting behoudt de breedte');
    }
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('juridische documenten openen met toetsenbord, herladen en terugkeren zonder inhoudsverlies',{skip},async()=>{
  const ctx=await context(390),page=await ctx.newPage(),errors=letOpFouten(page,[]);
  try{
    await open(page,'/apps/juridisch.html');
    for(const [route,title] of docs){
      const name=route.split('/').pop().replace('.html','');
      const link=page.locator('.docs a[href="'+route+'"]');
      for(let i=0;i<20&&!await link.evaluate(e=>e===document.activeElement);i++)await page.keyboard.press('Tab');
      assert.equal(await link.evaluate(e=>e===document.activeElement),true,'document is via natuurlijke Tabvolgorde bereikbaar');
      await page.keyboard.press('Enter');await page.waitForURL('**/apps/juridisch/'+name+'.html');
      await page.locator('main h1').waitFor({state:'visible'});
      assert.equal(await page.locator('main h1').innerText(),title);
      // De prijsbronnen blijven het bestaande gedrag leveren; wacht tot de
      // gedrukte documentgegevens overeenkomen met de actuele API-projectie.
      if(name==='voorwaarden'){
        const prices=await (await page.request.get(srv.base+'/api/pasprijzen')).json();
        const cents=prices.passen.rtg.maandCenten;
        const value='€ '+(cents/100).toLocaleString('nl-NL',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2});
        await page.waitForFunction(v=>document.querySelector('[data-pasprijs="rtg"]').textContent===v,value);
      }
      if(name==='partnervoorwaarden'){
        const tariff=(await (await page.request.get(srv.base+'/api/betaaldiensttarief')).json()).betaaldienst;
        const prices=(await (await page.request.get(srv.base+'/api/pasprijzen')).json()).passen;
        const euro=c=>'€ '+(c/100).toLocaleString('nl-NL',{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2});
        const fixed='€ '+(tariff.vastCenten/100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
        await page.waitForFunction(v=>[...document.querySelectorAll('[data-tarief="vast"]')].every(e=>e.textContent===v.fixed)&&
          [...document.querySelectorAll('[data-tarief="pct"]')].every(e=>e.textContent===v.pct)&&
          [...document.querySelectorAll('[data-pasprijs="business-lite"]')].every(e=>e.textContent===v.business),
          {fixed,pct:String(tariff.pct),business:euro(prices['business-lite'].maandCenten)});
        for(const selector of ['[data-tarief="vast"]','[data-tarief="pct"]','[data-pasprijs="business-lite"]'])assert.ok(await page.locator(selector).count()>0,selector+' moet aanwezig blijven');
      }
      const text=await page.locator('main > .wrap').innerText();assert.ok(text.length>1200);
      await page.reload();await page.locator('main h1').waitFor({state:'visible'});
      await page.waitForFunction(expected=>document.querySelector('main > .wrap').innerText===expected,text);
      await page.locator('.ds-kop__merk').click();await page.waitForURL('**/apps/juridisch.html');
      assert.equal(await page.locator('.docs a').count(),3);
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    await geenOverloop(page,'tekstvergroting behoudt de breedte');
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('eerste bezoek behoudt de cookiemelding en de route naar privacy',{skip},async()=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce',locale:'nl-NL'});
  const page=await ctx.newPage(),errors=letOpFouten(page,[]);
  try{
    await open(page,'/apps/juridisch.html');
    await page.locator('#rtg-cookie').waitFor({state:'visible'});
    await page.locator('#rtg-cookie a').click();await page.waitForURL('**/apps/juridisch/privacy.html');
    await page.locator('#rtg-cookie button').click();
    await page.locator('#rtg-cookie').waitFor({state:'detached'});
    assert.ok(await page.evaluate(()=>localStorage.getItem('rtg_cookieinfo_v1')));
    await page.reload();assert.equal(await page.locator('#rtg-cookie').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
