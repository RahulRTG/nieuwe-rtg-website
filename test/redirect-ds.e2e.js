/* Doorverwijzingen behouden hun bestaande bestemming, query-/fragmentregels
   en vervangende geschiedenis. De terugvalweergave gebruikt DS-componenten;
   deze proef kwalificeert geen domeinfunctionaliteit op de bestemming. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http');
const {laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const root=path.join(__dirname,'..','public');
const routes=[
  ['/apps/berichten.html','/apps/comm.html',''],
  ['/apps/bank.html','/apps/geld.html','#bank'],
  ['/apps/balans.html','/apps/geld.html','#balans'],
  ['/apps/wallet.html','/apps/geld.html','#wallet'],
  ['/apps/metier.html','/apps/geld.html','#metier'],
  ['/apps/logboek.html','/apps/geld.html','#logboek'],
  ['/apps/rtgcode.html','/apps/geld.html','#rtgcode'],
  ['/apps/mecenaat.html','/apps/geld.html','#mecenaat'],
  ['/apps/wbw.html','/apps/geld.html','#wbw'],
  ['/apps/labfonds.html','/apps/geld.html','#labfonds'],
  ['/apps/nalatenschap.html','/apps/geld.html','#nalatenschap'],
  ['/apps/vitaal.html','/apps/veilig.html','#vitaal'],
  ['/apps/thuisrust.html','/apps/veilig.html','#rust'],
  ['/apps/thuiswacht.html','/apps/veilig.html','#wacht'],
  ['/apps/codewoord.html','/apps/veilig.html','#codewoord'],
  ['/apps/kantoorpda.html','/apps/personeel.html?kantoor=1','','vast'],
  ['/apps/zorgbalie.html','/apps/personeel.html','','vast'],
  ['/apps/geld-command.html','/apps/geld.html','','meta'],
  ['/apps/toestemming.html','/apps/mijn-relaties.html','#soort'],
  ['/apps/vandaag.html','/apps/life.html','','query']
];
function bestemming([,pad,hash,wijze],search,fragment){
  return pad+(wijze==='vast'||wijze==='meta'?'':search)+(hash||(wijze?'':fragment));
}
test('redirectbron: de proef omvat iedere bestaande doorverwijzing precies eenmaal',()=>{
  assert.deepEqual(routes.map(rij=>rij[0]).sort(),require('../public/shared/rtg-world-identity').REDIRECTS.slice().sort());
});
for(const rij of routes)test('redirectbron: '+rij[0],()=>{
  const [route,destination,hash,wijze]=rij;
  const source=fs.readFileSync(path.join(root,route),'utf8');
  assert.doesNotMatch(source,/<style\b|\sstyle\s*=|\/shared\/|\/ds\/shell\.js/);
  assert.match(source,/<html\b[^>]*\bdata-ds="1"/,
    'een volledige DS-terugval verklaart de grens vóór huisbrede bediening start');
  assert.match(source,/<link href="\/ds\/rtg-ds\.css" rel="stylesheet">/);
  assert.match(source,/<main class="ds-status"/);
  assert.equal((source.match(/<h1\b/g)||[]).length,1);
  const links=[...source.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
  assert.deepEqual(links.map(link=>link[1]),[destination+hash],'de handmatige terugval heeft dezelfde vaste bestemming');
  assert.ok(links[0][2].trim(),'de terugvalactie heeft een zichtbare naam');
  const meta=/<meta http-equiv="refresh" content="0;\s*url=([^"]+)">/.exec(source);
  assert.equal(meta&&meta[1],destination+hash,'de bestaande JS-loze bestemming blijft exact');
  const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,wijze==='meta'?0:1,'geen tweede navigatiemotor of appbootstrap');
  if(wijze==='meta')return;
  for(const [search,fragment] of [['',''],['?bewijs=a%26b&bron=oud','#gesprek']]){
    const reached=[];
    vm.runInNewContext(scripts[0][1],{location:{search,hash:fragment,replace:route=>reached.push(route)}});
    assert.deepEqual(reached,[bestemming(rij,search,fragment)]);
  }
});

const pw=laadPlaywright();
test('redirectbrowser: echte oude documenten behouden query, stand en vervangende geschiedenis',
  {skip:geenBrowser(pw)},async()=>{
    // Alleen de aliasdocumenten en CSS komen uit productiebron. De bestemming
    // is een read-only ontvangstfixture: deze proef kwalificeert geen
    // bestemmingsworkflow en gebruikt geen accountgegevens.
    const targets=new Set(routes.map(row=>new URL(row[1],'http://localhost').pathname));
    const server=http.createServer((req,res)=>{
      const url=new URL(req.url,'http://localhost');
      if(targets.has(url.pathname)||url.pathname==='/start'){
        res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="nl"><title>Ontvangst</title><main><h1>Bestemming ontvangen</h1></main></html>');return;
      }
      const file=path.resolve(root,'.'+url.pathname);
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'text/html');
      res.end(fs.readFileSync(file));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    let browser;
    try{
      browser=await pw.chromium.launch(browserOpties(pw));
      const page=await browser.newPage({viewport:{width:390,height:844}}),errors=letOpFouten(page,[]);
      for(const rij of routes){
        const [route]=rij;
        await page.goto(base+'/start');
        await page.goto(base+route+'?bewijs=a%26b#gesprek',{waitUntil:'domcontentloaded'});
        await page.waitForURL(base+bestemming(rij,'?bewijs=a%26b','#gesprek'));
        assert.equal(await page.locator('h1').innerText(),'Bestemming ontvangen');
        await page.goBack();assert.equal(new URL(page.url()).pathname,'/start','tussenadres komt niet opnieuw in Terug');
      }
      assert.deepEqual(errors,[]);
    }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
  });
