'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture,tick}=require('./lib/plek-fixture');
function omgeving(naam){const dom=fixture({source:''}),requests=[],events={},opslag={rtg_member_token:'A',rtg_arrival_pass:JSON.stringify({p:'P',tot:'2099-01-01'})};let listener,starts=0,stops=0;
 const window={addEventListener:(k,f)=>events[k]=f,RTGPlek:{aan:()=>true,toestemmingVersie:()=>0,volg(){starts++;return()=>stops++;}},RTGPlaats:{opWissel:f=>{listener=f;return()=>listener=null;},start:async()=>{starts++;return{ok:true};},stop(){stops++;}}};
 if(naam==='plaats')delete window.RTGPlaats;
 const document=dom.document;document.readyState='loading';document.addEventListener=()=>{};
 vm.runInNewContext(fs.readFileSync('public/shared/'+naam+'.js','utf8'),{window,document,localStorage:{getItem:k=>opslag[k]||null},fetch:(url,opt)=>new Promise(resolve=>requests.push({url,opt,reply:(body,ok=true)=>resolve({ok,json:async()=>body})})),Date,Promise});
 return {...dom,window,requests,events,opslag,starts:()=>starts,stops:()=>stops,emit:w=>listener&&listener(w)};
}
const pass=()=>({ok:true,pass:{zaak:{code:'Z',naam:'Zaak'},vervaltAt:'2099-01-01',pulse:'nog-niet-onderweg'}});
async function active(e){const p=e.window.RTGPlaatsNadering.ronde();e.requests[0].reply(pass());await tick();e.node('.ja').click();await tick();e.requests[1].reply(pass());await tick();e.requests[2].reply({status:200});await p;}
test('plaats stop/pagehide en actorwissel blokkeren late hekken vóór GPS',async()=>{
 for(const wijzig of [e=>e.window.RTGPlaats.stop(),e=>e.events.pagehide(),e=>e.opslag.rtg_member_token='B']){const e=omgeving('plaats');const p=e.window.RTGPlaats.start('nadering');wijzig(e);e.requests[0].reply({hekken:[{id:'Z'}]});assert.equal((await p).ok,false);assert.equal(e.starts(),0);}
 const e=omgeving('plaats'),a=e.window.RTGPlaats.start('a'),b=e.window.RTGPlaats.start('b');e.requests[0].reply({hekken:[{id:'oud'}]});await a;e.requests[1].reply({hekken:[{id:'nieuw'}]});assert.equal((await b).ok,true);assert.equal(e.starts(),1);
});
test('nadering eist HTTPsucces en bewaakt pending pass tegen pagehide/actor/passwissel',async()=>{
 for(const [wijzig,httpOk] of [[e=>e.events.pagehide(),true],[e=>e.opslag.rtg_member_token='B',true],[e=>e.opslag.rtg_arrival_pass=JSON.stringify({p:'Q',tot:'2099-01-01'}),true],[()=>{},false]]){const e=omgeving('plaatsnadering'),p=e.window.RTGPlaatsNadering.ronde();wijzig(e);e.requests[0].reply(pass(),httpOk);await p;assert.equal(e.node('.rtgnader'),null);assert.equal(e.starts(),0);}
});
test('nadering hercontroleert dezelfde pass en zendt alleen één puls zonder GPS',async()=>{
 const e=omgeving('plaatsnadering');await active(e);assert.equal(e.styles().length,0);const w={doel:'nadering',hek:'leverancier:Z',wat:'binnen'};e.emit(w);e.emit(w);assert.equal(e.requests.length,4);e.requests[3].reply(pass());await tick();assert.equal(e.requests.length,5);assert.deepEqual(JSON.parse(e.requests[4].opt.body),{pass:'P',pulse:'in-de-buurt'});assert.equal(e.requests[4].opt.headers.Authorization,'Bearer A');e.requests[4].reply({ok:true});await tick();assert.equal(e.stops(),1);
});
test('nadering stopt bij nieuwe pass en ingetrokken delen zonder puls',async()=>{
 for(const revoke of [false,true]){const e=omgeving('plaatsnadering');await active(e);if(!revoke)e.opslag.rtg_arrival_pass=JSON.stringify({p:'Q',tot:'2099-01-01'});e.emit({doel:'nadering',hek:'leverancier:Z',wat:'binnen'});if(revoke){const p=pass();p.pass.pulse='delen-gestopt';e.requests[3].reply(p);await tick();}assert.equal(e.requests.some(r=>r.url.endsWith('/pulse')),false);assert.equal(e.stops(),1);}
});
test('pagehide tijdens toestemming verwijdert kaart; oude Ja start niets',async()=>{
 const e=omgeving('plaatsnadering'),p=e.window.RTGPlaatsNadering.ronde();e.requests[0].reply(pass());await tick();const ja=e.node('.ja');e.events.pagehide();ja.click();await p;assert.equal(e.node('.rtgnader'),null);assert.equal(e.requests.length,1);assert.equal(e.starts(),0);
});
test('pending venster na pagehide start geen motor; dubbelronde doet geen dubbele intake',async()=>{
 const e=omgeving('plaatsnadering'),a=e.window.RTGPlaatsNadering.ronde();await e.window.RTGPlaatsNadering.ronde();assert.equal(e.requests.length,1);e.requests[0].reply(pass());await tick();e.node('.ja').click();await tick();e.requests[1].reply(pass());await tick();e.events.pagehide();e.requests[2].reply({status:200});await a;assert.equal(e.starts(),0);
});
test('passresponse tijdens puls mag na actorwisseling of stop niet verzenden',async()=>{
 for(const wijzig of [e=>e.opslag.rtg_member_token='B',e=>e.window.RTGPlaatsNadering.stop(),e=>e.opslag.rtg_arrival_pass=JSON.stringify({p:'P',tot:'2000-01-01'})]){const e=omgeving('plaatsnadering');await active(e);e.emit({doel:'nadering',hek:'leverancier:Z',wat:'binnen'});wijzig(e);e.requests[3].reply(pass());await tick();assert.equal(e.requests.some(r=>r.url.endsWith('/pulse')),false);}
});
test('HTTP-fout op hekken geeft geen GPS ondanks positieve body',async()=>{const e=omgeving('plaats'),p=e.window.RTGPlaats.start('nadering');e.requests[0].reply({hekken:[{id:'Z'}]},false);assert.equal((await p).ok,false);assert.equal(e.starts(),0);});
test('synchrone stop tijdens volg-aanmaak ruimt ook de teruggegeven watcher op',async()=>{
 const e=omgeving('plaats');let cleanup=0;e.window.RTGPlek.volg=()=>{e.window.RTGPlaats.stop();return()=>cleanup++;};const p=e.window.RTGPlaats.start('nadering');e.requests[0].reply({hekken:[{id:'Z'}]});assert.equal((await p).ok,false);assert.equal(cleanup,1);
});
test('echte Arrival-stopknop annuleert vóór handmatige request een late automatische passresponse',async()=>{
 const e=omgeving('plaatsnadering');await active(e);e.emit({doel:'nadering',hek:'leverancier:Z',wat:'binnen'});
 const bron=fs.readFileSync('public/apps/arrival-voorzijde.js','utf8');const blok=bron.slice(bron.indexOf("document.querySelectorAll('[data-pulse]')"),bron.indexOf('\nfunction verder()'));
 let click;const calls=[];const button={dataset:{pulse:'stop'},addEventListener:(k,f)=>click=f};
 vm.runInNewContext(blok,{document:{querySelectorAll:()=>[button]},window:e.window,P:'P',api:(url,body)=>{assert.equal(e.stops(),1,'stop vóór HTTP');calls.push(body);return Promise.resolve({pass:{}});},teken(){},meld(){}});
 click();e.requests[3].reply(pass());await tick();assert.equal(e.requests.some(r=>r.url.endsWith('/pulse')),false);assert.equal(calls.length,1);assert.equal(calls[0].pulse,'stop');
});
test('afgewezen motorstart ruimt listener op en laat een nieuwe bewuste ronde toe',async()=>{
 const e=omgeving('plaatsnadering');e.window.RTGPlaats.start=()=>Promise.reject(new Error('motor niet beschikbaar'));await active(e);
 assert.equal(e.stops(),1);assert.equal(e.emit({doel:'nadering',hek:'leverancier:Z',wat:'binnen'}),null);
 const p=e.window.RTGPlaatsNadering.ronde();assert.equal(e.requests.length,4);e.requests[3].reply(pass());await tick();assert.ok(e.node('.rtgnader'));e.node('.nee').click();await p;assert.equal(e.requests.some(r=>r.url.endsWith('/pulse')),false);
});

test('toestemmingsintrekking vóór of tijdens passhercontrole voorkomt automatische puls',async()=>{
 for(const laat of [false,true]){const e=omgeving('plaatsnadering');await active(e);if(!laat)e.window.RTGPlek.aan=()=>false;e.emit({doel:'nadering',hek:'leverancier:Z',wat:'binnen'});if(laat){e.window.RTGPlek.aan=()=>false;e.requests[3].reply(pass());await tick();}assert.equal(e.requests.some(r=>r.url.endsWith('/pulse')),false);assert.equal(e.stops(),1);}
});
