'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./helper');let srv,browser;const pw=h.laadPlaywright();
async function post(route,body,token){
 const r=await fetch(srv.base+route,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{})});
 const out=await r.json();assert.equal(r.status,200,JSON.stringify(out));return out;
}
test.before(async()=>{
 assert.ok(pw,'Een echte browser is vereist.');
 srv=await h.startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1',RTG_BETALEN_UIT:'1'}});
 browser=await pw.chromium.launch(h.browserOpties(pw));
});
test.after(async()=>{if(browser)await browser.close();if(srv)await h.stop(srv.child);});
for(const width of [390,1440])test(width+'px: Living World maakt, bevestigt, hervat en toont de RTG Edge',async()=>{
 const owner=(await post('/api/auth/register',{name:'Maker',email:'world-maker-'+width+'@example.test',phone:'0612345678',
  password:'VeiligWachtwoord123!',geboortedatum:'1990-01-01',tier:'rtg'})).token;
 const member=(await post('/api/auth/register',{name:'Reiziger',email:'world-member-'+width+'@example.test',phone:'0612345678',
  password:'VeiligWachtwoord123!',geboortedatum:'1990-01-01',tier:'rtg'})).token;
 const context=await browser.newContext({viewport:{width,height:900},timezoneId:'UTC'});
 await context.addInitScript(t=>localStorage.setItem('rtg_member_token',t),owner);
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);h.letOpFouten(page,errors);
 await page.goto(srv.base+'/apps/living-world.html?tab=studio');await page.waitForSelector('[data-lw-primary]');
 await page.locator('#lwContent [data-lw-primary]').click();await page.locator('#lwField-title').fill('Haven '+width);
 await page.locator('#lwField-area').fill('IJmuiden');await page.locator('#lwField-description').fill('Een plek om samen de wereld te ontdekken.');
 await page.locator('#lwSubmit').click();await page.waitForSelector('#lwPreview:not([hidden])');
 assert.equal((await post('/api/living-world/view',{},owner)).places.filter(p=>p.title==='Haven '+width).length,0,'preview schept geen plek');
 await page.locator('#lwSubmit').click();await page.waitForSelector('[data-lw-action="place.publish"]');
 await page.locator('[data-lw-action="place.publish"]').click();await confirm(page);
 await page.waitForSelector('[data-lw-action="blueprint.create"]');await page.locator('[data-lw-action="blueprint.create"]').click();
 await page.locator('#lwField-title').fill('Mijn kustervaring '+width);await page.locator('#lwField-summary').fill('Samen langs de kust, met ruimte voor een eigen verhaal.');
 await page.locator('#lwField-activity').fill('Wandelen');await page.locator('#lwField-remixAllowed').check();await confirm(page);
 await page.waitForSelector('[data-lw-action="blueprint.publish"]');await page.locator('[data-lw-action="blueprint.publish"]').click();await confirm(page);
 await page.waitForSelector('[data-lw-action="plan.create"]');
 const bp=(await post('/api/living-world/view',{},owner)).blueprints.find(b=>b.title==='Mijn kustervaring '+width);
 assert.ok(bp);
 const travelerContext=await browser.newContext({viewport:{width,height:900},timezoneId:'UTC'});
 await travelerContext.addInitScript(t=>localStorage.setItem('rtg_member_token',t),member);
 const traveler=await travelerContext.newPage();traveler.setDefaultTimeout(15000);h.letOpFouten(traveler,errors);
 await traveler.goto(srv.base+bp.url);await traveler.waitForSelector('[data-lw-action="plan.create"]');
 await traveler.locator('[data-rtg-adaptive-action="context"]').click();
 await traveler.waitForSelector('.rtg-edge-action [data-rtg-edge-primary]');
 assert.equal((await traveler.locator('.rtg-edge-action [data-rtg-edge-primary]').innerText()).trim().toLowerCase(),'take me there');
 await traveler.locator('.rtg-edge-action [data-rtg-edge-primary]').click();await confirm(traveler);
 await traveler.waitForSelector('[data-lw-action="plan.update"]');
 const plan=(await post('/api/living-world/view',{},member)).plans[0];assert.equal(plan.status,'planning');
 assert.equal((await post('/api/living-world/view',{},owner)).plans.some(p=>p.id===plan.id),false);
 await traveler.locator('[data-lw-action="plan.update"]').click();
 const scheduled=Date.now()+10000;
 // Native datetime-local normaliseert hele minuten zonder het secondenveld.
 const localDate=new Date(scheduled).toISOString().slice(0,19).replace(/:00$/,'');
 await traveler.locator('#lwField-date').fill(localDate);
 await traveler.locator('#lwField-notes').fill('Graag een rustige route.');await confirm(traveler);
 await traveler.waitForSelector('[data-lw-action="plan.request"]');await traveler.locator('[data-lw-action="plan.request"]').click();await confirm(traveler);
 await page.goto(srv.base+'/apps/living-world.html?plan='+plan.id);await page.waitForSelector('[data-lw-action="plan.decide"]');
 assert.match(await page.locator('.lw-detail').textContent(),/Graag een rustige route/);
 await page.locator('[data-lw-action="plan.decide"]').click();await page.locator('#lwField-decision').selectOption('accepted');
 await page.locator('#lwField-reason').fill('Rustige route afgesproken.');await confirm(page);
 await traveler.reload();await traveler.waitForSelector('.lw-stages [aria-current="step"]');
 assert.equal(await traveler.locator('.lw-stages [aria-current="step"]').textContent(),'Geaccepteerd');
 await traveler.waitForSelector('.rtg-edge-chrome');
 assert.equal(await traveler.locator('.rtg-edge-chrome').count(),1);
 assert.equal(await traveler.evaluate(()=>window.RTGAdaptief.context().bron),'living-world');
 assert.equal(await traveler.locator('#lwMain [data-hoofdactie]').count(),1);
 assert.equal(await traveler.locator('body').getAttribute('data-rtg-world'),'travel');
 assert.equal(await traveler.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 const out=path.join(__dirname,'../artifacts/living-world');fs.mkdirSync(out,{recursive:true});
 await screenshot(traveler,path.join(out,'experience-'+width+'.png'));
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,scheduled-Date.now()+50)));
 await page.reload();await page.waitForSelector('[data-lw-action="plan.start"]');
 await page.locator('[data-lw-action="plan.start"]').click();await confirm(page);
 await page.waitForSelector('[data-lw-action="plan.complete"]');await page.locator('[data-lw-action="plan.complete"]').click();
 await page.locator('#lwField-statement').fill('De deelnemer heeft de afgesproken kustwandeling voltooid.');await confirm(page);
 await traveler.reload();await traveler.waitForSelector('[data-lw-action="plan.acknowledge"]');
 await traveler.locator('[data-lw-action="plan.acknowledge"]').click();await confirm(traveler);
 await traveler.getByRole('button',{name:'Iets achterlaten',exact:true}).click();
 await traveler.locator('#lwField-planId').selectOption(plan.id);
 await traveler.locator('#lwField-title').fill('Verzamelen bij de haven '+width);
 await traveler.locator('#lwField-text').fill('Spreek vooraf een precieze ontmoetingsplek af.');
 await traveler.locator('#lwField-communityRelease').check();
 await traveler.locator('#lwField-attribution').fill('Reiziger');await confirm(traveler);
 const contribution=(await post('/api/living-world/view',{},member)).contributions.find(c=>c.title==='Verzamelen bij de haven '+width);
 await page.goto(srv.base+contribution.url);await page.waitForSelector('[data-lw-action="contribution.review"]');
 await page.locator('[data-lw-action="contribution.review"]').click();await page.locator('#lwField-decision').selectOption('accepted');
 await page.locator('#lwField-reason').fill('Samen gecontroleerd tijdens de wandeling.');await confirm(page);
 await page.waitForSelector('[data-lw-action="contribution.adopt"]');await page.locator('[data-lw-action="contribution.adopt"]').click();await confirm(page);
 await traveler.goto(srv.base+bp.url);await traveler.waitForSelector('.lw-detail');
 assert.match(await traveler.locator('.lw-detail').textContent(),/Blueprintversie 2/);
 assert.match(await traveler.locator('.lw-detail').textContent(),/Spreek vooraf een precieze ontmoetingsplek af/);
 assert.ok((await post('/api/connect/portfolio',{},member)).worldContributions.some(c=>c.id===contribution.id));
 await traveler.goto(srv.base+'/apps/connect.html#deel-jij');
 await traveler.getByRole('link',{name:'Verzamelen bij de haven '+width,exact:true}).waitFor();
 await page.goto(srv.base+'/apps/living-world.html?tab=studio');await page.waitForSelector('#lwContent .lw-grid');
 await screenshot(page,path.join(out,'studio-'+width+'.png'));
 assert.deepEqual(errors,[]);await travelerContext.close();await context.close();
});
async function confirm(page){
 await page.locator('#lwSubmit').click();
 await page.waitForFunction(()=>!document.getElementById('lwPreview').hidden||document.getElementById('lwFormError').textContent);
 assert.equal(await page.locator('#lwFormError').textContent(),'');
 await page.locator('#lwSubmit').click();await page.waitForSelector('#lwDialog',{state:'hidden'});
 assert.equal(await page.locator('.rtg-adaptive-sheet').isVisible(),false,'an executed action must not leave its old Edge sheet over the next step');
}
async function screenshot(page,file){
 await page.waitForFunction(()=>document.body.dataset.rtgDesktopState==='ready');
 await page.keyboard.press('Escape');await page.mouse.move(-10,-10);await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:file});
}
