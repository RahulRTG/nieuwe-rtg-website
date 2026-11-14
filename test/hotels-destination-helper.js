'use strict';
const assert=require('node:assert/strict');
/* Eén gemeten Hotels-ingang; geen alle-device of volledige schermkwalificatie. */
module.exports=async function destination(t,{open,browser,base,email,device,viewport={width:390,height:844}}) {
  const {ctx,page,documents,navigations,pageErrors,response}=await open(viewport.width,viewport.height);
  try {
    await page.locator('#main').waitFor({state:'visible'});
    await page.locator('#verblijfTitel').waitFor({state:'visible'});
    await page.locator('#inhoud [data-huis]').first().waitFor({state:'visible'});
    const me=await page.evaluate(async()=>{
      const response=await fetch('/api/auth/me',{method:'POST',headers:{'Content-Type':'application/json',
        Authorization:'Bearer '+localStorage.getItem('rtg_member_token')},body:'{}'});
      return {status:response.status,body:await response.json()};
    });
    assert.equal(me.status,200); assert.ok(me.body.user?.id);
    assert.equal(me.body.user.email,email); assert.equal(me.body.user.tier,'rtg');
    const actual=await page.evaluate(()=>({path:location.pathname+location.search+location.hash,world:document.body.dataset.rtgWorld,
      title:document.title,heading:document.querySelector('#verblijfTitel').textContent.trim(),
      viewport:{width:innerWidth,height:innerHeight},deviceScaleFactor:devicePixelRatio,
      touch:navigator.maxTouchPoints>0,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,locale:navigator.language,
      networkOnline:navigator.onLine}));
    assert.equal(response.status(),200); assert.equal(response.request().redirectedFrom(),null);
    const observed={path:actual.path,sameOrigin:new URL(page.url()).origin===new URL(base).origin,
      world:actual.world,title:actual.title,heading:actual.heading,
      mainVisible:await page.locator('#main').isVisible(),headingVisible:await page.locator('#verblijfTitel').isVisible(),
      headingUnobscured:await page.locator('#verblijfTitel').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(el===hit||el.contains(hit))&&!el.closest('[inert],[aria-hidden="true"]');}),
      catalogueVisible:await page.locator('#inhoud [data-huis]').first().isVisible(),ownerAuthenticated:true,
      redirects:navigations.filter(url=>url!==base+'/apps/hotels.html').length,
      documentErrors:documents.filter(doc=>doc.status!==200||doc.url!==base+'/apps/hotels.html').length,
      pageErrors:pageErrors.length};
    assert.ok(documents.length); assert.ok(navigations.length);
    const expected={path:'/apps/hotels.html',sameOrigin:true,world:'travel',title:'RTG Verblijven',
      heading:'Waar wilt u thuiskomen?',mainVisible:true,headingVisible:true,headingUnobscured:true,catalogueVisible:true,
      ownerAuthenticated:true,redirects:0,documentErrors:0,pageErrors:0};
    if(device!==undefined){
      assert.deepEqual(actual.viewport,viewport);
      Object.assign(observed,{networkOnline:actual.networkOnline,documentStatus:response.status(),ownerStatus:me.status});
      Object.assign(expected,{networkOnline:true,documentStatus:200,ownerStatus:200});
    }
    assert.deepEqual(observed,expected);
    const configuration={browser:browser.browserType().name(),browserVersion:browser.version(),viewport:actual.viewport,
      deviceScaleFactor:actual.deviceScaleFactor,touch:actual.touch,reducedMotion:actual.reducedMotion,locale:actual.locale,
      serviceWorkers:'block',persona:'rtg-member',state:'normal',network:device===undefined?'local-test-server':'normal',
      ...(device===undefined?{}:{device})};
    await ctx.close(); assert.deepEqual(pageErrors,[]);
    if(process.env.RTG_EXPERIENCE_SOURCE&&process.env.RTG_EXPERIENCE_COMMIT){
      const {sha}=require('../scripts/lib/experience/evidence'),{stable}=require('../scripts/lib/experience/artifact');
      t.diagnostic('RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(configuration));
      t.diagnostic('RTG_EXPERIENCE_OBSERVATION '+JSON.stringify({version:1,instrument:'test/hotels-ds.e2e.js',
        subjectType:'screen',subjectId:'screen:/apps/hotels.html',dimension:'continuity',requirement:'destination',
        sourceHash:process.env.RTG_EXPERIENCE_SOURCE,commit:process.env.RTG_EXPERIENCE_COMMIT,
        configurationHash:sha(JSON.stringify(stable(configuration))),method:'browser',
        checks:[{id:t.name,observed,expected,passed:true}],result:'passed'}));
    }
  } finally {await ctx.close();}
};
