'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),html=read('public/apps/partner-network.html'),js=read('public/apps/partner-network.js'),css=read('public/ds/componenten/partner.css');
test('Partner behoudt werkidentiteit, alle meetvakken en native reactieformulier onder één DS-presentatie',()=>{
 assert.match(html,/<html lang="nl" data-ds>/);assert.match(html,/class="ds-scherm ds-partner"/);assert.match(html,/data-rtg-world="work"/);
 assert.deepEqual([...html.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].map(m=>m[1]),['/fonts/fonts.css','/ds/rtg-ds.css']);
 assert.match(html,/<dialog id="pnReageer" class="ds-dialoog ds-partner-dialoog" aria-labelledby="pnReageerWat">/);
 for(const id of ['pnZaak','pnStand','pnMelding','pnIntenties','pnAandacht','pnNietGebouwd','pnReageerForm','pnReageerVerstuur'])assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id);
 for(const zone of ['intenties','beloften','aandacht'])assert.ok(html.includes('data-zone="'+zone+'"'));
 for(const field of ['tekst','prijs'])assert.ok(html.includes('name="'+field+'"'));
 assert.match(js,/rtg_sup_token/);assert.match(js,/Authorization: 'Bearer ' \+ \(TOKEN \|\| ''\)/);
 assert.match(js,/\/api\/supplier\/mall\/aanvraag\/reageer/);assert.match(js,/id: vraag.id, versie: vraag.versie/);
 assert.match(js,/\.showModal\(\)/);assert.match(js,/prefers-reduced-motion: reduce/);assert.match(css,/@container ds \(max-width: 40rem\)/);assert.match(css,/\.ds-partner-shell \{ display: flex; flex-wrap: wrap/);assert.match(css,/flex: 999 1 30rem; min-inline-size: 0/);assert.match(css,/repeat\(auto-fit, minmax\(min\(100%, 18rem\), 1fr\)\)/);
 for(const script of ['rtg-world-desktop','basis','metgezel'])assert.ok(html.includes('/shared/'+script+'.js'));
 assert.doesNotMatch(css,/!important|#[\da-f]{3,8}\b|(?:margin|padding|border)-(?:left|right)\s*:/i);
 const tokens=read('public/ds/tokens.css');for(const m of css.matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(m[1]+':'),m[1]);
 const errors=require('../scripts/ontwerpsysteem').contractFouten({paginas:{}});assert.deepEqual(errors.filter(e=>e.includes('componenten/partner.css')),[]);
});
test('echte getallenrenderer houdt onbekend onderscheiden van nul en toont de oorspronkelijke bron',()=>{
 const fields={};for(const k of ['open','onbekend']){fields['[data-getal="'+k+'"]']={};fields['[data-bron="'+k+'"]']={};}
 const context={document:{querySelector:s=>fields[s]}};
 vm.runInNewContext(js.slice(js.indexOf('  function tekenGetallen'),js.indexOf('  function tekenAandacht'))+';this.teken=tekenGetallen;',context);
 context.teken({open:{waarde:0,bron:'Echte telling'},onbekend:{waarde:null,nietGemeten:'Geen bevestigde bron'}});
 assert.equal(fields['[data-getal="open"]'].textContent,'0');assert.equal(fields['[data-bron="open"]'].textContent,'Bron: Echte telling');assert.equal(fields['[data-getal="onbekend"]'].textContent,'niet gemeten');assert.equal(fields['[data-bron="onbekend"]'].textContent,'Geen bevestigde bron');
});
test('echte submit-owner bevestigt alleen exact antwoord en negeert oude ronde of actor',async()=>{
 for(const scenario of ['goed','onvolledig','fout','afgewezen','ander','oud','actor']){
  let submit,resolve,reject,actor=true,success=0,loads=0;
  const nodes={};for(const id of ['pnReageer','pnReageerVerstuur','pnReageerFout','pnReageerWat'])nodes['#'+id]={open:false,textContent:'',disabled:false,showModal(){this.open=true},close(){this.open=false}};
  nodes['#pnReageerForm']={reset(){},addEventListener(t,fn){submit=fn}};
  const c={$:s=>nodes[s],zelfdeActor:()=>actor,ronde:0,bezig:false,HUIDIG:null,FormData:class{get(k){return k==='tekst'?'Eigen reactie':'12'}},api:()=>new Promise((a,b)=>{resolve=a;reject=b}),meld:()=>success++,laad:()=>loads++};
  vm.runInNewContext(js.slice(js.indexOf('  function openReageer'),js.indexOf('  /* De rail'))+';this.open=openReageer;',c);
  c.open({id:'a',versie:3,titel:'Vraag'});submit({preventDefault(){},target:{},submitter:{value:'ok'}});
  if(scenario==='oud'){nodes['#pnReageer'].close();c.open({id:'b',versie:1,titel:'Nieuwe vraag'});}
  if(scenario==='actor')actor=false;
  if(scenario==='fout')reject(new Error('Niet opgeslagen'));
  else resolve(scenario==='onvolledig'?{}:scenario==='afgewezen'?{ok:false}: {ok:true,aanvraag:{id:scenario==='ander'?'b':'a'}});
  await new Promise(r=>setImmediate(r));
  assert.equal(success,scenario==='goed'?1:0,scenario);assert.equal(loads,success);
  if(['onvolledig','fout','ander','afgewezen'].includes(scenario)){assert.equal(nodes['#pnReageer'].open,true);assert.ok(nodes['#pnReageerFout'].textContent);}
  if(scenario==='oud'){assert.equal(nodes['#pnReageerWat'].textContent,'Nieuwe vraag');assert.equal(nodes['#pnReageerFout'].textContent,'');assert.equal(nodes['#pnReageerVerstuur'].disabled,false);}
 }
});
test('echte api-adapter weigert HTTP-fouten en expliciete bodyfouten',async()=>{
 const code=js.slice(js.indexOf('  function api('),js.indexOf('  function meld('));
 for(const [ok,body] of [[false,{ok:true}],[true,{ok:false}],[true,{error:'Afgewezen'}],[true,null]]){
  const c={TOKEN:'eigen',fetch:async()=>({ok,status:ok?200:503,json:async()=>body})};vm.runInNewContext(code+';this.call=api;',c);await assert.rejects(c.call('/api/test',{}));
 }
});
