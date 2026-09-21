/* A visible document lifecycle, including mobile gestures. API reads assert
   persistence; creation, naming, opening and deletion use the actual UI. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stopHard,laadPlaywright,browserOpties,geenBrowser,veegDoor}=require('./helper');
const pw=laadPlaywright();
async function fixture(doe){
 const srv=await startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});let browser;
 try{const call=async(p,b,t)=>{const r=await fetch(srv.base+p,{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:JSON.stringify(b||{})});return{status:r.status,...await r.json()}};
 const n=Date.now(),user=await call('/api/auth/register',{name:'Documentcontrole',email:'docs'+n+'@test.invalid',phone:'06'+String(n).slice(-8),password:'geheim123',geboortedatum:'1990-01-01',tier:'rtg'});
 assert.ok(user.token);const api=(p,b)=>call('/api/kantoorpakket/'+p,b,user.token);
 browser=await pw.chromium.launch(browserOpties(pw));
 await doe({browser,api,call,base:srv.base,token:user.token});
 }finally{if(browser)await browser.close();await stopHard(srv.child)}
}
async function pageFor(browser,base,token,width){const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
 await page.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1')},token);
 await page.goto(base+'/apps/office.html');await page.waitForFunction(()=>window.RTGOffice&&window.RTGOffice.stand());return page}
async function drive(page){const first=page.locator('#rtdVoorzijde [data-rtd-diep="lijst"]').first();if(await first.isVisible())await first.click();await page.waitForSelector('#nieuwTekst')}
async function drawer(page,row){await row.scrollIntoViewIfNeeded();await row.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await veegDoor(page,await row.boundingBox(),{afstand:-145,stappen:16});await row.locator('.gb-lade').waitFor();}
async function confirmGesture(page){const b=page.locator('dialog.gb-blad .gb-borg');await b.waitFor();await b.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter')}
for(const width of [390,1440])test('Office '+width+': alle zes documentsoorten maken, herladen en verwijderen via echte bediening',{skip:geenBrowser(pw)},async()=>fixture(async({browser,base,token,api})=>{
 const page=await pageFor(browser,base,token,width);let requestDeletes=0;page.on('request',r=>{if(r.url().endsWith('/kantoorpakket/weg'))requestDeletes++});
 await drive(page);
 const created=[];
 for(const [button,kind]of [['nieuwTekst','tekst'],['nieuwBlad','blad'],['nieuwPres','presentatie'],['nieuwFormulier','formulier'],['nieuwSchets','schets'],['nieuwBord','bord']]){
  await page.locator('#'+button).click();await page.locator('#editor.aan').waitFor();await page.locator('#titel').fill('Controle '+kind);
  if(kind==='tekst')await page.locator('#tekst').fill('Deze inhoud moet na het herladen blijven bestaan.');
  await page.locator('#editTerug').click();await page.locator('#nieuwTekst').waitFor();
  const doc=(await api('mijn')).docs.find(d=>d.titel==='Controle '+kind);assert.ok(doc,'opgeslagen '+kind);created.push(doc.id);
 }
 await page.reload();await page.waitForFunction(()=>window.RTGOffice&&window.RTGOffice.stand());await drive(page);
 assert.equal(await page.locator('#mijnDocs .doc').count(),6);
 const favorite=page.locator('#mijnDocs .doc[data-open="'+created[0]+'"]');
 await favorite.click({button:'right'});
 await page.locator('dialog.gb-blad').getByRole('button',{name:'Als favoriet bewaren',exact:true}).click();
 await page.waitForFunction(id=>window.RTGOffice.stand().docs.find(x=>x.id===id).ster,created[0]);
 await page.reload();await page.waitForFunction(()=>window.RTGOffice&&window.RTGOffice.stand());await drive(page);
 assert.equal((await api('mijn')).docs.find(d=>d.id===created[0]).ster,true,'favoriet blijft na herladen bewaard');
 await favorite.click({button:'right'});
 await page.locator('dialog.gb-blad').getByRole('button',{name:'Uit favorieten verwijderen',exact:true}).click();
 await page.waitForFunction(id=>!window.RTGOffice.stand().docs.find(x=>x.id===id).ster,created[0]);
 assert.equal((await api('mijn')).docs.length,6,'favoriet verwijderen verwijdert geen document');
 await page.locator('#mijnDocs .doc').filter({hasText:'Controle tekst'}).click();
 await page.locator('#editor.aan').waitFor();
 assert.match(await page.locator('#tekst').innerText(),/na het herladen/);await page.locator('#editTerug').click();
 const first=page.locator('#mijnDocs .doc').first();await drawer(page,first);
 await first.locator('.gb-doe').click();assert.equal(requestDeletes,0,'een veeg en tik verwijderen nog niets');
 await page.keyboard.press('Escape');assert.equal((await api('mijn')).docs.length,6,'annuleren behoudt elk document');
 for(const id of created){const row=page.locator('#mijnDocs .doc[data-open="'+id+'"]');await row.waitFor();await drawer(page,row);await row.locator('.gb-doe').click();await confirmGesture(page);await row.waitFor({state:'detached'});}
 await page.reload();await page.waitForFunction(()=>window.RTGOffice&&window.RTGOffice.stand());assert.equal((await api('mijn')).docs.length,0);
 assert.equal(requestDeletes,6,'precies één verwijderaanvraag per document');await page.close();
}));
test('RTDocs: een geweigerde verwijdering blijft zichtbaar en gedeelde documenten bieden geen verwijderactie',{skip:geenBrowser(pw)},async()=>fixture(async({browser,base,token,api,call})=>{
 const own=await api('maak',{soort:'tekst',titel:'Mijn proefdocument'});assert.ok(own.id);
 const n=Date.now(),other=await call('/api/auth/register',{name:'Andere eigenaar',email:'other'+n+'@test.invalid',phone:'07'+String(n).slice(-8),password:'geheim123',geboortedatum:'1990-01-01',tier:'rtg'});
 const shared=await call('/api/kantoorpakket/maak',{soort:'tekst',titel:'Alleen gedeeld'},other.token);
 const state=await call('/api/state',{},token);await call('/api/kantoorpakket/deel',{id:shared.id,codenaam:state.state.user.codename,rechten:'bewerken'},other.token);
 const page=await pageFor(browser,base,token,390);
 const ownRow=page.locator('[data-rtd-documentrij="'+own.id+'"]');await ownRow.waitFor();await drawer(page,ownRow);await ownRow.locator('.gb-doe').click();
 await page.route('**/api/kantoorpakket/weg',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'De opslag is tijdelijk niet bereikbaar.'})}));
 await confirmGesture(page);await page.locator('#melding.zien').filter({hasText:'niet bereikbaar'}).waitFor();
 assert.ok((await api('mijn')).docs.some(d=>d.id===own.id));assert.equal(await ownRow.isVisible(),true);
 await page.unroute('**/api/kantoorpakket/weg');
 const sharedRow=page.locator('[data-rtd-documentrij="'+shared.id+'"]');await sharedRow.scrollIntoViewIfNeeded();await sharedRow.click({button:'right'});
 assert.equal(await page.locator('dialog.gb-blad .gb-borg').count(),0,'meeschrijven verleent geen verwijderrecht');await page.keyboard.press('Escape');
 assert.equal((await api('weg',{id:shared.id})).status,403,'de server bewaakt dezelfde eigenaarsgrens');
 await drawer(page,ownRow);await ownRow.locator('.gb-doe').click();await confirmGesture(page);await page.waitForFunction(id=>!document.querySelector('[data-rtd-documentrij="'+id+'"]'),own.id);
 await page.reload();await page.waitForFunction(()=>window.RTGOffice&&window.RTGOffice.stand());assert.equal((await api('mijn')).docs.length,0);assert.equal((await api('mijn')).gedeeld.length,1);await page.close();
}));
