'use strict';
/* Exercise language delivery and races with a deterministic provider double.
   These tests prove the UI transport, not the linguistic quality of 114 translations. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {TALEN}=require('../server/talen');
function languageLayer(en,request){
  const calls=[],cache=new Map(),events=[];
  const doc={readyState:'loading',querySelector:()=>null,querySelectorAll:()=>[],
    addEventListener:()=>{},documentElement:{setAttribute:()=>{}}};
  const window={RTGAutoVertaling:{apply:()=>{}},RTGTaalSchil:{},I18N:{en},addEventListener:()=>{},dispatchEvent:e=>events.push(e),
    RTGVertaalKast:{lees:(lang,src)=>cache.get(lang+'|'+src),zet:(lang,src,value)=>cache.set(lang+'|'+src,value)}};
  const sandbox={window,document:doc,location:{origin:'http://localhost'},navigator:{language:'nl'},
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}},
    localStorage:{setItem:()=>{}},setTimeout,clearTimeout,
    fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return request(body,calls.length);}};
  const bundle=fs.readFileSync(path.join(__dirname,'../public/shared/i18n.js'),'utf8');
  vm.runInNewContext(bundle,sandbox);
  return {i18n:window.RTGi18n,window,calls,cache,events};
}
const response=(body,prefix)=>({ok:true,json:async()=>({naar:body.naar,
  teksten:body.teksten.map(t=>prefix+t),voltooid:body.teksten.map(()=>true),volledig:true})});
test('all dictionary keys beyond 400 arrive in bounded batches and share the cache',async()=>{
  const en=Object.fromEntries(Array.from({length:713},(_,i)=>['key.'+i,'Source message '+i]));
  const layer=languageLayer(en,async b=>response(b,'DE: '));
  layer.i18n.lang='de'; await layer.i18n.laadWereldDict('de');
  assert.equal(layer.i18n.t('key.712'),'DE: Source message 712');
  assert.equal(layer.calls.flatMap(b=>b.teksten).length,713);
  assert.ok(layer.calls.every(b=>b.teksten.length<=100 && b.teksten.join('').length<=18000));
  delete layer.window.I18N.de;
  await layer.i18n.laadWereldDict('de');
  assert.equal(layer.calls.flatMap(b=>b.teksten).length,713,'known text is never sent twice');
});
test('a late response does not switch back to a previous language',async()=>{
  let finish;
  const layer=languageLayer({hello:'Hello'},b=>new Promise(resolve=>{finish=()=>resolve(response(b,'FR: '));}));
  layer.i18n.lang='fr';const pending=layer.i18n.laadWereldDict('fr');
  layer.i18n.apply('nl');finish();await pending;
  assert.equal(layer.i18n.lang,'nl');
  assert.equal(layer.i18n.t('hello','Hallo'),'Hallo');
  assert.equal(layer.window.I18N.fr.hello,'FR: Hello');
});
test('partial dictionaries use whole English fallback and can retry failed delivery',async()=>{
  let fails=true;
  const layer=languageLayer({one:'One',two:'Two'},async b=>{
    if(fails)return {ok:false,status:503};return response(b,'FR: ');
  });
  layer.window.I18N.fr={one:'Un'};layer.i18n.lang='fr';await layer.i18n.laadWereldDict('fr');
  assert.equal(layer.i18n.t('one'),'One');assert.equal(layer.i18n.t('two'),'Two');
  fails=false;await layer.i18n.laadWereldDict('fr');
  assert.equal(layer.i18n.t('one'),'Un');
  assert.equal(layer.i18n.t('two'),'FR: Two');
  assert.deepEqual(layer.calls[0].teksten,['Two']);
});
test('an unchanged but server-approved brand name completes without polluting the cache',async()=>{
  const layer=languageLayer({hello:'Hello'},async b=>response(b,''));
  layer.i18n.lang='ja';await layer.i18n.laadWereldDict('ja');
  assert.equal(layer.window.I18N.ja.hello,'Hello');assert.equal(layer.cache.size,0);
});
test('the offline language register exactly matches all 114 server languages',()=>{
  const sandbox={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/shared/i18n/i18n-00aa.js'),'utf8'),sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.RTGWereldTalen)),TALEN);
  assert.equal(TALEN.length,114);
});

test('decision and legal copy never go to the translation provider',async()=>{
  const layer=languageLayer({'access.portal.create_my_account':'Create my account','access.onb.finish':'Confirm and open my RTG',hello:'Hello'},async b=>response(b,'DE: '));
  layer.window.RTGAccessMeaning=require('../public/apps/access/meaning');
  layer.i18n.lang='de';await layer.i18n.laadWereldDict('de');
  assert.deepEqual(layer.calls.flatMap(b=>b.teksten),['Hello']);
});
