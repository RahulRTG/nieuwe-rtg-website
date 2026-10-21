/* UI-contractproef, geen autorisatiebewijs: dezelfde echte pagina ontvangt
   gecontroleerd onvolledige HTTP200-payloads. Rendez-vous gebruikt expliciet
   synthetische lege Today-data; de andere herstelgegevens komen van de lokale
   testserver. Geen productieprovider, geen registermutaties. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const pw=laadPlaywright(), skip=geenBrowser(pw);
let srv,browser,member,staff;
async function post(p,b,t){const r=await fetch(srv.base+p,{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:JSON.stringify(b||{})});const d=await r.json();assert.equal(r.status,200,p+': '+JSON.stringify(d));return d;}
test.before(async()=>{
  if(skip)return;
  srv=await startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});
  browser=await pw.chromium.launch(browserOpties(pw));
  const n=Date.now();
  member=(await post('/api/auth/register',{name:'UI contract',email:'uic'+n+'@example.test',phone:'06'+String(n).slice(-8),password:'geheim123',geboortedatum:'1980-01-01',tier:'rtg',pasApp:'rtg'})).token;
  const roster=await post('/api/supplier/roster',{code:'TRANSIT'});
  staff=(await post('/api/supplier/login',{code:'TRANSIT',staffId:roster.staff.find(s=>s.role==='manager').id,pin:'1234'})).token;
});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
const gevallen=[
 {app:'ovroutes',pad:'/api/staff/ov/lijnen',retry:'#ovHerstel',klaar:'#vBeheer',tekst:'routegegevens',state:()=>staff,partieel:{soorten:'bus',lijnen:[],ijkpunten:[]}},
 {app:'residentie',pad:'/api/residentie/betreed',retry:'#residentieHerstel',klaar:'#balk',tekst:'kamergegevens',body:{kamer:'lobby'},state:()=>member,partieel:{kamer:{naam:'Hal'},leden:[]}},
 {app:'magnaat',pad:'/api/member/magnaat/leven/staat',retry:'#vnHerstel',klaar:'#vnDag',tekst:'levensgegevens',state:()=>member,partieel:{dagNaam:'Maandag',dag:1,geld:{bank:'onbekend'}}},
 {app:'rendezvous',pad:'/api/member/rendezvous/kandidaten',retry:'#rvHerstel',klaar:'#rvOpenProfiel',tekst:'ontmoetingsgegevens',state:()=>member,partieel:{profielAan:false,kandidaten:'onbekend'}}
];
for(const g of gevallen)test(g.app+': onvolledig is onbekend, retry herstelt zonder verzonnen resultaat',{skip},async()=>{
 const geldig=g.app==='rendezvous'?{profielAan:false,kandidaten:[]}:await post(g.pad,g.body,g.state());
 const defecten=[{ok:true},{},null,g.partieel].map(payload=>({payload,status:200}));
 if(g.app==='ovroutes')for(const status of [500,503])defecten.push({payload:{error:'tijdelijk niet beschikbaar'},status});
 if(g.app==='magnaat')for(const [veld,waarde] of [['agenda',[{}]],['aandacht',[null]]]){
  const payload=structuredClone(geldig);payload.vandaag[veld]=waarde;defecten.push({payload,status:200});
 }
 if(g.app==='rendezvous')defecten.push({payload:geldig,status:200,introducties:{introducties:[null]}});
 for(const defect of defecten){
  const ctx=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  try{
   await ctx.addInitScript(([m,s])=>{localStorage.setItem('rtg_member_token',m);localStorage.setItem('rtg_pda_token',s);localStorage.setItem('rtg_cookieinfo_v1','1');},[member,staff]);
   const page=await ctx.newPage(), fouten=[],mutaties=[];letOpFouten(page,fouten,{eigenZeef:true});
   page.on('request',r=>{if(/\/api\/(staff\/ov\/lijn\/zet|residentie\/(zeg|stap|meubel\/)|member\/magnaat\/leven\/actie|member\/rendezvous\/(like|pas|profiel\/zet))/.test(r.url()))mutaties.push(r.url());});
   let herstel=false, aanvragen=0;
   if(g.app==='rendezvous')for(const [p,d] of Object.entries({tafels:{tafels:[]},introducties:{introducties:[]},circles:{circles:[]}}))await page.route('**/api/member/rendezvous/'+p,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(!herstel&&p==='introducties'&&defect.introducties?defect.introducties:d)}));
   await page.route('**'+g.pad,async route=>{
    aanvragen++;
    if(g.app==='magnaat'&&aanvragen===1)await page.evaluate(()=>{document.querySelector('#vnTempo').disabled=true;});
    return route.fulfill({status:herstel?200:defect.status,contentType:'application/json',body:JSON.stringify(herstel?geldig:defect.payload)});
   });
   await page.goto(srv.base+'/apps/'+g.app+'.html',{waitUntil:'domcontentloaded'});
   if(g.app==='magnaat'){
    await page.locator('[data-mv-diep="home"]').first().click();
    await page.locator('[data-screen="vandaag"]').click();
   }
   await page.locator(g.retry).waitFor({state:'visible'});
   const tekst=await page.locator('body').innerText();
   assert.match(tekst,new RegExp(g.tekst));
   assert.doesNotMatch(tekst,/undefined|NaN|Cannot read properties/);
   assert.deepEqual(fouten,[]);
   assert.deepEqual(mutaties,[],'foutstatus verzendt geen mutatie');
   if(g.app==='ovroutes')assert.equal(await page.locator('#nieuwBtn').isDisabled(),true);
   if(g.app==='residentie')assert.equal(await page.locator('#balk').isVisible(),false);
   if(g.app==='rendezvous')assert.equal(await page.locator('[data-like]').count(),0);
   if(g.app==='magnaat'){assert.equal(await page.locator('#vnDag').textContent(),'…');assert.equal(await page.locator('#vnKas').textContent(),'…');}
   const eerder=aanvragen;herstel=true;
   await page.locator(g.retry).click();
   await page.locator(g.retry).waitFor({state:'hidden'});
   await page.locator(g.klaar).waitFor({state:'visible'});
   assert.ok(aanvragen>eerder,'retry heeft nieuwe gegevens gevraagd');
   assert.deepEqual(fouten,[]);
   if(g.app==='ovroutes')assert.equal(await page.locator('#nieuwBtn').isDisabled(),false);
   if(g.app==='magnaat'){
    assert.equal(await page.locator('#vnDag').textContent(),geldig.dagNaam+', dag '+geldig.dag);
    assert.equal(await page.locator('#vnTempo').isDisabled(),true,'eerder geblokkeerde bediening blijft geblokkeerd');
    assert.equal(await page.locator('#vnHoofd').isDisabled(),false,'alleen eigen foutblokkade wordt hersteld');
   }
  }finally{await ctx.close();}
 }
});

test('Residentie: ongeldige en uitgevallen pols blokkeren; geldige pols herstelt poort en bediening samen',{skip},async()=>{
 const ctx=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
 try{
  await ctx.addInitScript(t=>{localStorage.setItem('rtg_member_token',t);localStorage.setItem('rtg_cookieinfo_v1','1');},member);
  const page=await ctx.newPage(),fouten=[];letOpFouten(page,fouten,{eigenZeef:true});
  await page.clock.install();
  let modus='geldig';
  await page.route('**/api/residentie/pols',r=>modus==='netwerk'?r.abort('failed'):modus==='leeg'?
   r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}):r.continue());
  await page.goto(srv.base+'/apps/residentie.html',{waitUntil:'domcontentloaded'});
  await page.locator('#balk').waitFor({state:'visible'});
  for(const fout of ['leeg','netwerk']){
   modus=fout;
   const waargenomen=fout==='netwerk'?page.waitForEvent('requestfailed',r=>r.url().endsWith('/api/residentie/pols')):
    page.waitForResponse(r=>r.url().endsWith('/api/residentie/pols'));
   await page.clock.fastForward(25001);await waargenomen;
   await page.locator('#residentieHerstel').waitFor({state:'visible'});
   assert.equal(await page.locator('#balk').isVisible(),false);
   modus='geldig';
   const hersteld=page.waitForResponse(r=>r.url().endsWith('/api/residentie/pols')&&r.status()===200);
   await page.clock.fastForward(25001);await hersteld;
   await page.locator('#poort').waitFor({state:'hidden'});
   await page.locator('#balk').waitFor({state:'visible'});
   // Na herstel is niet alleen het paneel terug: zijn bestaande actie werkt ook.
   const verzonden=page.waitForResponse(r=>r.url().endsWith('/api/residentie/zeg')&&r.status()===200);
   await page.locator('#zegIn').fill('Pols hersteld '+fout);
   await page.locator('#zegGo').click();await verzonden;
  }
  assert.deepEqual(fouten,[]);
 }finally{await ctx.close();}
});
