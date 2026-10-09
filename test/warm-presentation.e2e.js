'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, letOpFouten, edgeBediening } = require('./helper');
let srv, browser, first, second, photo;
const out = path.resolve(__dirname, '../../output/warm-implementation');
async function api(route, body, token = first) {
  const r = await fetch(srv.base + route, { method:'POST', headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token}: {})},body:JSON.stringify(body || {}) });
  return { status:r.status, body:await r.json() };
}
test.before(async () => {
  srv = await startServer({ env:{SMTP_URL:'',RTG_AI_UIT:'1',RTG_DEMO:'0'} });
  const pw = laadPlaywright(); assert.ok(pw, 'A real browser is required'); browser = await pw.chromium.launch(browserOpties(pw));
  const n = Date.now();
  for (const i of [0,1]) {
    const r = await api('/api/auth/register',{name:'Beelden test '+i,email:'beelden-'+n+'-'+i+'@e.test',phone:'06'+String(n+i).slice(-8),password:'geheim123',geboortedatum:'1980-01-01',tier:'business',pasApp:'business'},null);
    assert.equal(r.status,200); if (!i) first=r.body.token; else second=r.body.token;
  }
  const dataUrl='data:image/webp;base64,'+fs.readFileSync(path.join(__dirname,'../public/images/daily/agenda.webp')).toString('base64');
  const r=await api('/api/bestanden/upload',{naam:'Mijn eigen foto.webp',dataUrl}); assert.equal(r.status,200,JSON.stringify(r.body)); photo=r.body.id;
  fs.mkdirSync(out,{recursive:true});
});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
test('personal image preferences survive reload, reject another account and validate crop bounds',async()=>{
  const image={file:photo,desktop:{x:30,y:60,zoom:1.2},mobile:{x:70,y:50,zoom:1.6}};
  assert.equal((await api('/api/ik/beelden/zet',{slot:'living/hoofd',image})).status,200);
  assert.deepEqual((await api('/api/ik/beelden')).body.images['living/hoofd'],image);
  assert.deepEqual((await api('/api/ik/beelden',{},second)).body.images,{});
  assert.equal((await api('/api/ik/beelden/zet',{slot:'living/hoofd',image},second)).status,404);
  assert.equal((await api('/api/ik/beelden/zet',{slot:'living/hoofd',image:{...image,mobile:{x:101,y:50,zoom:1}}})).status,400);
  assert.equal((await api('/api/ik/beelden/zet',{slot:'__proto__',image})).status,400);
  assert.equal((await api('/api/ik/beelden',{},null)).status,401);
});
test('four worlds share the drawn desktop and mobile composition, and editor saves both crops',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:1040},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(token=>{localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');localStorage.setItem('rtg_member_token',token);},first);
  const page=await ctx.newPage(), errors=[];letOpFouten(page,errors);
  try {
    for (const [world,route] of [['living','rtg'],['work','kantoor'],['travel','reizen'],['foundation','foundation/os-publiek']]) {
      await page.setViewportSize({width:1440,height:1040});await page.goto(srv.base+'/apps/'+route+'.html',{waitUntil:'domcontentloaded'});
      await page.waitForSelector('body[data-rtg-desktop-state="ready"]');await page.waitForSelector('.rtg-adaptive-bar');await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('.wp-photo').count(),1,world);
      await page.screenshot({path:path.join(out,world+'-desktop.png')});
      fs.writeFileSync(path.join(out,world+'-geometry.json'),JSON.stringify(await page.evaluate(()=>Object.fromEntries(['body','.wd-shell','.wd-greeting','.wd-home','.wd-favorites','.wp-scene','.wp-heading','.wp-atmosphere','.rtg-edge-top','.rtg-edge-chrome'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e),r=e.getBoundingClientRect();return [s,{y:r.y,height:r.height,display:c.display,rows:c.gridTemplateRows,background:c.background,position:c.position,margin:c.margin,padding:c.padding}]}))),null,2));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,world+' desktop overflow');
      for(const width of [320,390,430]) {
        await page.setViewportSize({width,height:932});
        assert.equal(await page.locator('.wp-tabs').isVisible(),false,'mobile has one domain surface, without desktop accessory tabs');
        assert.equal(await page.locator('.wd-home>.wp-scene').isVisible(),true,'the shared cinematic world scene must remain the mobile lead');
        assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(),1);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,world+' '+width+' overflow');
        if(width===430)await page.screenshot({path:path.join(out,world+'-mobile.png')});
      }
    }
    await page.goto(srv.base+'/apps/rtg.html');await page.waitForSelector('body[data-rtg-desktop-state="ready"]');
    await page.waitForFunction(()=>document.querySelector('.wp-photo img').src.startsWith('data:'));
    await edgeBediening(page,'Beelden aanpassen');await page.waitForSelector('.pi-editor[open]');
    await page.getByRole('button',{name:'Mobiel',exact:true}).click();
    await page.getByLabel('Horizontaal',{exact:true}).fill('65');await page.getByLabel('Vergroten',{exact:true}).fill('1.5');
    await page.screenshot({path:path.join(out,'editor-mobile.png')});await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.waitForSelector('.pi-editor',{state:'detached'});
    assert.equal((await api('/api/ik/beelden')).body.images['living/hoofd'].mobile.x,65);
    await page.reload();await page.waitForFunction(()=>document.querySelector('.wp-photo img')?.style.transform==='scale(1.5)');
    await edgeBediening(page,'Beelden aanpassen');await page.getByRole('button',{name:'Herstel RTG-beeld',exact:true}).click();await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.waitForSelector('.pi-editor',{state:'detached'});
    assert.equal((await api('/api/ik/beelden')).body.images['living/hoofd'],undefined);
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('family photo uploads, gallery, cancel and profile switches use only the selected family identity',async()=>{
  for (const route of ['/api/foundation/gezin/beelden', '/api/foundation/gezin/beelden/zet',
    '/api/foundation/gezin/beelden/mijn', '/api/foundation/gezin/beelden/haal',
    '/api/foundation/gezin/beelden/upstart', '/api/foundation/gezin/beelden/updeel',
    '/api/foundation/gezin/beelden/upklaar', '/api/foundation/gezin/beelden/upload']) {
    assert.equal((await api(route, {}, first)).status, 401, route + ' rejects a member token without the chosen family profile');
  }
  async function family(route,body){return api('/api/foundation/gezin/'+route,body,null);}
  const made=await family('maak',{gezinsnaam:'Eigen beelden',naam:'Ouder',pin:'1234',bevoegdGezin:true,privacyAkkoord:true});assert.equal(made.status,200);const parent=made.body;
  const child=await family('profiel/maak',{code:parent.code,token:parent.token,naam:'Milan',rol:'kind',geboortedatum:'2015-04-04',pin:'5678'});assert.equal(child.status,200);
  const selected=await family('profiel/kies',{gezinscode: parent.gezinscode,profielId:child.body.profiel.id,pin:'5678'});assert.equal(selected.status,200);
  const session={code:parent.code,token:selected.body.token,profiel:selected.body.profiel}, other={code:parent.code,token:parent.token};
  const ctx=await browser.newContext({viewport:{width:390,height:932},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(({session,first})=>{localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');localStorage.setItem('rtg_member_token',first);localStorage.setItem('rtf_sessie',JSON.stringify(session));},{session,first});
  const page=await ctx.newPage(),errors=[],memberRequests=[];letOpFouten(page,errors);
  page.on('request',r=>{if(/\/api\/(ik\/beelden|bestanden\/)/.test(r.url()))memberRequests.push(r.url());});
  try{
    await page.goto(srv.base+'/apps/foundation/index.html');await edgeBediening(page,'Beelden aanpassen');await page.waitForSelector('.pi-editor[open]');
    const original=fs.readFileSync(path.join(__dirname,'../public/images/daily/agenda.webp'));
    const large=Buffer.concat([original,Buffer.alloc(4*1024*1024)]);
    await page.locator('#piUpload').setInputFiles({name:'Eigen grote foto.webp',mimeType:'image/webp',buffer:large});
    await page.waitForSelector('.pi-sliders input:not(:disabled)');
    await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.waitForSelector('.pi-editor',{state:'detached'});
    const saved=(await family('beelden',session)).body.images['foundation/hoofd'];assert.ok(saved.file);
    assert.deepEqual((await family('beelden',other)).body.images,{});
    assert.equal((await family('beelden/haal',{...other,id:saved.file})).status,404);
    assert.equal((await family('beelden/zet',{...other,slot:'foundation/hoofd',image:saved})).status,404);
    assert.equal((await family('beelden/zet',{...session,slot:'foundation/hoofd',image:{...saved,file:photo}})).status,404);
    await edgeBediening(page,'Beelden aanpassen');await page.getByRole('button',{name:'Mijn foto’s',exact:true}).click();
    await page.locator('.pi-gallery button').filter({hasText:'Eigen grote foto.webp'}).waitFor();
    await page.getByLabel('Vergroten',{exact:true}).fill('1.8');await page.getByRole('button',{name:'Annuleren',exact:true}).click();
    assert.deepEqual((await family('beelden',session)).body.images['foundation/hoofd'],saved);
    await page.evaluate(other=>localStorage.setItem('rtf_sessie',JSON.stringify(other)),{...other,profiel:parent.profiel});
    await page.waitForFunction(()=>!document.querySelector('.wp-photo img').src.startsWith('data:'));
    assert.deepEqual(memberRequests,[]);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('Connection actions preserve the shared navigation on desktop and mobile',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');});
  const page=await ctx.newPage();
  try {
    for(const product of ['vonk','rendezvous']) {
      await page.goto(srv.base+'/apps/notities.html');
      await page.waitForSelector('.rtg-adaptive-bar');
      await page.addStyleTag({url:srv.base+'/shared/connection-edge.css'});
      for(const file of ['connection-edge-core','connection-edge-input','connection-edge'])await page.addScriptTag({url:srv.base+'/shared/'+file+'.js'});
      await page.evaluate(async product=>{
        window.connectionCalls=0;
        window.connectionTest=RTGConnectionEdge.create({product,load:async()=>({surface:product.toUpperCase()+'_ROOT',state:'DISCOVERY',availableCapabilities:['connection.discover'],actions:[{id:'discover',capability:'connection.discover',labelKey:'connection.edge.discover'}]}),onAction:()=>{window.connectionCalls++;}});
        await window.connectionTest.setRoot();
      },product);
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});
        const action=page.locator('.wd-page .connection-edge [data-connection-action="discover"]');
        await action.waitFor();
        assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(),1);
        assert.equal(await page.locator('.connection-edge').evaluate(e=>getComputedStyle(e).position),'relative');
        await action.click();
        await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
        const projected=page.locator('.rtg-adaptive-controls').getByRole('button',{name:await action.innerText(),exact:true});
        await projected.click();
        assert.equal(await page.evaluate(()=>window.connectionCalls),width===1440?2:4);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      }
      await page.evaluate(()=>window.connectionTest.destroy());
      assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),true);
    }
  }finally{await ctx.close();}
});
