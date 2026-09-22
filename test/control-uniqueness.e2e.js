/* Equivalent controls converge by action identity, never by translated text. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stopHard,laadPlaywright,browserOpties,geenBrowser,wachtOpNetstilte}=require('./helper');
const {haalSessies,opslagVoor}=require('../scripts/lib/proefsessies');
const pw=laadPlaywright();
test('de Edge biedt elke backoffice- en reisactie eenmaal en voert de juiste handeling uit',{skip:geenBrowser(pw)},async()=>{
 const srv=await startServer({env:{RTG_MAGNAAT_TEST:'1',RTG_AI_UIT:'1',SMTP_URL:''}});let browser;
 try{const {sessies}=await haalSessies(srv.base);browser=await pw.chromium.launch(browserOpties(pw));
 for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
  await ctx.addInitScript(s=>{for(const[k,v]of Object.entries(s))localStorage.setItem(k,v)},{...opslagVoor(sessies),rtg_lang:'nl'});
  const page=await ctx.newPage();
  await page.goto(srv.base+'/apps/backoffice.html');await wachtOpNetstilte(page);
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
  const actions=page.locator('.rtg-adaptive-controls');
  for(const name of ['Actiecentrum','Live onderweg','Partnerprestaties','Omzet per dag']){
   assert.equal(await actions.getByRole('button',{name,exact:true}).count(),1,width+': één '+name);
  }
  await actions.getByRole('button',{name:'Partnerprestaties',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.wos-rail button.actief')?.getAttribute('aria-label')==='Partnerprestaties');
  await page.goto(srv.base+'/apps/reizen-veilig.html');await wachtOpNetstilte(page);
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
  assert.equal(await actions.getByRole('button',{name:'Vandaag',exact:true}).count(),1,width+': Vandaag eenmaal');
  await actions.getByRole('button',{name:'Reizen',exact:true}).click();
  await page.waitForFunction(()=>!!document.querySelector('.rv-pane.actief[data-id="reisblad"]'));
  assert.equal(await actions.getByRole('button',{name:'Reizen',exact:true}).count(),1,'een nieuw actief werkblad maakt geen dubbele actie');
  await actions.getByRole('button',{name:'Vandaag',exact:true}).click();
  await page.waitForFunction(()=>!!document.querySelector('.rv-pane.actief[data-id="overzicht"]'));
  assert.equal(await actions.getByRole('button',{name:'Vandaag',exact:true}).count(),1,'teruggaan blijft dezelfde handeling');
  await ctx.close();
 }
 }finally{if(browser)await browser.close();await stopHard(srv.child)}
});
