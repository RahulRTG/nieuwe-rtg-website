'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {laadPlaywright,browserOpties,geenBrowser} = require('./helper');
const {bedienNavigatie,volledigeBediening} = require('../scripts/appwerkt');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let server,externServer,browser,base,externBase,variant='goed',hits,externHits;
const doelen = [
  {bestemming:'/apps/b.html',inhoud:'main h1',titel:'Document B'},
  {bestemming:'/apps/c.html',inhoud:'main h1',titel:'Document C'}
];
const meet = {pad:'/apps/a.html',bestemming:'/apps/a.html',navigatielinks:doelen};
const leegKnopbewijs = {gevonden:0,geklikt:0,overgeslagen:[]};
test.before(async()=>{
  if(skip)return;
  externServer=http.createServer((_req,res)=>{externHits++;res.end('Dit adres mocht niet bezocht worden');});
  await new Promise(resolve=>externServer.listen(0,'127.0.0.1',resolve));
  externBase='http://127.0.0.1:'+externServer.address().port;
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://proef.invalid');hits.push(url.pathname);
    if(url.pathname==='/apps/a.html'){
      const links='<a href="/apps/b.html"'+(variant==='verborgen'?' hidden':'')+'>Lees document</a>'+ (variant==='ontbrekend'?'':'<a href="/apps/c.html">Lees document</a>')+
        (variant==='dubbel'?'<a href="/apps/b.html">Lees document</a>':'')+
        (variant==='onbekend'||(variant==='laatste-wijziging'&&hits.includes('/apps/c.html'))?'<a href="/apps/d.html">Nieuw document</a>':'')+
        (variant==='extern'?'<a href="https://example.invalid/extern">Buiten RTG</a>':'');
      res.setHeader('content-type','text/html');
      res.end('<!doctype html><title>Keuze</title><header><a href="/apps/schil.html">Account</a></header><main>'+links+
        '<div class="ds-edge"><a href="/apps/schil.html">Rahul</a></div></main>');return;
    }
    if(variant==='redirect'&&url.pathname==='/apps/b.html'){res.writeHead(302,{location:'/apps/d.html'});res.end();return;}
    if(url.pathname==='/apps/b.html'&&['redirect-extern','redirect-lus','redirect-keten'].includes(variant)){
      const location=variant==='redirect-extern'?externBase+'/verboden':variant==='redirect-lus'?'/apps/b.html':'/apps/c.html';
      res.writeHead(302,{location});res.end();return;
    }
    if(variant==='redirect-keten'&&url.pathname==='/apps/c.html'){res.writeHead(307,{location:'/apps/d.html'});res.end();return;}
    const b=url.pathname==='/apps/b.html';
    res.statusCode=b&&variant==='404'?404:200;
    res.setHeader('content-type','text/html');
    const titel=b&&variant==='titel'?'Verkeerd':b&&variant==='titel-inlog'?'RTG, log in':b&&variant==='titel-vertraagd'?'Laden':'Document '+(b?'B':'C');
    res.end('<!doctype html><title>'+titel+'</title><main><h1>Leesbaar document</h1></main>'+
      (b&&variant==='bedekt'?'<aside style="position:fixed;inset:0;background:white">Blokkade</aside>':'')+
      (b&&variant==='titel-vertraagd'?'<script>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.title="Document B";}));</script>':'')+
      (b&&variant==='titel-wijzigt'?'<script>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.title="Verkeerd";}));</script>':'')+
      (b&&variant==='bestemming-wijzigt'?'<script>requestAnimationFrame(()=>requestAnimationFrame(()=>{history.replaceState(null,"","/apps/c.html");}));</script>':'')+
      (b&&variant==='crash'?'<script>throw new Error("bestemmingsdefect")</script>':''));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port;
  browser=await pw.chromium.launch(browserOpties(pw));
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));if(externServer)await new Promise(resolve=>externServer.close(resolve));});
async function proef(v){
  variant=v;hits=[];externHits=0;
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:800,height:600}});
  try{return await bedienNavigatie(ctx,base,meet);}finally{await ctx.close();}
}
test('echte links behouden gelijke labels met verschillende bestemmingen en uitsluiting van schil',{skip},async()=>{
  const r=await proef('goed');
  assert.deepEqual(r.onbewezen,[]);assert.deepEqual(r.fouten,[]);
  assert.equal(r.gevonden,2);assert.equal(r.geklikt,2);
  assert.equal(new Set(r.aangeraakt.map(x=>x.merk)).size,2);
  assert.deepEqual(r.aangeraakt.map(x=>x.bestemming),['/apps/b.html','/apps/c.html']);
  assert.equal(hits.includes('/apps/schil.html'),false);
  assert.equal(volledigeBediening({...leegKnopbewijs,navigatie:r}),true);
  assert.equal(volledigeBediening({...leegKnopbewijs,gevonden:1,navigatie:r}),false,'linkbewijs mag een onaangeraakte knop niet maskeren');
});
test('meerdere exemplaren naar dezelfde bestemming krijgen ieder een echte klik',{skip},async()=>{
  const r=await proef('dubbel');
  assert.equal(r.gevonden,3);assert.equal(r.geklikt,3);assert.equal(new Set(r.aangeraakt.map(x=>x.merk)).size,3);
  assert.equal(volledigeBediening({...leegKnopbewijs,navigatie:r}),true);
});
test('asynchrone documenttitel moet exact de gecontracteerde toestand bereiken',{skip},async()=>{
  const r=await proef('titel-vertraagd');
  assert.deepEqual(r.onbewezen,[]);assert.deepEqual(r.fouten,[]);
  assert.equal(volledigeBediening({...leegKnopbewijs,navigatie:r}),true);
  assert.equal(r.aangeraakt.find(x=>x.bestemming==='/apps/b.html').titel,'Document B');
});
for(const v of ['onbekend','extern','ontbrekend','verborgen','redirect','redirect-extern','redirect-lus','redirect-keten','404','titel','titel-inlog','titel-wijzigt','bestemming-wijzigt','bedekt','crash','laatste-wijziging'])
  test('linkbediening is niet volledig bewezen bij '+v,{skip},async()=>{
    const r=await proef(v);
    assert.equal(volledigeBediening({...leegKnopbewijs,navigatie:r}),false,JSON.stringify(r));
    assert.ok(r.onbewezen.length||r.fouten.length);
    if(v==='onbekend'||v==='extern')assert.equal(r.gevonden,3,'een niet uitvoerbare link blijft in de noemer');
    if(v==='ontbrekend')assert.ok(r.onbewezen.some(x=>x.includes('ontbreekt')));
    if(v.startsWith('titel'))assert.ok(r.onbewezen.some(x=>x.includes('documenttitel')),'onjuiste of inlogtitel blijft onbewezen');
    assert.equal(hits.includes('/apps/d.html'),false,'een onbekende link of redirect wordt niet gevolgd');
    assert.equal(externHits,0,'ook een externe loopbackbestemming wordt niet geraakt');
    if(v.startsWith('redirect')) {
      assert.equal(hits.filter(p=>p==='/apps/b.html').length,1,'geen redirectlus of dubbele preflight-fetch');
      assert.ok(r.onbewezen.some(x=>x.includes('redirect')), 'de redirectgrens blijft expliciet onbewezen');
    }
  });
