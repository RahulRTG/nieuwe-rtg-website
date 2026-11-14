'use strict';
const assert=require('node:assert/strict');
const {letOpFouten}=require('./helper');

/* Publieke documentkeuze in één gemeten configuratie; geen volledige matrix. */
module.exports=async function destination(t,{context,open,browser,base,device,viewport}) {
  const ctx=await context(viewport.width,viewport.height);
  try {
    const page=await ctx.newPage(),documents=[],navigations=[];
    const pageErrors=letOpFouten(page,[],{eigenZeef:true});
    page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
    page.on('response',response=>{
      if(response.request().isNavigationRequest()&&response.frame()===page.mainFrame())
        documents.push({url:response.url(),status:response.status()});
    });
    const response=await open(page,'/apps/juridisch.html');
    const main=page.locator('#hoofd'),heading=page.locator('#hoofd h1');
    await main.waitFor({state:'visible'});
    await heading.waitFor({state:'visible'});
    await heading.scrollIntoViewIfNeeded();
    const actual=await page.evaluate(()=>({
      path:location.pathname+location.search+location.hash,world:document.body.dataset.rtgWorld,
      title:document.title,heading:document.querySelector('#hoofd h1').textContent.trim(),
      viewport:{width:innerWidth,height:innerHeight},deviceScaleFactor:devicePixelRatio,
      touch:navigator.maxTouchPoints>0,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,
      locale:navigator.language,networkOnline:navigator.onLine,memberToken:localStorage.getItem('rtg_member_token')
    }));
    assert.equal(actual.memberToken,null,'de publieke ingang krijgt geen ledencredential');
    assert.deepEqual(actual.viewport,viewport);
    assert.equal(actual.deviceScaleFactor,1);assert.equal(actual.touch,false);
    assert.equal(actual.reducedMotion,true);assert.equal(actual.locale,'nl-NL');
    assert.equal(response.request().redirectedFrom(),null);
    const mainVisible=await main.isVisible(),headingVisible=await heading.isVisible();
    const headingUnobscured=await heading.evaluate(el=>{
      const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return !!hit&&(el===hit||el.contains(hit))&&!el.closest('[inert],[aria-hidden="true"]');
    });
    const links=page.locator('#hoofd .docs a');
    const documentLinks=await links.evaluateAll(nodes=>nodes.map(el=>({
      url:el.getAttribute('href'),title:el.querySelector('.ds-lijst__titel').textContent.trim()
    })));
    assert.equal(await links.count(),3,'de echte documentkeuze bevat drie publicaties');
    let linksReachable=true;
    for(let i=0;i<3;i++){
      const link=links.nth(i);
      await link.scrollIntoViewIfNeeded();
      const visible=await link.isVisible();
      const reachable=await link.evaluate(el=>{
        const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return !!hit&&(el===hit||el.contains(hit))&&!el.closest('[inert],[aria-hidden="true"]')&&
          el.getAttribute('aria-disabled')!=='true'&&el.tabIndex>=0;
      });
      linksReachable=linksReachable&&visible&&reachable;
    }
    const cookieNoticePresent=await page.locator('#rtg-cookie').count()>0;
    const sameOrigin=new URL(page.url()).origin===new URL(base).origin;
    assert.equal(page.url(),base+'/apps/juridisch.html','bereikbaarheid meten verlaat het overzicht niet');
    await ctx.close();
    assert.ok(documents.length);assert.ok(navigations.length);
    const observed={path:actual.path,sameOrigin,world:actual.world,title:actual.title,heading:actual.heading,
      mainVisible,headingVisible,headingUnobscured,documentLinks,linksReachable,cookieNoticePresent,
      networkOnline:actual.networkOnline,documentStatus:response.status(),
      redirects:navigations.filter(url=>url!==base+'/apps/juridisch.html').length,
      documentErrors:documents.filter(doc=>doc.status!==200||doc.url!==base+'/apps/juridisch.html').length,
      pageErrors:pageErrors.length};
    const expected={path:'/apps/juridisch.html',sameOrigin:true,world:'living',title:'Juridisch',heading:'Juridisch',
      mainVisible:true,headingVisible:true,headingUnobscured:true,
      documentLinks:[
        {url:'/apps/juridisch/voorwaarden.html',title:'Algemene voorwaarden'},
        {url:'/apps/juridisch/privacy.html',title:'Privacybeleid'},
        {url:'/apps/juridisch/partnervoorwaarden.html',title:'Partnervoorwaarden'}
      ],linksReachable:true,cookieNoticePresent:false,networkOnline:true,documentStatus:200,
      redirects:0,documentErrors:0,pageErrors:0};
    assert.deepEqual(observed,expected);
    const configuration={browser:browser.browserType().name(),browserVersion:browser.version(),viewport:actual.viewport,
      deviceScaleFactor:actual.deviceScaleFactor,touch:actual.touch,reducedMotion:actual.reducedMotion,locale:actual.locale,
      serviceWorkers:'block',persona:'anonymous',state:'normal',network:'normal',device};
    if(process.env.RTG_EXPERIENCE_SOURCE&&process.env.RTG_EXPERIENCE_COMMIT){
      const {sha}=require('../scripts/lib/experience/evidence'),{stable}=require('../scripts/lib/experience/artifact');
      t.diagnostic('RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(configuration));
      t.diagnostic('RTG_EXPERIENCE_OBSERVATION '+JSON.stringify({version:1,instrument:'test/juridisch-ds.e2e.js',
        subjectType:'screen',subjectId:'screen:/apps/juridisch.html',dimension:'continuity',requirement:'destination',
        sourceHash:process.env.RTG_EXPERIENCE_SOURCE,commit:process.env.RTG_EXPERIENCE_COMMIT,
        configurationHash:sha(JSON.stringify(stable(configuration))),method:'browser',
        checks:[{id:t.name,observed,expected,passed:true}],result:'passed'}));
    }
  } finally {await ctx.close();}
};
