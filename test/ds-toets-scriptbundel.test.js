'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {scriptsVan,alleenDs}=require('./lib/ds-toets');
const {codeer}=require('../server/middleware/scriptbundel-rij');
const {scriptbundel}=require('../server/middleware/scriptbundel');
const bundel=p=>'http://rtg.test/scriptbundel.js?f='+codeer(p);
// Echte bundelmiddleware, zonder netwerk of een tweede bundelaar. Alleen de
// HTTP-adapter is een fixture; de bronbestanden/markeringen komen van de server.
function geleverd(src){
 let status=200,body='',door=false;const headers={},url=new URL(src);
 const res={setHeader:(k,v)=>{headers[k.toLowerCase()]=v;},end:b=>{body=String(b||'');},status(n){status=n;return this;},type(t){headers['content-type']=t;return this;},send(b){body=b;}};
 scriptbundel(path.join(__dirname,'../public'))({path:url.pathname,query:{f:url.searchParams.get('f')},headers:{}},res,()=>{door=true;status=404;});
 return {status:()=>status,headers:()=>headers,text:async()=>body,door};
}
const request={get:async src=>geleverd(src)};
function pagina(urls){let n=0;return {request,evaluate:async()=>++n===1?['http://rtg.test/ds/rtg-ds.css']:urls,locator:sel=>({count:async()=>sel==='html[data-ds]'?1:0,waitFor:async()=>{}})};}
test('gedeelde decoder ontsluit scripts en verwijdert dubbele manifestpaden',async()=>{
 assert.deepEqual(await scriptsVan({request,evaluate:async()=>[bundel(['/shared/basis.js','/shared/randen.js']),'http://rtg.test/shared/basis.js']}),['/shared/basis.js','/shared/randen.js']);
});
test('alleenDs wijst legacy in een scriptbundel daadwerkelijk af',async()=>{
 await assert.rejects(()=>alleenDs(pagina([bundel(['/shared/basis.js','/shared/rtg-heritage-order.js'])])),/laadt op een ds-scherm/);
});
test('bundel zonder basis is geen bewijs van basisaanwezigheid',async()=>{
 await assert.rejects(()=>alleenDs(pagina([bundel(['/shared/cookie.js'])])),/de basis is expliciet opgenomen/);
 await alleenDs(pagina([bundel(['/shared/basis.js','/shared/cookie.js'])]));
});
test('oncontroleerbare bundelmanifesten blijven gesloten',async()=>{
 for(const url of ['http://rtg.test/scriptbundel.js',bundel(['/shared/../secret.js']),bundel(['/scriptbundel.js']),bundel(['https://extern.test/x.js'])])await assert.rejects(()=>scriptsVan({evaluate:async()=>[url]}));
});

test('een ontbrekende serverbron levert geen bundel en geen bewijs van basisaanwezigheid',async()=>{
 const url=bundel(['/shared/basis.js','/shared/__ontbrekende_proefbron.js']);
 assert.equal(geleverd(url).door,true,'de echte middleware weigert de onvolledige bronlijst');
 await assert.rejects(()=>alleenDs(pagina([url])),/scriptbundel wordt geleverd/);
});
test('foutpagina, verkeerde bundel en afgebroken bron tellen niet als levering',async()=>{
 const url=bundel(['/shared/basis.js']),goed=geleverd(url),js=await goed.text();
 for(const antwoord of [
  {...goed,status:()=>500},
  {...goed,headers:()=>({'content-type':'text/html'}),text:async()=>'<html>Vangnet</html>'},
  {...goed,text:async()=>''},
  geleverd(bundel(['/shared/cookie.js'])),
  geleverd(bundel(['/shared/basis.js','/shared/cookie.js'])),
  {...goed,text:async()=>js.slice(0,js.lastIndexOf('} catch (e) { console.error("[rtg] script'))}
 ])await assert.rejects(()=>scriptsVan({evaluate:async()=>[url],request:{get:async()=>antwoord}}));
 await assert.rejects(()=>scriptsVan({evaluate:async()=>[bundel(['/shared/basis.js','/shared/cookie.js'])],
  request:{get:async()=>geleverd(bundel(['/shared/cookie.js','/shared/basis.js']))}}),/bronvolgorde/);
 await assert.rejects(()=>scriptsVan({evaluate:async()=>[url],request:{get:async()=>{throw Error('netwerk ontbreekt');}}}),/netwerk ontbreekt/);
});

test('gebundelde Randen zonder expliciete schermowner wordt afgewezen',async()=>{
 const page=pagina([bundel(['/shared/basis.js','/shared/randen.js'])]);page.url=()=> 'http://rtg.test/apps/hotels.html';
 await assert.rejects(()=>alleenDs(page),/expliciete schermverantwoordelijkheid/);
});
test('expliciete Randen blijft afgewezen bij ontbrekende canonieke presentatie',async()=>{
 const page=pagina([bundel(['/shared/basis.js','/shared/randen.js'])]);page.url=()=> 'http://rtg.test/apps/browser.html';
 page.locator=sel=>({count:async()=>sel==='.rnd-toets.ds-randen-toets'?1:0,waitFor:async()=>{}});
 await assert.rejects(()=>alleenDs(page),/canonieke presentatie/);
});
test('expliciete Randen vereist één owner zonder oude stijl of basisloader',async()=>{
 function host(fout){let n=0;return {request,url:()=> 'http://rtg.test/apps/browser.html',evaluate:async()=>++n===1?['http://rtg.test/ds/rtg-ds.css','http://rtg.test/ds/componenten/randen.css']:[bundel(['/shared/basis.js','/shared/randen.js'])],locator:sel=>({count:async()=>sel==='html[data-ds]'?1:sel==='.rnd-toets.ds-randen-toets'?(fout==='dubbel'?2:1):sel==='#rtgRandenJs,#rndCss'&&fout==='legacy'?1:0,waitFor:async()=>{}})};}
 await alleenDs(host());
 await assert.rejects(()=>alleenDs(host('dubbel')),/canonieke Randen-ingang/);
 await assert.rejects(()=>alleenDs(host('legacy')),/tweede of legacy Randen-owner/);
});
