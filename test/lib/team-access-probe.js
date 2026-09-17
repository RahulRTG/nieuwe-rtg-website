'use strict';
const assert=require('node:assert/strict');
async function taal(page,code,name){
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
  await page.locator('[data-edge-face="all"]').click();
  await page.locator('[data-edge-smart-language]').click();
  await page.locator('#rtg-lang-zoek').fill(name);
  await page.locator('#rtg-lang-hint[data-lang="'+code+'"]').click();
  await page.waitForFunction(c=>document.documentElement.lang===c,code);
}
async function probe(browser,base,width,screenshot){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],writes=[],translations=[];
  await context.addInitScript(()=>{if(!localStorage.getItem('rtg_lang'))localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/vertaal/ui'))translations.push(r.postData()||'');if(r.method()==='POST'&&/\/api\/(supplier\/(mijn\/login|staff\/join|login)|auth\/forgot|office\/login)/.test(r.url()))writes.push(r.url());});
  try{
    const response=await page.goto(base+'/apps/personeel.html',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
    await page.waitForSelector('#liUser');await page.waitForSelector('.rtg-adaptive-bar');
    assert.equal(await page.locator('#gateKlok,.rp-mond').count(),0);
    assert.equal(await page.locator('#teamAccessTitle').innerText(),'Welkom bij uw team.');
    assert.equal(await page.locator('#gate').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(57, 9, 25)');
    await page.locator('#liUser').fill('portal-private@example.test');await page.locator('#liPass').fill('private-password-473');
    await taal(page,'en','English');
    assert.equal(await page.locator('#teamAccessTitle').innerText(),'Welcome to your team.');
    assert.equal(await page.locator('label[for=liUser] span').innerText(),'Email or username');
    assert.equal(await page.locator('label[for=liPass] span').innerText(),'Password');
    assert.equal(await page.locator('#liPass').inputValue(),'private-password-473');
    assert.equal(await page.locator('#liUser').inputValue(),'portal-private@example.test');
    await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small')?.textContent==='Worlds');
    const geometry=await page.evaluate(()=>{const bars=document.querySelectorAll('.rtg-adaptive-bar'),r=bars[0].getBoundingClientRect();return{bars:bars.length,buttons:bars[0].querySelectorAll('button').length,inside:r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.deepEqual(geometry,{bars:1,buttons:5,inside:true,overflow:false});
    await page.locator('#liUser').fill('');await page.locator('#liPass').fill('');
    if(screenshot)await page.screenshot({path:screenshot});
    await page.locator('#toJoin').click();
    assert.equal(await page.locator('label[for=jaPass] span').innerText(),'Your RTG account password');
    await page.locator('#jaBedrijf').fill('Private workplace');await page.locator('#jaPass').fill('private-password-473');await page.locator('#jaPin').fill('2468');
    await taal(page,'nl','Nederlands');
    assert.equal(await page.locator('#teamAccessTitle').innerText(),'Sluit u aan bij uw team.');
    assert.equal(await page.locator('#jaBedrijf').inputValue(),'Private workplace');assert.equal(await page.locator('#jaPass').inputValue(),'private-password-473');assert.equal(await page.locator('#jaPin').inputValue(),'2468');
    assert.equal(await page.locator('#gate').getAttribute('data-access-view'),'join');
    await page.locator('#jaBack').click();await page.locator('#toForgot').click();await page.locator('#fgEmail').fill('portal-private@example.test');
    await taal(page,'en','English');assert.equal(await page.locator('#fgEmail').inputValue(),'portal-private@example.test');assert.match(await page.locator('#teamAccessTitle').innerText(),/help you/);
    await page.locator('#fgBack').click();await page.locator('#toDevice').click();await page.locator('#vastCode').fill('PRIVATE-CODE');
    await taal(page,'nl','Nederlands');assert.equal(await page.locator('#vastCode').inputValue(),'PRIVATE-CODE');assert.equal(await page.locator('#gate').getAttribute('data-access-view'),'device');
    await page.goto(base+'/apps/personeel.html?kantoor=1',{waitUntil:'domcontentloaded'});await page.locator('#kaCode').fill('private-office-code');await page.locator('#kaTotp').fill('123456');
    await taal(page,'en','English');assert.equal(await page.locator('#kaCode').inputValue(),'private-office-code');assert.equal(await page.locator('#kaTotp').inputValue(),'123456');assert.equal(await page.locator('#teamAccessTitle').innerText(),'Welcome to RTG Office.');
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('#teamAccessTitle')?.textContent==='Welcome to RTG Office.');
    assert.deepEqual(writes,[],'Exploration and language changes never submit authentication');
    assert.ok(!translations.join('').includes('private-password-473')&&!translations.join('').includes('portal-private@example.test')&&!translations.join('').includes('private-office-code'),'Credentials never go to translation');
    assert.deepEqual(errors,[]);
    return {width,geometry,login:true,join:true,recovery:true,device:true,office:true,languagePreservedInput:true,localePersisted:true,authWrites:0,errors};
  }finally{await context.close();}
}
module.exports={probe};
