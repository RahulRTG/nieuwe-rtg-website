'use strict';
// Presentation proof only; no provider, production or purchase qualification.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {laadPlaywright,startBrowser}=require('./helper');
const ROOT=path.resolve(__dirname,'..');
const OUT=process.env.RTG_VOLUME_OUTPUT||path.join(ROOT,'output/brand/travel-volume');
const CASES=[
  {file:'travelos',scenario:'travel',sections:['overzicht','onderweg','mogelijkheden','proberen']},
  {file:'livingos',scenario:'dinner',sections:['overzicht','samen','mogelijkheden','proberen']}
];
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
let browser,server,base;
test.before(async()=>{
  server=http.createServer((req,res)=>{
    let route=new URL(req.url,'http://localhost').pathname;
    if(route==='/')route='/index.html';
    if(/^\/(ds|fonts|images|shared|site)\//.test(route))route='/public'+route;
    const file=path.resolve(ROOT,'.'+route);
    if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
    fs.readFile(file,(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':bytes);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  browser=await startBrowser(laadPlaywright({eigenDriver:false}));fs.mkdirSync(OUT,{recursive:true});
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function visit(c,width,options={}){
  const {hash='',rtl=false,height=900,...contextOptions}=options;
  const context=await browser.newContext({viewport:{width,height},locale:'nl-NL',reducedMotion:'reduce',serviceWorkers:'block',...contextOptions});
  await context.addInitScript(rtl=>{localStorage.setItem('rtg_lang','nl');if(rtl)document.addEventListener('DOMContentLoaded',()=>document.documentElement.dir='rtl');},rtl);
  await context.route('**/*',r=>new URL(r.request().url()).origin===base&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({status:503,body:'Read-only presentation proof'}));
  const page=await context.newPage(),errors=[],missing=[];page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&['image','script','stylesheet','font'].includes(r.request().resourceType()))missing.push(r.url());});
  await page.goto(base+'/public/site/werelden/'+c.file+'.html'+hash,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);return{page,context,errors,missing};
}
async function overflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Only the reel, not the document, scrolls horizontally');}
async function status(page,n){await page.waitForFunction(n=>document.querySelector('[data-reel-status]').textContent.trim()===n+' / 5',n);}
async function first(page){await page.locator('[data-reel-track]').focus();await page.keyboard.press('Home');await status(page,1);await page.evaluate(()=>scrollTo(0,0));}
async function reveal(page,id){
  await page.evaluate(id=>{location.hash='#'+id;},id);
  await page.waitForFunction(id=>{
    const el=document.getElementById(id);if(!el)return false;
    let d=el.closest('details');while(d){if(!d.open)return false;d=d.parentElement.closest('details');}
    return !!el.getClientRects().length;
  },id);
}
async function sources(page){
  for(const img of await page.locator('[data-reel-track] img').all()){
    await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(e=>e.complete&&e.naturalWidth>0,await img.elementHandle());
    await img.evaluate(e=>e.decode());
  }
}
for(const c of CASES)for(const width of [320,390,768,1440])test(c.file+': five sheets and original detail at '+width,async()=>{
  const {page,context,errors,missing}=await visit(c,width);
  try{
    assert.equal(await page.locator('body.ds-public-volume').count(),1);
    assert.equal(await page.locator('main').count(),1);
    assert.equal(await page.locator('main#verhaal[data-editorial-reel],main#verhaal [data-editorial-reel]').count(),1);
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.locator('[data-reel-track] article[data-reel-page]').count(),5);
    assert.equal(await page.locator('[data-reel-page]').first().locator('h1').count(),1);
    assert.equal(await page.locator('[data-reel-track] figcaption,.ds-public-chapters').count(),0);
    for(const id of ['werelddetails','colofon'])assert.equal(await page.locator('#'+id).evaluate(e=>e.tagName==='DETAILS'&&!e.open),true,id+' starts closed');
    const heroTop=await page.locator('.world-hero .ds-public-cover img').evaluate(e=>e.getBoundingClientRect().top);
    assert.ok(heroTop<470,'First image before an essay: '+heroTop);
    await status(page,1);await sources(page);await overflow(page);await first(page);
    for(const action of await page.locator('[data-reel-page] a,[data-reel-controls] button,[data-editorial-reel] a[href="#werelddetails"],[data-editorial-reel] a[href="#colofon"]').all()){
      const r=await action.boundingBox();assert.ok(r&&r.height>=44&&r.width>=44,'44px target '+await action.textContent()+' '+JSON.stringify(r));
    }
    for(const id of c.sections){
      await reveal(page,id);assert.equal(await page.locator('#werelddetails').getAttribute('open')!==null,true);
      assert.equal(await page.locator('#'+id).isVisible(),true,id+' reachable');await overflow(page);
    }
    assert.equal(await page.locator('#werelddetails .proof-detail').count(),7,'Seven original proof contracts');
    assert.equal(await page.locator('#werelddetails .proof-source').count(),7,'Each proof retains its source');
    for(const proof of await page.locator('#werelddetails .proof-source').all())assert.ok((await proof.textContent()).trim().length>10);
    assert.equal(await page.locator('[data-world-truth-slot] [data-app-truth-panel]').count(),1,'Single canonical catalogue');
    await reveal(page,'colofon');assert.match(await page.locator('#colofon').innerText(),/AI/);
    assert.ok(await page.locator('#colofon a[href*="provenance" i]').count()>0,'Attribution remains linked');
    if([390,1440].includes(width)){
      await page.locator('#colofon>summary').click();await page.locator('#werelddetails>summary').click();await first(page);
      await page.screenshot({path:path.join(OUT,c.file+'-'+width+'.png')});
      await page.screenshot({path:path.join(OUT,c.file+'-full-'+width+'.png'),fullPage:true});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  }finally{await context.close();}
});
for(const c of CASES)for(const rtl of [false,true])test(c.file+': '+(rtl?'RTL':'LTR')+' controls, scrolling and focus',async()=>{
  const{page,context}=await visit(c,390,{rtl});
  try{
    const track=page.locator('[data-reel-track]'),prev=page.locator('[data-reel-prev]'),next=page.locator('[data-reel-next]');
    assert.match(await track.evaluate(e=>getComputedStyle(e).scrollSnapType),/mandatory/);
    assert.notEqual(await track.evaluate(e=>getComputedStyle(e).touchAction),'none');
    await next.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);await next.focus();
    for(let n=2;n<=5;n++){await page.keyboard.press('Enter');await status(page,n);}
    assert.equal(await next.getAttribute('aria-disabled'),'true');assert.equal(await next.evaluate(e=>e===document.activeElement),true);
    assert.equal(await next.getAttribute('disabled'),null);await page.keyboard.press('Enter');await status(page,5);
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y)<=2,'Reel navigation leaves document scroll unchanged');
    await prev.focus();for(let n=4;n>=1;n--){await page.keyboard.press('Enter');await status(page,n);}
    assert.equal(await prev.getAttribute('aria-disabled'),'true');
    await track.focus();await page.keyboard.press(rtl?'ArrowLeft':'ArrowRight');await status(page,2);
    await page.keyboard.press('End');await status(page,5);await page.keyboard.press('Home');await status(page,1);
    // Native browser scrolling, independent of the arrow controller.
    await page.locator('[data-reel-page]').nth(2).evaluate(e=>e.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));await status(page,3);
    const link=page.locator('[data-reel-page]').nth(3).locator('a').first();await link.focus();
    await page.waitForFunction(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;},await link.elementHandle());
    assert.equal(await link.evaluate(e=>e===document.activeElement),true,'Focused link is revealed in its sheet');
    assert.equal(await prev.evaluate(e=>getComputedStyle(e).transitionDuration.split(',').every(v=>parseFloat(v)===0)),true,'Reduced motion');
    await overflow(page);
  }finally{await context.close();}
});
for(const c of CASES)test(c.file+': links, deep links, demo continuity and menu',async()=>{
  const{page,context,errors}=await visit(c,390,{hash:'#mogelijkheden'});
  try{
    assert.equal(await page.locator('#werelddetails').getAttribute('open')!==null,true);
    assert.equal(await page.locator('#mogelijkheden').isVisible(),true,'Direct hash opens ancestors');
    const back=page.locator('#werelddetails a[href="#verhaal"]').first();await back.click();
    await page.waitForURL(u=>u.hash==='#verhaal');
    await page.waitForFunction(()=>document.activeElement===document.querySelector('#verhaal'));
    assert.equal(await page.locator('#verhaal').evaluate(e=>e===document.activeElement),true,'Back link restores magazine focus');
    await page.locator('[data-editorial-reel] a[href="#werelddetails"]').first().click();
    await page.waitForURL(u=>u.hash==='#werelddetails');
    // URL observation can precede the hashchange handler and native fragment
    // focus. Wait for the actual accessibility outcome, not only navigation.
    await page.waitForFunction(()=>document.activeElement===document.querySelector('#werelddetails>summary'));
    assert.equal(await page.locator('#werelddetails>summary').evaluate(e=>e===document.activeElement),true);
    await reveal(page,'proberen');
    const select=page.locator('[data-story-demo="'+c.scenario+'"] select');assert.equal(await select.isVisible(),true);
    const values=await select.locator('option').evaluateAll(rows=>rows.map(r=>r.value));assert.ok(values.length>1);await select.selectOption(values[1]);
    const current=await page.locator('[data-reel-status]').innerText();await select.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-reel-status]').innerText(),current,'Form keys do not operate the reel');
    const selected=await select.inputValue();await back.click();
    if(await page.locator('#werelddetails').evaluate(e=>e.open))await page.locator('#werelddetails>summary').click();
    await reveal(page,'proberen');
    assert.equal(await select.inputValue(),selected,'Closing the library preserves the demonstration state');
    await page.locator('[data-public-menu]').click();await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-public-menu]').getAttribute('aria-expanded'),'false');
    await overflow(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
for(const c of CASES)test(c.file+': no JavaScript keeps native scrolling, details and colophon',async()=>{
  const{page,context,missing}=await visit(c,390,{javaScriptEnabled:false});
  try{
    assert.equal(await page.locator('[data-reel-controls]').isVisible(),false);
    assert.equal(await page.locator('[data-reel-page]').count(),5);
    const track=page.locator('[data-reel-track]'),before=await track.evaluate(e=>e.scrollLeft);
    await page.locator('[data-reel-page]').last().evaluate(e=>e.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));
    assert.notEqual(await track.evaluate(e=>e.scrollLeft),before,'Native scrolling needs no JavaScript');
    await page.locator('#werelddetails>summary').click();
    for(const id of c.sections){
      const target=page.locator('#'+id);
      if(await target.evaluate(e=>e.tagName==='DETAILS'&&!e.open))await target.locator(':scope>summary').click();
      assert.equal(await target.isVisible(),true,id+' is reachable without the controller');
    }
    assert.equal(await page.locator('[data-story-fallback]').isVisible(),true);
    await page.locator('#colofon>summary').click();assert.match(await page.locator('#colofon').innerText(),/AI/);
    assert.ok(await page.locator('#colofon a[href*="provenance" i]').count()>0);
    assert.equal(await page.locator('.ds-brand-lockup img').count(),1);await overflow(page);assert.deepEqual(missing,[]);
  }finally{await context.close();}
});
for(const c of CASES)for(const mode of ['large-text','landscape'])test(c.file+': '+mode+' retains actions and vertical escape',async()=>{
  const height=mode==='landscape'?390:700;
  const{page,context,errors}=await visit(c,mode==='landscape'?844:390,{height});
  try{
    const viewport=await page.locator('meta[name="viewport"]').getAttribute('content');
    assert.doesNotMatch(viewport,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[,.\s]|$)/i,'Pinch zoom is not disabled');
    if(mode==='large-text'){
      // Text enlargement simulation; not a claim of physical pinch-zoom coverage.
      await page.evaluate(()=>{
        const sizes=Array.from(document.querySelectorAll('[data-reel-page] :is(h1,h2,p,a,button,span)')).map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);
        sizes.forEach(([e,size])=>e.style.fontSize=(size*2)+'px');
      });
    }
    for(const sheet of await page.locator('[data-reel-page]').all()){
      await sheet.scrollIntoViewIfNeeded();
      const g=await sheet.evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight,overflow:getComputedStyle(e).overflowY}));
      if(g.scroll>g.client+1)assert.match(g.overflow,/auto|scroll/,'Oversized sheets retain vertical scrolling');
      for(const action of await sheet.locator('a,button').all()){
        await action.scrollIntoViewIfNeeded();await action.focus();
        const r=await action.boundingBox();assert.ok(r&&r.y>=-1&&r.y+r.height<=height+1,'Action reachable in viewport '+JSON.stringify(r));
      }
    }
    await overflow(page);await page.locator('.world-footer').scrollIntoViewIfNeeded();
    assert.ok((await page.locator('.world-footer').boundingBox()).y<height,'Document can escape to the footer');assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
