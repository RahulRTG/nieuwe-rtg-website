/* Echte Wonen-help UI met expliciete service-responsefixtures.
   Bewijst clientpresentatie/verzoekbinding, geen serverautorisatie. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten,wachtOpSchil}=require('./helper');
const pw=laadPlaywright();let srv,browser,token;
test.before(async()=>{if(geenBrowser(pw))return;srv=await startServer({env:{SMTP_URL:'',RTG_EXTERNE_AI_UIT:'1',LOCAL_AI_URL:'',OPENAI_API_KEY:'',ANTHROPIC_API_KEY:''}});
 const r=await fetch(srv.base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Service UI',email:'basis-service@example.test',phone:'0612345897',password:'geheim12345',geboortedatum:'1990-01-01',tier:'rtg'})});assert.equal(r.status,200);token=(await r.json()).token;assert.ok(token);browser=await pw.chromium.launch(browserOpties(pw));});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
async function open(antwoord){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');},token);
 const page=await context.newPage(),fouten=letOpFouten(page,[]),calls=[];
 await page.route('**/api/service/**',async route=>{const q=route.request(),pad=new URL(q.url()).pathname;calls.push({pad,method:q.method(),body:q.postDataJSON(),auth:q.headers().authorization});
  if(['/api/service/bevestig','/api/service/weiger','/api/service/open','/api/service/mens'].includes(pad)){await antwoord(route);return;}
  const data=pad==='/api/service/bevestigingen'?{ok:true,verzoeken:[{id:'bevestiging-eigen',mens:'Medewerker',reden:'Eigen verzoek',capabilities:['zaak.lezen'],zaak:'Z-eigen',minuten:5}]}:pad==='/api/service/mijn'?{ok:true,zaken:[{id:'Z-eigen',stand:'open',standNaam:'Open',titel:'Eigen zaak'}]}:pad==='/api/service/stand'?{ok:true,raakt:[]}:{ok:true,mag:{mag:false}};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(srv.base+'/apps/wonen.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.RTGAppMenu&&!!window.RTGGids);await wachtOpSchil(page);
 await page.locator('.ds-edge__balk [data-ds-edge="menu"]').click();
 await page.locator('#dsEdgeBlad:not([hidden])').getByRole('button',{name:'Instellingen',exact:true}).click();
 await page.getByRole('dialog',{name:'Instellingen',exact:true}).getByRole('button',{name:'Openen',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Uitleg over deze app',exact:true});await d.getByRole('button',{name:'Bevestigen',exact:true}).waitFor();
 return {context,page,d,calls,fouten};
}
const acties=[
 {knop:'Bevestigen',pad:'/api/service/bevestig',tekst:'Bevestigd.',body:{id:'bevestiging-eigen'},resultaat:{ok:true}},
 {knop:'Nee',pad:'/api/service/weiger',tekst:'Geweigerd.',body:{id:'bevestiging-eigen'},resultaat:{ok:true}},
 {knop:'Ik wil een mens',pad:'/api/service/mens',tekst:'Mens ingeschakeld.',body:{id:'Z-eigen'},resultaat:{ok:true,let:'Mens ingeschakeld.'}},
 {knop:'Versturen',pad:'/api/service/open',tekst:'Genoteerd als Z-nieuw. U hoort van ons.',body:{titel:'Nieuwe hulpvraag',tekst:'Nieuwe hulpvraag',betrokken:{soort:'scherm',code:'/apps/wonen.html'}},resultaat:{ok:true,zaak:{id:'Z-nieuw'}}}
];
async function activeer(x,actie){if(actie.knop==='Versturen'){await x.d.getByRole('button',{name:'Nog iets melden',exact:true}).click();await x.d.getByRole('textbox',{name:'Wat is er aan de hand?'}).fill('Nieuwe hulpvraag');}await x.d.getByRole('button',{name:actie.knop,exact:true}).click();}
for(const actie of acties)for(const geval of ['succes','HTTP-fout','afgewezen'])test(actie.knop+': '+geval+' wordt waarheidsgetrouw getoond',{skip:geenBrowser(pw),timeout:30000},async()=>{
 const goed=geval==='succes',x=await open(r=>r.fulfill({status:geval==='HTTP-fout'?503:200,contentType:'application/json',body:JSON.stringify(geval==='afgewezen'?{ok:false}:actie.resultaat)}));
 try{await activeer(x,actie);await x.d.getByText(goed?actie.tekst:'Niet gelukt. Probeer opnieuw.',{exact:true}).waitFor();
  const c=x.calls.filter(c=>c.pad===actie.pad);assert.equal(c.length,1);assert.deepEqual(c[0],{pad:actie.pad,method:'POST',body:actie.body,auth:'Bearer '+token});
  if(!goed)assert.equal(await x.d.getByText(actie.tekst,{exact:true}).count(),0);assert.deepEqual(x.fouten,[]);
 }finally{await x.context.close();}
});
for(const actie of acties)test(actie.knop+': laat antwoord na actorwisseling publiceert niets',{skip:geenBrowser(pw),timeout:30000},async()=>{
 let ontvangen;const binnen=new Promise(r=>ontvangen=r);let pending;
 const x=await open(r=>{pending=r;ontvangen();});
 try{await activeer(x,actie);await binnen;
  await x.page.evaluate(()=>localStorage.setItem('rtg_member_token','andere-actor'));
  await pending.fulfill({status:200,contentType:'application/json',body:JSON.stringify(actie.resultaat)});
  await x.d.locator('.bss-hulp').waitFor({state:'detached'});
  assert.equal(await x.d.getByText(actie.tekst,{exact:true}).count(),0);assert.doesNotMatch(await x.d.textContent(),/Eigen verzoek|Z-eigen|Eigen zaak/);
  const c=x.calls.filter(c=>c.pad===actie.pad);assert.equal(c.length,1);assert.deepEqual(c[0].body,actie.body);assert.equal(c[0].auth,'Bearer '+token);assert.deepEqual(x.fouten,[]);
 }finally{await x.context.close();}
});
