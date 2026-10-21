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
   window.__rtgNavigatieProef={onthuld:false,klaar:false,overgang:false,geannuleerd:false};
   addEventListener('pagereveal',e=>{
    const m=window.__rtgNavigatieProef;
    m.onthuld=true;m.overgang=!!e.viewTransition;
    m.controller=!!window.RTGHeritageTransition;
    if(!e.viewTransition){m.klaar=true;return;}
    // Alleen finished observeren voor voortgang; ready blijft door de echte
    // app afgehandeld. Geen globale unhandledrejection/pageerror-suppressie.
    // `finished` bevestigt de overgangspromise. Geef het document daarna twee
    // schilderkansen voordat de proef alweer een echte navigatie start; dit
    // modelleert gebruikersinteractie zonder een vaste tijdwachter.
    const klaarNaSchildering=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{m.klaar=true;}));
    e.viewTransition.finished.then(klaarNaSchildering,klaarNaSchildering);
    if(mode==='annuleren'){e.viewTransition.skipTransition();m.geannuleerd=true;}
   });
  },mode);
  const page=await ctx.newPage();
  await page.emulateMedia({reducedMotion:mode==='verminderd'?'reduce':'no-preference'});
  letOpFouten(page,errors,{eigenZeef:true});
  await page.goto(srv.base+'/apps/connect.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__rtgNavigatieProef.onthuld&&window.__rtgNavigatieProef.klaar);
  const wachtOpOvergangsbron=()=>page.waitForFunction(()=>
   [...document.querySelectorAll('link[rel="stylesheet"]')].every(x=>!!x.sheet)&&
   window.RTGHeritageTransition&&window.RTGHeritageTransition.allowed()!==undefined);
  await wachtOpOvergangsbron();
  for(let n=0;n<5;n++)for(const route of ['/apps/foundation/buurtruil.html','/apps/connect.html']){
   await Promise.all([page.waitForURL(srv.base+route,{waitUntil:'domcontentloaded'}),page.evaluate(p=>location.assign(p),route)]);
   await page.waitForFunction(()=>window.__rtgNavigatieProef.onthuld&&window.__rtgNavigatieProef.klaar);
   await wachtOpOvergangsbron();
   const m=await page.evaluate(()=>({...window.__rtgNavigatieProef,toegestaan:window.RTGHeritageTransition.allowed(),route:location.pathname}));
   assert.equal(m.controller,true,'controller is bij pagereveal aanwezig');
   assert.equal(m.toegestaan,mode!=='verminderd');
   metingen.push(m);
  }
  assert.equal(metingen.length,10);
  const werkelijk=metingen.filter(m=>m.overgang).length;
  if(mode==='normaal')assert.equal(werkelijk,10,
   'normale navigatie gebruikt iedere daadwerkelijke overgang: '+JSON.stringify(metingen));
  else if(mode==='verminderd')assert.equal(werkelijk,0,
   'verminderde beweging maakt geen overgang: '+JSON.stringify(metingen));
  else {
   // Een browser mag een volgende cross-document-overgang overslaan nadat de
   // vorige bewust is geannuleerd. Dat is een platformbesluit, geen appfout.
   // Bewijs daarom het echte annuleerpad én dat iedere aangeboden overgang is
   // overgeslagen, zonder een niet-bestaande animatie af te dwingen.
   assert.ok(werkelijk>0,'minstens één echte overgang bereikt het annuleerpad');
   assert.ok(metingen.filter(m=>m.overgang).every(m=>m.geannuleerd),
    'iedere aangeboden overgang is bewust geannuleerd: '+JSON.stringify(metingen));
  }
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
