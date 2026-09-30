/* Echte kantoorinvulling en gast zonder account; geen verzonnen API-antwoorden. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),h=require('./helper');
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
for(const width of [390,1440])test(width+'px: handmatige wereldreis, concept, gastlink, wijzigen en intrekken',async()=>{
 const srv=await h.startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});let browser;
 try{
  const office=await h.kantoorAlsPersoon(srv.base),pw=h.laadPlaywright();browser=await pw.chromium.launch(h.browserOpties(pw));
  const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(t=>{localStorage.setItem('rtg_office_token',t);localStorage.setItem('rtg_lang','nl');},office);
  const page=await context.newPage(),errors=[];h.letOpFouten(page,errors);await page.goto(srv.base+'/apps/kantoren.html?kamer=reisbureau');await page.waitForSelector('#rp-titel');
  await page.locator('#rp-titel').fill('Rome · van deur tot deur');await page.locator('#rp-bestemming').fill('Rome, Italië');await page.locator('#rp-personen').fill('2');await page.locator('#rp-contactNaam').fill('Uw RTG-reisadviseur');
  await page.locator('#rp-basis').click();assert.equal(await page.locator('#rp-onderdelen>li').count(),8);
  for(let i=0;i<8;i++){
    await page.locator('#rp-onderdelen>li').nth(i).locator('button').first().click();
    await page.locator('#rp-item-datum').fill(day(10+(i>4?5:0)));await page.locator('#rp-item-tijd').fill('10:00');await page.locator('#rp-item-zone').fill(i<2?'Europe/Amsterdam':'Europe/Rome');
  }
  await page.locator('#rp-onderdelen>li').nth(3).locator('button').first().click();await page.locator('#rp-item-titel').fill('Hotel in Rome - handmatige test');await page.locator('#rp-item-klasse').fill('Suite met privétransfer');await page.locator('#rp-item-instructies').fill('Ontmoet uw chauffeur bij de receptie.');
  let dropped=false;await page.route('**/api/office/reisbureau/klaarzetten',async route=>{if(!dropped){dropped=true;await route.fetch();await route.abort();}else await route.continue();});
  await page.locator('#rp-bewaar').click();await page.waitForFunction(()=>document.querySelector('#rp-bericht').textContent.includes('Uw invoer staat nog'));assert.equal(await page.locator('#rp-titel').inputValue(),'Rome · van deur tot deur');
  await page.locator('#rp-bewaar').click();await page.waitForFunction(()=>document.querySelector('#rp-bericht').textContent.includes('al opgeslagen'));await page.unroute('**/api/office/reisbureau/klaarzetten');
  await page.reload();await page.waitForSelector('#rp-bewaard .rp-saved');await page.locator('#rp-bewaard button').first().click();assert.equal(await page.locator('#rp-titel').inputValue(),'Rome · van deur tot deur');assert.equal(await page.locator('#rp-onderdelen>li').count(),8);
  await page.locator('#rp-voorbeeld').click();assert.match(await page.locator('#rp-preview').innerText(),/Suite met privétransfer/);
  await page.locator('#rp-toestemming').check();await page.locator('#rp-deel').click();await page.waitForSelector('#rp-link input');const link=await page.locator('#rp-link input').inputValue();assert.equal(await page.locator('#rp-bewaard .rp-saved').count(),1);assert.equal(new URL(link).origin,srv.base);
  const guest=await browser.newContext({viewport:{width,height:1000}}),g=await guest.newPage();h.letOpFouten(g,errors);await g.goto(link);await g.waitForSelector('.rp-tijdlijn');
  assert.equal(await g.locator('.rp-step').count(),8);assert.match(await g.locator('#vak').innerText(),/Hotel in Rome/);assert.equal(await g.locator('#rGo,.tos-hero,.rtg-adaptive-bar').count(),0);assert.equal(new URL(g.url()).hash,'');
  assert.equal(await g.evaluate(()=>localStorage.getItem('rtg_member_token')),null);assert.ok(!await g.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
  const dir=path.join(__dirname,'../artifacts/reisprogramma');fs.mkdirSync(dir,{recursive:true});await g.screenshot({path:path.join(dir,'guest-'+width+'.png'),fullPage:true});await page.locator('#rp-titel').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,'editor-'+width+'.png')});
  await page.locator('#rp-titel').fill('Wereldreis · 東京 → New York');await page.locator('#rp-bewaar').click();await page.waitForFunction(()=>document.querySelector('#rp-bericht').textContent.includes('Versie 3 bewaard'));await g.locator('#gast-ververs').click();await g.waitForFunction(()=>document.querySelector('#vak').textContent.includes('Wereldreis · 東京'));
  const api=async(p,b,token)=>{const r=await fetch(srv.base+p,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
  assert.equal((await api('/api/office/reisbureau/klaarzetten',{programma:{}},null)).status,401);
  const rows=(await api('/api/office/reisbureau/uitnodigingen',{},office)).body.uitnodigingen;const row=rows.find(r=>r.programmaReis),id=row.id;
  const conflict=await api('/api/office/reisbureau/klaarzetten',{id,versie:1,programma:row.programma,idem:'stale-client'},office);assert.equal(conflict.status,409);
  const edits=await Promise.all(['one','two'].map(idem=>api('/api/office/reisbureau/klaarzetten',{id,versie:row.versie,programma:row.programma,idem:'concurrent-'+idem},office)));assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
  const c=new URL(link).hash.split('=')[1];const read=await fetch(srv.base+'/api/reis/uitnodiging/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:c})});assert.equal(read.headers.get('cache-control'),'no-store');
  assert.equal((await api('/api/reis/uitnodiging/open',{code:'WRONG'})).status,404);
  await api('/api/office/reisbureau/uitnodiging-weg',{id},office);await g.locator('#gast-ververs').click();await g.waitForFunction(()=>!document.querySelector('.rp-tijdlijn'));assert.doesNotMatch(await g.locator('#vak').innerText(),/Hotel in Rome/);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await h.stop(srv.child);}
});
