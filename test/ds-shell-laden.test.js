'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bron=fs.readFileSync('public/ds/shell.js','utf8');
for(const embed of ['nee','frame','query'])test('shell laadt bestaande Edgevolgorde eenmalig: '+embed,()=>{
 const nodes=[],events=[],attrs={},classes=new Set();
 attrs['data-ds']='';
 const document={documentElement:{hasAttribute:k=>Object.hasOwn(attrs,k),setAttribute:(k,v)=>attrs[k]=v,classList:{add:k=>classes.add(k)},appendChild:n=>nodes.push(n)},createElement:tag=>({tag}),addEventListener:(...a)=>events.push(a)};
 document.head={appendChild:n=>{assert.ok(window.RTGDs,'API staat vóór scriptload');nodes.push(n);}};
 const window={location:{search:embed==='query'?'?embed=1':''},localStorage:{getItem:()=> 'bestaand-token'}};window.self=window;window.top=embed==='frame'?{}:window;
 const c=vm.createContext({window,document});vm.runInContext(bron,c);const api=window.RTGDs;vm.runInContext(bron,c);
 assert.equal(window.RTGDs,api);assert.equal(attrs['data-ds'],'');assert.equal(classes.has('ds-ingebed'),embed!=='nee');
 assert.deepEqual(nodes.map(n=>[n.tag,n.src,n.async]),[
  ['script','/shared/rtg-world-identity.js',false],
  ['script','/shared/edge/actiestaat.js',false],
  ['script','/shared/edge/blikveld-hoofdactie.js',false],
  ['script','/shared/edge/blikveld.js',false],
  ['script','/ds/edge.js',false],['script','/ds/edge-modi.js',false]]);
 assert.equal(events.length,1);assert.equal(api.token(),'bestaand-token');
 let open=0,prevent=0;window.RTGSprong={open(){open++;}};events[0][1]({target:{closest:()=>true},preventDefault(){prevent++;}});assert.equal(open,1);assert.equal(prevent,1);
});
test('shell vaste laadpaden zijn in bestaande scanner werkelijk DOMloads',()=>{
 const a=require('../scripts/ontwerpsysteem').scriptLaadAnalyse(bron,{ds:true});
 assert.deepEqual(a.onzeker,[],'de documentbron bezit de DS-grens; de shell wijzigt haar niet');
 assert.deepEqual(a.verwijzingen,[
  {href:'/shared/rtg-world-identity.js',soort:'dom'},
  {href:'/shared/edge/actiestaat.js',soort:'dom'},
  {href:'/shared/edge/blikveld-hoofdactie.js',soort:'dom'},
  {href:'/shared/edge/blikveld.js',soort:'dom'},
  {href:'/ds/edge.js',soort:'dom'},{href:'/ds/edge-modi.js',soort:'dom'}]);
 assert.equal(a.injecties+a.mogelijkeInjecties,0);
});

test('shell activeert nooit een document zonder expliciete DS-grens',()=>{
 const nodes=[],document={documentElement:{hasAttribute:()=>false,classList:{add(){}}},head:{appendChild:n=>nodes.push(n)},addEventListener(){},createElement:tag=>({tag})};
 const window={location:{search:''},localStorage:{getItem:()=>null}};window.self=window;window.top=window;
 const c=vm.createContext({window,document});vm.runInContext(bron,c);
 assert.equal(window.RTGDs,undefined);assert.deepEqual(nodes,[]);
});

test('iedere werkelijke shellhost bezit de DS-grens al in zijn documentbron',()=>{
 const loop=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?loop(dir+'/'+e.name):[dir+'/'+e.name]);
 const hosts=loop('public/apps').filter(p=>p.endsWith('.html')&&fs.readFileSync(p,'utf8').includes('/ds/shell.js'));
 assert.ok(hosts.length>=24,'shellhostinventaris onverwacht gekrompen');
 for(const pad of hosts)assert.match(fs.readFileSync(pad,'utf8'),/<html\b[^>]*\bdata-ds(?:\s|=|>)/i,pad);
});
