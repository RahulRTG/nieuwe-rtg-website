'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser} = require('./helper');
const pw=laadPlaywright(), skip=geenBrowser(pw);
let srv,browser,A,B,id,adres;
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../../output/mobile-single-shell/communications');fs.mkdirSync(out,{recursive:true});
async function shot(page,name){
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(out,name+'.png')});
  if(name==='mail-mobile'){
    const layers=await page.evaluate(()=>[[300,765],[20,835],[300,808]].map(([x,y])=>({x,y,nodes:document.elementsFromPoint(x,y).slice(0,8).map(e=>({tag:e.tagName,id:e.id,classes:e.className,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}))})));
    fs.writeFileSync(path.join(out,'mail-layers.json'),JSON.stringify(layers,null,2));
  }
}
async function api(path,body,token){const r=await fetch(srv.base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,data.error);return data;}
test.before(async()=>{
  if(skip)return;
  srv=await startServer({env:{RTG_DEMO:'1',SMTP_URL:'',RTG_AI_UIT:'1'}});
  A=(await api('/api/login',{tier:'rtg',pasApp:'rtg'})).token;
  B=(await api('/api/login',{tier:'business',pasApp:'business'})).token;
  await api('/api/member/connect',{key:'business'},A);
  await api('/api/member/connect/respond',{key:'rtg',action:'accept'},B);
  id=(await api('/api/comm/begin',{met:'business'},A)).gesprek.id;
  await api('/api/comm/stuur',{id,tekst:'Welkom bij dit testgesprek.'},B);
  adres=(await api('/api/member/rtmail/adres',{},B)).adres;
  browser=await pw.chromium.launch(browserOpties(pw));
});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
async function open(route){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.addInitScript(token=>{localStorage.setItem('rtg_member_token',token);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');},A);
  const page=await ctx.newPage();await page.goto(srv.base+route);
  await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');return {page,ctx};
}
test('chat uses the actual composer in the one Edge; resize, reply and real delivery preserve the conversation',{skip},async()=>{
  const {page,ctx}=await open('/apps/comm.html');
  try{
    await page.locator('.gsp').first().click();
    await page.waitForSelector('.rtg-adaptive-surface #veld');
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),false);
    assert.equal(await page.locator('#veld').count(),1);
    await page.locator('#veld').fill('Dezelfde invoer blijft behouden.');
    await page.setViewportSize({width:1440,height:1000});await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#veld').inputValue(),'Dezelfde invoer blijft behouden.');
    await page.locator('.rtg-adaptive-surface [aria-label="Bediening openen"]').click();
    assert.equal(await page.locator('.rtg-adaptive-surface').isVisible(),false);
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#veld').inputValue(),'Dezelfde invoer blijft behouden.');
    await shot(page,'chat-mobile');
    await page.locator('#stuur').click();
    await page.waitForFunction(()=>document.querySelector('#veld').value==='');
    const conversation=await api('/api/comm/gesprek',{id},B);
    assert.equal(conversation.gesprek.berichten.filter(m=>m.tekst==='Dezelfde invoer blijft behouden.').length,1);
    await page.locator('#terug').click();
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),true);
  }finally{await ctx.close();}
});
test('the menu becomes the same Edge surface; apps scroll with dots and no swipe instruction',{skip},async()=>{
  const {page,ctx}=await open('/apps/notities.html');
  try{
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
    await page.waitForSelector('.rtg-adaptive-sheet .rtg-edge-index');
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),false);
    await page.getByRole('tab',{name:'Heel RTG'}).click();
    await page.locator('[data-edge-smart-search]').click();
    const rail=page.locator('.rtg-edge-group:visible').first();
    await rail.waitFor();
    assert.equal(await rail.evaluate(el=>getComputedStyle(el).overflowX),'auto');
    await shot(page,'apps-mobile');
    await page.waitForSelector('.rtg-edge-page-dots:not([hidden]) button',{timeout:5000}).catch(async e=>{console.log(await page.locator('.rtg-edge-group').evaluateAll(ns=>ns.map(n=>({w:n.clientWidth,s:n.scrollWidth,children:n.children.length,display:getComputedStyle(n).display,hidden:n.nextElementSibling?.outerHTML}))));throw e;});
    assert.ok(await page.locator('.rtg-edge-page-dots:visible button').count()>1);
    assert.doesNotMatch(await page.locator('.rtg-adaptive-sheet').innerText(),/veeg voor meer/i);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),true);
  }finally{await ctx.close();}
});

async function mailAction(page,name){await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();await page.locator('.rtg-adaptive-controls').getByRole('button',{name,exact:true}).click();}
test('mail draft survives reload and sends only after confirmation through the original backend',{skip},async()=>{
  const {page,ctx}=await open('/apps/rtmail.html');
  try{
    await mailAction(page,'Nieuw bericht');
    await page.locator('.rtm-paper input[name="naar"]').fill(adres);
    await page.locator('.rtm-paper input[name="onderwerp"]').fill('Een persoonlijk bericht');
    await page.locator('.rtm-paper textarea').fill('Goedemiddag,\n\nZullen we binnenkort samen aan tafel gaan?');
    await page.locator('.rtg-adaptive-surface [data-mail-save]').click();
    await page.getByRole('status').filter({hasText:'Uw concept is bewaard.'}).waitFor();
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),false);
    assert.equal(await page.locator('header.ios-nav:has(.rtm-diep-terug)').count(),1);
    assert.equal(await page.locator('header.ios-nav:has(.rtm-diep-terug)').isVisible(),false,
      'the original mail header does not form a second control strip behind the composer Edge');
    await shot(page,'mail-mobile');
    await page.reload();await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
    await mailAction(page,'Concepten');
    await page.locator('.rtm-draft-list button').filter({hasText:'Een persoonlijk bericht'}).click();
    assert.match(await page.locator('.rtm-paper textarea').inputValue(),/samen aan tafel/);
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-mail-send]').click();
    assert.equal((await api('/api/member/rtmail/vak',{},B)).berichten.some(m=>m.onderwerp==='Een persoonlijk bericht'),false);
    page.once('dialog',dialog=>dialog.accept());await page.locator('[data-mail-send]').click();
    await page.locator('.rtm-send-result').waitFor();
    assert.equal((await api('/api/member/rtmail/vak',{},B)).berichten.filter(m=>m.onderwerp==='Een persoonlijk bericht').length,1);
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),true);
  }finally{await ctx.close();}
});
