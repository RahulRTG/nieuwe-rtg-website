'use strict';
/* Echt document-navigeren: geen HTML-response-rewrite of foutfilter. De
   observer van de app moet er zijn voordat pagereveal plaatsvindt. */
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const {haalSessies,opslagVoor}=require('../scripts/lib/proefsessies');
const {maakContext}=require('../scripts/appwerkt');
const pw=laadPlaywright(),skip=geenBrowser(pw);
let srv,browser,opslag;
test.before(async()=>{
 if(skip)return;
 srv=await startServer({env:{SMTP_URL:''}});
 const rollen=await haalSessies(srv.base,['gezin']);
 assert.deepEqual(rollen.overgeslagen,[]);
 opslag=opslagVoor(rollen.sessies);
 browser=await pw.chromium.launch(browserOpties(pw));
});
test.after(async()=>{if(browser)await browser.close();if(srv)await stop(srv.child);});
for(const mode of ['normaal','annuleren','verminderd'])test('Heritage echte navigatie: '+mode,{skip},async()=>{
 const ctx=await maakContext(browser,opslag),errors=[],metingen=[];
 try{
  await ctx.addInitScript(mode=>{
   window.__rtgNavigatieProef={onthuld:false,klaar:false,overgang:false};
   addEventListener('pagereveal',e=>{
    const m=window.__rtgNavigatieProef;
    m.onthuld=true;m.overgang=!!e.viewTransition;
    m.controller=!!window.RTGHeritageTransition;
    if(!e.viewTransition){m.klaar=true;return;}
    // Alleen finished observeren voor voortgang; ready blijft door de echte
    // app afgehandeld. Geen globale unhandledrejection/pageerror-suppressie.
    e.viewTransition.finished.then(()=>{m.klaar=true;},()=>{m.klaar=true;});
    if(mode==='annuleren')e.viewTransition.skipTransition();
   });
  },mode);
  const page=await ctx.newPage();
  await page.emulateMedia({reducedMotion:mode==='verminderd'?'reduce':'no-preference'});
  letOpFouten(page,errors,{eigenZeef:true});
  await page.goto(srv.base+'/apps/connect.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__rtgNavigatieProef.onthuld&&window.__rtgNavigatieProef.klaar);
  for(let n=0;n<5;n++)for(const route of ['/apps/foundation/buurtruil.html','/apps/connect.html']){
   await Promise.all([page.waitForURL(srv.base+route,{waitUntil:'load'}),page.evaluate(p=>location.assign(p),route)]);
   await page.waitForFunction(()=>window.__rtgNavigatieProef.onthuld&&window.__rtgNavigatieProef.klaar);
   const m=await page.evaluate(()=>({...window.__rtgNavigatieProef,toegestaan:window.RTGHeritageTransition.allowed()}));
   assert.equal(m.controller,true,'controller is bij pagereveal aanwezig');
   assert.equal(m.toegestaan,mode!=='verminderd');
   metingen.push(m);
  }
  assert.equal(metingen.length,10);
  const werkelijk=metingen.filter(m=>m.overgang).length;
  assert.equal(werkelijk,mode==='verminderd'?0:10,'daadwerkelijke overgangen, niet alleen afwezigheid van fouten');
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
