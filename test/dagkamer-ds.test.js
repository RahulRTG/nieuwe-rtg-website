'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('vier bestaande dagelijkse eigenaren houden identiteit, bronnen en één DS-presentatie',()=>{
 for(const [naam,wereld,ids] of [['notities','living',['ntScrim','ntBewaar','ntTitel','nieuwNotitie']],['bestanden','work',['bkScrim','bkBewaar','bestandkiezer','nieuwMap']],['agenda','living',['afScrim','afBewaar','wMaand','wWeek','wLijst','dailyWeek']],['pulse','living',['pulseContent','dailyIntro']]]){
  const s=read('public/apps/'+naam+'.html');assert.match(s,/<html lang="nl" data-ds(?: |>)/);assert.ok(s.includes('data-rtg-world="'+wereld+'"'));assert.doesNotMatch(s,/<style\b/);
  assert.deepEqual([...s.matchAll(/<link[^>]*href="([^\"]+\.css)"/g)].map(m=>m[1]),['/fonts/fonts.css','/ds/rtg-ds.css']);
  for(const id of ids)assert.ok(s.includes('id="'+id+'"'),naam+':'+id);
  for(const owner of ['rtg-daily-copy','rtg-daily-fields','rtg-daily','uitvoer','basis','randen','appmenu'])assert.ok(s.includes('/shared/'+owner+'.js'),naam+':'+owner);
 }
 for(const naam of ['notities','agenda','bestanden','pulse'])assert.ok(fs.existsSync(path.join(__dirname,'../public/images/daily/'+naam+'.webp')),naam+' fotografische bron');
 assert.match(read('public/ds/componenten/dagkamer.css'),/\.ds-dag-kop\.ds-kop \{ display: flex; flex-wrap: wrap/);
 const agenda=read('public/apps/agenda.html');for(const s of ['kalender','editorial','paneel','app'])assert.ok(agenda.includes('/apps/agenda/'+s+'.js'));assert.ok(agenda.includes('/shared/rtg-route-memory.js'));
 const tokens=read('public/ds/tokens.css');for(const n of ['dagkamer','daginhoud','dagkalender']){const css=read('public/ds/componenten/'+n+'.css');assert.ok(Buffer.byteLength(css)<10240);assert.doesNotMatch(css,/!important|#[\da-f]{3,8}\b|(?:padding|margin|border)-(?:left|right)\s*:/i);for(const m of css.matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(m[1]+':'),m[1]);}
});
test('echte daily-owner blijft bronstatus, ontsnapping, retry en bestaande doelen gebruiken',()=>{
 const host={innerHTML:''},events={},target={disabled:false,click(){this.clicks=(this.clicks||0)+1}},body={dataset:{rtgDaily:'notities'}};
 const d={body,documentElement:{lang:'nl'},getElementById:id=>id==='dailyIntro'?host:target,querySelectorAll:()=>[],addEventListener:(k,f)=>events[k]=f};
 const c={window:{RTGDailyCopy:{esc:s=>s.replaceAll('<','&lt;'),text:k=>k}},document:d};vm.runInNewContext(read('public/shared/rtg-daily.js'),c);
 assert.equal(body.dataset.dailyState,'loading');assert.match(host.innerHTML,/role="status"/);assert.doesNotMatch(host.innerHTML,/daily-photo/);
 let retries=0;c.window.RTGDaily.render('notities','error',{retry:()=>retries++});assert.match(host.innerHTML,/data-daily-target="retry"/);events.click({target:{closest:()=>({dataset:{dailyTarget:'retry'}})}});assert.equal(retries,1);
 c.window.RTGDaily.render('notities','empty');assert.match(host.innerHTML,/\/images\/daily\/notities.webp/);assert.match(host.innerHTML,/data-daily-target="nieuwNotitie"/);events.click({target:{closest:()=>({dataset:{dailyTarget:'nieuwNotitie'}})}});assert.equal(target.clicks,1);
 target.disabled=true;events.click({target:{closest:()=>({dataset:{dailyTarget:'nieuwNotitie'}})}});assert.equal(target.clicks,1);
 c.window.RTGDaily.render('notities','ready',{title:'<persoonlijk>'});assert.match(host.innerHTML,/&lt;persoonlijk>/);assert.doesNotMatch(host.innerHTML,/daily-photo/);assert.match(host.innerHTML,/ds-dag-daily-hero/);
 c.window.RTGDaily.render('pulse','guest');assert.match(host.innerHTML,/href="\/apps\/app.html"/);assert.doesNotMatch(host.innerHTML,/data-daily-target="dailyCompose"/);
});
test('kalender gebruikt canonieke gevulde chips en zeven bruikbare weekacties',()=>{
 const c={window:{},document:{documentElement:{lang:'nl'}},Intl,Date};vm.runInNewContext(read('public/apps/agenda/kalender.js'),c);const host={innerHTML:'',querySelectorAll:()=>[]};
 c.window.RTGAgendaKal.week(host,'2026-10-26',[{datum:'2026-10-26',titel:'<Eigen afspraak>',bron:'boeking',tijd:'10:00'}],()=>{},'2026-10-26');
 assert.match(host.innerHTML,/chip ds-dag-chip eco/);assert.match(host.innerHTML,/&lt;Eigen afspraak&gt;/);assert.equal((host.innerHTML.match(/ds-dag-week-toevoegen/g)||[]).length,7);assert.doesNotMatch(host.innerHTML,/min-height:1.4rem/);assert.match(read('public/ds/componenten/dagkalender.css'),/\.ds-dag-wgrid \{ min-inline-size: calc\(7 \* \(var\(--ds-doel\)/);assert.match(read('public/ds/componenten/dagkalender.css'),/\.ds-dag-kal \{ overflow: auto/);
 assert.match(read('public/ds/componenten/daginhoud.css'),/\.ds-dag-taak input\[type="checkbox"\][^}]*block-size: var\(--ds-doel\)/);
 assert.doesNotMatch(read('public/ds/componenten/dagkamer.css'),/ds-dag-melding/);assert.doesNotMatch(read('public/apps/pulse.html'),/<span class="negen">9\+/);
});
test('notitie gebruikt dezelfde editor met native open/Escape/focus en behoud bij dubbele opening',()=>{
 const source=read('public/apps/notities/app/app-02.js'),nodes={},events={};let focused;
 const node=id=>nodes[id]||(nodes[id]={id,open:false,isConnected:true,value:'',style:{},classList:{add(){},remove(){}},focus(){focused=this;},showModal(){this.open=true;},close(){this.open=false;},addEventListener(k,f){events[id+':'+k]=f;}});
 const opener=node('bron'),d={activeElement:opener};let calls=0;
 const init=source.slice(0,source.indexOf('  function vul()'));
 const close=source.slice(source.indexOf('  function dicht()'),source.indexOf("  $('#nieuwNotitie')"));
 const c={$:id=>node(id.replace(/^#/,'')),document:d,stand:{eigen:[{id:'a',titel:'Bestaat'}]},saving:false,vul(){calls++;},JSON};vm.createContext(c);vm.runInContext(init+'\n'+close,c);
 vm.runInContext("nieuw('notitie')",c);assert.equal(node('ntScrim').open,true);assert.equal(focused,node('ntTitel'));vm.runInContext("open.titel='Eigen concept';nieuw('lijst')",c);assert.equal(c.open.titel,'Eigen concept');assert.equal(calls,1);
 let prevented=false;events['ntScrim:cancel']({preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(node('ntScrim').open,false);assert.equal(focused,opener);
 vm.runInContext("toon('a')",c);opener.isConnected=false;focused=null;vm.runInContext('dicht()',c);assert.equal(focused,null);
 assert.match(source,/class="t ds-invoer/);assert.match(read('public/apps/notities.html'),/<dialog[^>]+id="ntScrim"/);
});
test('echte meld-owner publiceert binnen native editor en behoudt globale terugval',()=>{
 const source=read('public/apps/notities/app/app-01.js'),chunk=source.slice(source.indexOf('  var meldT;'),source.indexOf('  var stand ='));
 const nodes={ntScrim:{open:true},ntMelding:{},melding:{classList:{add(){},remove(){}}}};
 const c={$:id=>nodes[id.slice(1)],clearTimeout(){},setTimeout(){return 1;}};vm.createContext(c);vm.runInContext(chunk,c);vm.runInContext("meld('Server weigert opslag')",c);assert.equal(nodes.ntMelding.textContent,'Server weigert opslag');assert.equal(nodes.melding.textContent,undefined);
 nodes.ntScrim.open=false;vm.runInContext("meld('Bewaard')",c);assert.equal(nodes.melding.textContent,'Bewaard');
});
